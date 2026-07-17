import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const bucket = platform?.env?.IMAGES;
	if (!bucket) throw error(500, 'Image storage is not configured.');

	const object = await bucket.get(params.key);
	if (!object) throw error(404, 'Image not found.');

	const headers = new Headers();
	const meta = object.httpMetadata;
	if (meta?.contentType) headers.set('content-type', meta.contentType);
	if (meta?.contentDisposition) headers.set('content-disposition', meta.contentDisposition);
	if (meta?.contentLanguage) headers.set('content-language', meta.contentLanguage);
	if (meta?.cacheControl) headers.set('cache-control', meta.cacheControl);
	headers.set('etag', object.httpEtag);
	if (!headers.has('cache-control')) {
		headers.set('cache-control', 'public, max-age=31536000, immutable');
	}

	return new Response(object.body, { headers });
};
