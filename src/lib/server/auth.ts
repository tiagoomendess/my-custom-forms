/**
 * Minimal admin auth: a single shared password (from a secret) grants a signed,
 * expiring session cookie. No user accounts. Everything here uses Web Crypto so
 * it runs unchanged on the Workers runtime.
 */

export const SESSION_COOKIE = 'session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

const encoder = new TextEncoder();

/** Constant-time string comparison to avoid leaking length/content via timing. */
export function safeEqual(a: string, b: string): boolean {
	const aBytes = encoder.encode(a);
	const bBytes = encoder.encode(b);
	// Compare against a fixed length so mismatched lengths still take the same path.
	const len = Math.max(aBytes.length, bBytes.length);
	let diff = aBytes.length ^ bBytes.length;
	for (let i = 0; i < len; i++) {
		diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
	}
	return diff === 0;
}

/** HMAC-SHA256 hex digest — shared by admin sessions and form-done cookies. */
export async function hmac(secret: string, message: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
	return bufferToHex(sig);
}

function bufferToHex(buf: ArrayBuffer): string {
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Create a signed session token of the form `<expiryEpoch>.<hmac>`. */
export async function createSessionToken(secret: string): Promise<string> {
	const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
	const sig = await hmac(secret, `admin.${expiry}`);
	return `${expiry}.${sig}`;
}

/** Verify a session token's signature and expiry. */
export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
	if (!token) return false;
	const dot = token.indexOf('.');
	if (dot === -1) return false;
	const expiryStr = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	const expiry = Number(expiryStr);
	if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
	const expected = await hmac(secret, `admin.${expiryStr}`);
	return safeEqual(sig, expected);
}

export const sessionCookieOptions = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: true,
	maxAge: SESSION_TTL_SECONDS
};
