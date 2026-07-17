import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	getForm,
	hasFinishedByClient,
	hasFormDoneCookie,
	isPastSubmitDeadline
} from '$lib/server/forms';
import { getSessionSecret } from '$lib/server/env';
import { startNode } from '$lib/forms/engine';
import { toPublicNode } from '$lib/forms/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({
	params,
	url,
	cookies,
	request,
	getClientAddress
}) => {
	const db = await getDb();
	const form = await getForm(db, params.formId);

	if (!form || form.status !== 'published') {
		throw error(404, 'Este formulário não está disponível.');
	}

	const closed = isPastSubmitDeadline(form);
	const coverImageKey = form.coverImageKey ?? null;
	const meta = {
		formId: form.id,
		formName: form.name,
		origin: url.origin,
		coverImageKey
	};

	if (closed) {
		return {
			...meta,
			closed: true as const,
			alreadySubmitted: false as const,
			source: null,
			firstNode: null,
			assignments: {}
		};
	}

	if (!form.allowMultipleSubmits) {
		let secret = '';
		try {
			secret = getSessionSecret();
		} catch {
			// Misconfigured server — skip cookie check.
		}
		const doneCookie = await hasFormDoneCookie(cookies, form.id, secret);
		const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null;
		const doneClient = await hasFinishedByClient(
			db,
			form.id,
			getClientAddress(),
			userAgent
		);
		if (doneCookie || doneClient) {
			return {
				...meta,
				closed: false as const,
				alreadySubmitted: true as const,
				source: null,
				firstNode: null,
				assignments: {}
			};
		}
	}

	const source = url.searchParams.get('source')?.slice(0, 255) ?? null;
	const { nodeId, assignments } = startNode(form.spec);
	const firstNode =
		nodeId === 'END' ? null : toPublicNode(form.spec.nodes[nodeId], nodeId);

	return {
		...meta,
		closed: false as const,
		alreadySubmitted: false as const,
		source,
		firstNode,
		assignments
	};
};
