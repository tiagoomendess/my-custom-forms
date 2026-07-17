import { redirect, type Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, verifySessionToken } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const secret = event.platform?.env?.SESSION_SECRET ?? '';
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.isAdmin = secret ? await verifySessionToken(token, secret) : false;

	const { pathname } = event.url;
	const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');
	const isLoginPage = pathname === '/admin/login';

	if (isAdminArea && !isLoginPage && !event.locals.isAdmin) {
		const redirectTo = encodeURIComponent(pathname + event.url.search);
		throw redirect(303, `/admin/login?redirectTo=${redirectTo}`);
	}

	// Already signed in? Skip the login page.
	if (isLoginPage && event.locals.isAdmin) {
		throw redirect(303, '/admin');
	}

	return resolve(event);
};
