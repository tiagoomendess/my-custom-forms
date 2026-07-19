import { redirect, type Actions } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { forms, submissions } from '$lib/server/db/schema';
import { getForm } from '$lib/server/forms';
import { emptySpec } from '$lib/forms/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = await getDb();
	const rows = await db
		.select({
			id: forms.id,
			name: forms.name,
			status: forms.status,
			createdAt: forms.createdAt,
			submissionCount: db.$count(submissions, eq(submissions.formId, forms.id))
		})
		.from(forms)
		.orderBy(desc(forms.createdAt));

	return { forms: rows.map((r) => ({ ...r, submissionCount: Number(r.submissionCount) })) };
};

export const actions: Actions = {
	create: async () => {
		const db = await getDb();
		const id = crypto.randomUUID();
		await db.insert(forms).values({ id, name: 'Untitled form', spec: emptySpec(), status: 'draft' });
		throw redirect(303, `/admin/forms/${id}`);
	},

	duplicate: async ({ request }) => {
		const db = await getDb();
		const data = await request.formData();
		const sourceId = String(data.get('id') ?? '');
		const source = await getForm(db, sourceId);
		if (!source) return { ok: false };
		const id = crypto.randomUUID();
		await db.insert(forms).values({
			id,
			name: `${source.name} (copy)`,
			spec: source.spec,
			status: 'draft',
			coverImageKey: source.coverImageKey,
			allowSubmitUntil: source.allowSubmitUntil,
			allowMultipleSubmits: source.allowMultipleSubmits
		});
		throw redirect(303, `/admin/forms/${id}`);
	},

	archive: async ({ request }) => {
		const db = await getDb();
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		await db.update(forms).set({ status: 'archived' }).where(eq(forms.id, id));
		return { ok: true };
	},

	restore: async ({ request }) => {
		const db = await getDb();
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		await db.update(forms).set({ status: 'draft' }).where(eq(forms.id, id));
		return { ok: true };
	}
};
