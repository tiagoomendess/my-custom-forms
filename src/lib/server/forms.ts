import { and, eq, sql } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { hmac, safeEqual } from './auth';
import type { DB } from './db';
import { forms, submissions } from './db/schema';

export async function getForm(db: DB, id: string) {
	const rows = await db.select().from(forms).where(eq(forms.id, id)).limit(1);
	return rows[0] ?? null;
}

/** Number of submissions for a form (used to lock the spec and gate exports). */
export async function countSubmissions(db: DB, formId: string): Promise<number> {
	const rows = await db
		.select({ count: sql<number>`count(*)` })
		.from(submissions)
		.where(eq(submissions.formId, formId));
	return Number(rows[0]?.count ?? 0);
}

export async function hasSubmissions(db: DB, formId: string): Promise<boolean> {
	return (await countSubmissions(db, formId)) > 0;
}

/** True when the form has a deadline and `now` is strictly after it. */
export function isPastSubmitDeadline(
	form: { allowSubmitUntil: Date | null },
	now = new Date()
): boolean {
	return form.allowSubmitUntil != null && now.getTime() > form.allowSubmitUntil.getTime();
}

/** True when this IP + User-Agent already have a FINISHED submission for the form. */
export async function hasFinishedByClient(
	db: DB,
	formId: string,
	ip: string,
	userAgent: string | null
): Promise<boolean> {
	if (!ip || !userAgent) return false;
	const rows = await db
		.select({ id: submissions.id })
		.from(submissions)
		.where(
			and(
				eq(submissions.formId, formId),
				eq(submissions.status, 'FINISHED'),
				eq(submissions.ip, ip),
				eq(submissions.userAgent, userAgent)
			)
		)
		.limit(1);
	return rows.length > 0;
}

const FORM_DONE_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

export function formDoneCookieName(formId: string): string {
	return `form_done_${formId}`;
}

export function formDoneCookieOptions(formId: string) {
	return {
		path: `/form/${formId}`,
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: true,
		maxAge: FORM_DONE_TTL_SECONDS
	};
}

/** Signed token: `<formId>.<expiryEpoch>.<hmac>` bound to this form. */
export async function createFormDoneToken(formId: string, secret: string): Promise<string> {
	const expiry = Math.floor(Date.now() / 1000) + FORM_DONE_TTL_SECONDS;
	const sig = await hmac(secret, `form_done.${formId}.${expiry}`);
	return `${formId}.${expiry}.${sig}`;
}

export async function verifyFormDoneToken(
	token: string | undefined,
	formId: string,
	secret: string
): Promise<boolean> {
	if (!token) return false;
	const parts = token.split('.');
	if (parts.length !== 3) return false;
	const [tokenFormId, expiryStr, sig] = parts;
	if (tokenFormId !== formId) return false;
	const expiry = Number(expiryStr);
	if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
	const expected = await hmac(secret, `form_done.${formId}.${expiryStr}`);
	return safeEqual(sig, expected);
}

export async function hasFormDoneCookie(
	cookies: Cookies,
	formId: string,
	secret: string
): Promise<boolean> {
	const token = cookies.get(formDoneCookieName(formId));
	return verifyFormDoneToken(token, formId, secret);
}

export async function setFormDoneCookie(
	cookies: Cookies,
	formId: string,
	secret: string
): Promise<void> {
	const token = await createFormDoneToken(formId, secret);
	cookies.set(formDoneCookieName(formId), token, formDoneCookieOptions(formId));
}
