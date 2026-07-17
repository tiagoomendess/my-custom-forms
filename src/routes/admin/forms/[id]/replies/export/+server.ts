import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getForm } from '$lib/server/forms';
import { formatAnswer, getAnswerMap, getSubmissions, listQuestions } from '$lib/server/replies';
import type { RequestHandler } from './$types';

function csvCell(value: string | null | undefined): string {
	const s = value ?? '';
	// Quote if it contains comma, quote, or newline; escape quotes by doubling.
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toIso(d: Date | null): string {
	return d ? new Date(d).toISOString() : '';
}

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = await getDb(platform);
	const form = await getForm(db, params.id);
	if (!form) throw error(404, 'Form not found.');

	const columns = listQuestions(form.spec);
	const subs = await getSubmissions(db, form.id);
	const answerMap = await getAnswerMap(db, form.id);

	const meta = ['submission_id', 'status', 'source', 'ip', 'user_agent', 'started_at', 'finished_at'];
	const header = [...meta, ...columns.map((c) => c.title)];

	const lines = [header.map(csvCell).join(',')];
	for (const s of subs) {
		const answers = answerMap.get(s.id);
		const row = [
			s.id,
			s.status,
			s.source ?? '',
			s.ip ?? '',
			s.userAgent ?? '',
			toIso(s.startedAt),
			toIso(s.finishedAt),
			...columns.map((c) => formatAnswer(c.node, answers?.get(c.id)))
		];
		lines.push(row.map(csvCell).join(','));
	}

	// Prepend a BOM so Excel opens UTF-8 correctly.
	const body = '\uFEFF' + lines.join('\r\n');
	const filename = `${form.name.replace(/[^a-z0-9-_]+/gi, '_')}-replies.csv`;

	return new Response(body, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${filename}"`
		}
	});
};
