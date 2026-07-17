import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

export const POST: RequestHandler = async ({ params, request, platform }) => {
	const bucket = platform?.env?.IMAGES;
	if (!bucket) throw error(500, 'Image storage is not configured.');

	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) throw error(400, 'No file provided.');
	if (file.size > MAX_BYTES) throw error(413, 'Image is too large (max 5 MB).');
	if (!ALLOWED.has(file.type)) throw error(415, 'Unsupported image type.');

	const key = `${params.id}/${crypto.randomUUID()}.${EXT[file.type]}`;
	await bucket.put(key, await file.arrayBuffer(), {
		httpMetadata: { contentType: file.type }
	});

	return json({ key });
};
