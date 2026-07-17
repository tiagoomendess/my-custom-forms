import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { putImage } from '$lib/server/storage';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

export const POST: RequestHandler = async ({ params, request }) => {
	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) throw error(400, 'No file provided.');
	if (file.size > MAX_BYTES) throw error(413, 'Image is too large (max 5 MB).');
	if (!ALLOWED.has(file.type)) throw error(415, 'Unsupported image type.');

	const key = `${params.id}/${crypto.randomUUID()}.${EXT[file.type]}`;
	await putImage(key, await file.arrayBuffer(), file.type);

	return json({ key });
};
