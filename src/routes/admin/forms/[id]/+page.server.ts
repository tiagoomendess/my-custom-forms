import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { forms } from '$lib/server/db/schema';
import { getForm, hasSubmissions } from '$lib/server/forms';
import { validateSpec } from '$lib/forms/engine';
import type { FormSpec } from '$lib/forms/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const db = await getDb();
	const form = await getForm(db, params.id);
	if (!form) throw error(404, 'Form not found.');

	const locked = await hasSubmissions(db, form.id);

	return {
		form: {
			id: form.id,
			name: form.name,
			status: form.status,
			spec: form.spec,
			coverImageKey: form.coverImageKey ?? null,
			allowSubmitUntil: form.allowSubmitUntil ? form.allowSubmitUntil.toISOString() : null,
			allowMultipleSubmits: form.allowMultipleSubmits
		},
		locked,
		shareUrl: `${url.origin}/form/${form.id}`
	};
};

async function assertUnlocked(db: Awaited<ReturnType<typeof getDb>>, id: string) {
	if (await hasSubmissions(db, id)) {
		return 'This form already has replies, so its questions are locked. Delete all replies to edit it.';
	}
	return null;
}

type Settings = {
	coverImageKey: string | null;
	allowSubmitUntil: Date | null;
	allowMultipleSubmits: boolean;
};

/** Parse settings fields that remain editable even when the form is locked. */
function parseSettings(data: FormData): { ok: true; settings: Settings } | { ok: false; error: string } {
	const coverRaw = String(data.get('coverImageKey') ?? '').trim();
	const coverImageKey = coverRaw || null;

	const allowMultipleSubmits = String(data.get('allowMultipleSubmits') ?? 'true') !== 'false';

	const untilRaw = String(data.get('allowSubmitUntil') ?? '').trim();
	if (!untilRaw) {
		return { ok: true, settings: { coverImageKey, allowSubmitUntil: null, allowMultipleSubmits } };
	}
	const allowSubmitUntil = new Date(untilRaw);
	if (Number.isNaN(allowSubmitUntil.getTime())) {
		return { ok: false, error: 'Invalid allow-submit-until date.' };
	}
	return { ok: true, settings: { coverImageKey, allowSubmitUntil, allowMultipleSubmits } };
}

export const actions: Actions = {
	save: async ({ params, request }) => {
		const db = await getDb();
		const form = await getForm(db, params.id);
		if (!form) throw error(404, 'Form not found.');

		const data = await request.formData();
		const parsed = parseSettings(data);
		if (!parsed.ok) return fail(400, { error: parsed.error });
		const { settings } = parsed;

		const lockError = await assertUnlocked(db, form.id);
		if (lockError) {
			// Settings stay editable after replies lock the question graph.
			await db
				.update(forms)
				.set({
					coverImageKey: settings.coverImageKey,
					allowSubmitUntil: settings.allowSubmitUntil,
					allowMultipleSubmits: settings.allowMultipleSubmits
				})
				.where(eq(forms.id, form.id));
			return { ok: true, savedAt: Date.now() };
		}

		const name = String(data.get('name') ?? '').trim() || 'Untitled form';
		let spec: FormSpec;
		try {
			spec = JSON.parse(String(data.get('spec') ?? '')) as FormSpec;
		} catch {
			return fail(400, { error: 'Invalid form data.' });
		}

		await db
			.update(forms)
			.set({
				name,
				spec,
				coverImageKey: settings.coverImageKey,
				allowSubmitUntil: settings.allowSubmitUntil,
				allowMultipleSubmits: settings.allowMultipleSubmits
			})
			.where(eq(forms.id, form.id));
		return { ok: true, savedAt: Date.now() };
	},

	publish: async ({ params, request }) => {
		const db = await getDb();
		const form = await getForm(db, params.id);
		if (!form) throw error(404, 'Form not found.');

		const data = await request.formData();
		const parsed = parseSettings(data);
		if (!parsed.ok) return fail(400, { error: parsed.error });
		const { settings } = parsed;

		const lockError = await assertUnlocked(db, form.id);
		let spec = form.spec;
		if (!lockError) {
			const name = String(data.get('name') ?? '').trim() || 'Untitled form';
			try {
				spec = JSON.parse(String(data.get('spec') ?? '')) as FormSpec;
			} catch {
				return fail(400, { error: 'Invalid form data.' });
			}
			await db
				.update(forms)
				.set({
					name,
					spec,
					coverImageKey: settings.coverImageKey,
					allowSubmitUntil: settings.allowSubmitUntil,
					allowMultipleSubmits: settings.allowMultipleSubmits
				})
				.where(eq(forms.id, form.id));
		} else {
			await db
				.update(forms)
				.set({
					coverImageKey: settings.coverImageKey,
					allowSubmitUntil: settings.allowSubmitUntil,
					allowMultipleSubmits: settings.allowMultipleSubmits
				})
				.where(eq(forms.id, form.id));
		}

		const errors = validateSpec(spec);
		if (errors.length > 0) return fail(400, { error: 'Cannot publish:', errors });

		await db.update(forms).set({ status: 'published' }).where(eq(forms.id, form.id));
		return { ok: true, published: true };
	},

	unpublish: async ({ params }) => {
		const db = await getDb();
		const form = await getForm(db, params.id);
		if (!form) throw error(404, 'Form not found.');
		await db.update(forms).set({ status: 'draft' }).where(eq(forms.id, form.id));
		return { ok: true, published: false };
	}
};
