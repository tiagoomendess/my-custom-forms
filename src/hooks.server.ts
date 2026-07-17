import { redirect, type Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, verifySessionToken } from '$lib/server/auth';
import { getSessionSecret } from '$lib/server/env';

export const handle: Handle = async ({ event, resolve }) => {
	let secret = '';
	try {
		secret = getSessionSecret();
	} catch {
		// Misconfigured server — treat everyone as signed out.
	}

	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.isAdmin = secret ? await verifySessionToken(token, secret) : false;

	const { pathname } = event.url;
	const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');
	const isLoginPage = pathname === '/admin/login';

	if (isAdminArea && !isLoginPage && !event.locals.isAdmin) {
		const redirectTo = encodeURIComponent(pathname + event.url.search);
		throw redirect(303, `/admin/login?redirectTo=${redirectTo}`);
	}

	if (isLoginPage && event.locals.isAdmin) {
		throw redirect(303, '/admin');
	}

	return resolve(event);
};
