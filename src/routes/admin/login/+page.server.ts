import { fail, redirect, type Actions } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	createSessionToken,
	safeEqual,
	sessionCookieOptions
} from '$lib/server/auth';
import { getAdminPassword, getSessionSecret } from '$lib/server/env';
import { checkRateLimit } from '$lib/server/ratelimit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	return { redirectTo: url.searchParams.get('redirectTo') ?? '/admin' };
};

function safeRedirectTarget(raw: FormDataEntryValue | null): string {
	const value = typeof raw === 'string' ? raw : '';
	return value.startsWith('/') && !value.startsWith('//') ? value : '/admin';
}

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const ip = getClientAddress();
		const allowed = await checkRateLimit(`login:${ip}`);
		if (!allowed) {
			return fail(429, { error: 'Too many attempts. Please wait a minute and try again.' });
		}

		const data = await request.formData();
		const password = String(data.get('password') ?? '');
		const redirectTo = safeRedirectTarget(data.get('redirectTo'));

		let expected = '';
		try {
			expected = getAdminPassword();
		} catch {
			return fail(500, { error: 'Admin password is not configured on the server.' });
		}

		if (!password || !safeEqual(password, expected)) {
			return fail(401, { error: 'Incorrect password.' });
		}

		const token = await createSessionToken(getSessionSecret());
		cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
		throw redirect(303, redirectTo);
	}
};
