import { error } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { answers, submissions } from '$lib/server/db/schema';
import { getForm } from '$lib/server/forms';
import { formatAnswer, getAnswerMap, getSubmissions, listQuestions } from '$lib/server/replies';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const db = await getDb();
	const form = await getForm(db, params.id);
	if (!form) throw error(404, 'Form not found.');

	const columns = listQuestions(form.spec);
	const subs = await getSubmissions(db, form.id);
	const answerMap = await getAnswerMap(db, form.id);

	const rows = subs.map((s) => ({
		id: s.id,
		status: s.status,
		source: s.source,
		ip: s.ip,
		userAgent: s.userAgent,
		startedAt: s.startedAt,
		finishedAt: s.finishedAt,
		cells: columns.map((c) => formatAnswer(c.node, answerMap.get(s.id)?.get(c.id)))
	}));

	return {
		formId: form.id,
		formName: form.name,
		columns: columns.map((c) => ({ id: c.id, title: c.title })),
		rows,
		total: subs.length,
		finished: subs.filter((s) => s.status === 'FINISHED').length
	};
};

export const actions: Actions = {
	deleteAll: async ({ params }) => {
		const db = await getDb();
		const form = await getForm(db, params.id);
		if (!form) throw error(404, 'Form not found.');

		const ids = (
			await db
				.select({ id: submissions.id })
				.from(submissions)
				.where(eq(submissions.formId, form.id))
		).map((r) => r.id);

		if (ids.length > 0) {
			await db.delete(answers).where(inArray(answers.submissionId, ids));
			await db.delete(submissions).where(eq(submissions.formId, form.id));
		}

		return { ok: true, deleted: ids.length };
	}
};
