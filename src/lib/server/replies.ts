import { eq, desc } from 'drizzle-orm';
import type { DB } from './db';
import { answers, submissions } from './db/schema';
import type { AnswerValue, FormSpec, QuestionNode } from '$lib/forms/types';

export type QuestionColumn = { id: string; title: string; node: QuestionNode };

/** Ordered list of answerable question nodes (used for table + CSV columns). */
export function listQuestions(spec: FormSpec): QuestionColumn[] {
	return Object.entries(spec.nodes)
		.filter(([, n]) => n.kind === 'question')
		.map(([id, n]) => ({ id, title: (n as QuestionNode).title || id, node: n as QuestionNode }));
}

export async function getSubmissions(db: DB, formId: string) {
	return db
		.select()
		.from(submissions)
		.where(eq(submissions.formId, formId))
		.orderBy(desc(submissions.startedAt));
}

/** All answers for a form, keyed by submission id then question id. */
export async function getAnswerMap(
	db: DB,
	formId: string
): Promise<Map<string, Map<string, AnswerValue>>> {
	const rows = await db
		.select({
			submissionId: answers.submissionId,
			questionId: answers.questionId,
			value: answers.value
		})
		.from(answers)
		.innerJoin(submissions, eq(answers.submissionId, submissions.id))
		.where(eq(submissions.formId, formId));

	const map = new Map<string, Map<string, AnswerValue>>();
	for (const r of rows) {
		let inner = map.get(r.submissionId);
		if (!inner) {
			inner = new Map();
			map.set(r.submissionId, inner);
		}
		inner.set(r.questionId, r.value);
	}
	return map;
}

/** Human-readable rendering of an answer, mapping choice ids to their labels. */
export function formatAnswer(node: QuestionNode, value: AnswerValue | undefined): string {
	if (value === undefined || value === null) return '';
	const labelFor = (id: string) => node.options?.find((o) => o.id === id)?.label ?? id;
	if (Array.isArray(value)) return value.map(labelFor).join('; ');
	if (node.type === 'single' && typeof value === 'string') return labelFor(value);
	return String(value);
}
