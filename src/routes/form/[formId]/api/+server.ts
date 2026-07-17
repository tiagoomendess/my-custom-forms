import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import {
	getForm,
	hasFinishedByClient,
	hasFormDoneCookie,
	isPastSubmitDeadline,
	setFormDoneCookie
} from '$lib/server/forms';
import {
	advance,
	checkMultiSelection,
	isEnd,
	multiSelectionComplete,
	runValidations
} from '$lib/forms/engine';
import { toPublicNode, type AnswerValue } from '$lib/forms/types';
import { answers, submissions } from '$lib/server/db/schema';
import { getSessionSecret } from '$lib/server/env';

type Body = {
	submissionId?: string | null;
	nodeId: string;
	value?: AnswerValue | null;
	source?: string | null;
	assignments?: Record<string, string>;
};

function isAnswered(value: AnswerValue | null | undefined): value is AnswerValue {
	if (value === undefined || value === null) return false;
	if (typeof value === 'string') return value.trim() !== '';
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

export const POST: RequestHandler = async ({
	params,
	request,
	getClientAddress,
	cookies
}) => {
	const db = await getDb();
	const form = await getForm(db, params.formId);
	if (!form || form.status !== 'published') throw error(404, 'Formulário não disponível.');
	if (isPastSubmitDeadline(form)) {
		throw error(403, 'Este formulário já não aceita respostas.');
	}

	let secret = '';
	try {
		secret = getSessionSecret();
	} catch {
		// Misconfigured server — skip cookie check.
	}
	const clientIp = getClientAddress();
	const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null;

	if (!form.allowMultipleSubmits) {
		if (await hasFormDoneCookie(cookies, form.id, secret)) {
			throw error(403, 'Já respondeu a este formulário.');
		}
	}

	const body = (await request.json()) as Body;
	const node = form.spec.nodes[body.nodeId];
	if (!node || node.kind === 'split') throw error(400, 'Pergunta inválida.');

	// Load existing submission (authoritative assignments) or start from client hint.
	let submissionId = body.submissionId ?? null;
	let assignments: Record<string, string> = body.assignments ?? {};
	if (submissionId) {
		const rows = await db
			.select()
			.from(submissions)
			.where(eq(submissions.id, submissionId))
			.limit(1);
		const existing = rows[0];
		if (!existing || existing.formId !== form.id) throw error(400, 'Submissão desconhecida.');
		assignments = existing.abAssignments ?? {};
	}

	const answered = isAnswered(body.value);
	const value = answered ? (body.value as AnswerValue) : undefined;

	if (node.kind === 'question' && answered) {
		if (node.type === 'multi') {
			const limitMsg = checkMultiSelection(node, value);
			if (limitMsg) throw error(400, limitMsg);
			if (!multiSelectionComplete(node, value)) {
				throw error(400, 'Número de seleções inválido.');
			}
		}
		const msg = runValidations(node.validations, value);
		if (msg) throw error(400, msg);
	}

	const result = advance(form.spec, body.nodeId, value, assignments);
	const done = isEnd(result.nodeId);
	assignments = result.assignments;

	// Create the submission lazily on the first *answered* question.
	if (answered && node.kind === 'question' && !submissionId) {
		if (
			!form.allowMultipleSubmits &&
			(await hasFinishedByClient(db, form.id, clientIp, userAgent))
		) {
			throw error(403, 'Já respondeu a este formulário.');
		}
		submissionId = crypto.randomUUID();
		await db.insert(submissions).values({
			id: submissionId,
			formId: form.id,
			status: 'PARTIAL',
			source: body.source?.slice(0, 255) ?? null,
			ip: clientIp,
			userAgent,
			abAssignments: assignments
		});
	}

	// Record the answer (upsert on submission + question).
	if (answered && node.kind === 'question' && submissionId) {
		await db
			.insert(answers)
			.values({
				id: crypto.randomUUID(),
				submissionId,
				questionId: body.nodeId,
				value: value as AnswerValue
			})
			.onDuplicateKeyUpdate({ set: { value: value as AnswerValue } });
	}

	// Keep assignments fresh and finalize when the flow ends.
	if (submissionId) {
		await db
			.update(submissions)
			.set({
				abAssignments: assignments,
				...(done ? { status: 'FINISHED' as const, finishedAt: new Date() } : {})
			})
			.where(eq(submissions.id, submissionId));
	}

	if (done) {
		if (!form.allowMultipleSubmits) {
			await setFormDoneCookie(cookies, form.id, secret);
		}
		return json({ submissionId, done: true, assignments });
	}

	const nextNode = toPublicNode(form.spec.nodes[result.nodeId], result.nodeId);
	return json({ submissionId, done: false, assignments, node: nextNode });
};
