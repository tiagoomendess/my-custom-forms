import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getImage } from '$lib/server/storage';

export const GET: RequestHandler = async ({ params }) => {
	const key = params.key;
	const image = await getImage(key);
	if (!image) throw error(404, 'Image not found.');

	const headers = new Headers();
	headers.set('content-type', image.contentType);
	headers.set('etag', image.etag);
	headers.set('cache-control', 'public, max-age=31536000, immutable');

	return new Response(new Uint8Array(image.body), { headers });
};
