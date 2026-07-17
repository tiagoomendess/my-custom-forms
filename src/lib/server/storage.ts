import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { getUploadDir } from './env';

const EXT_MIME: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif'
};

/** Reject path traversal and other unsafe keys. */
export function assertSafeKey(key: string): string {
	const normalized = key.replace(/\\/g, '/');
	if (!normalized || normalized.startsWith('/') || normalized.includes('..')) {
		throw error(400, 'Invalid image key.');
	}
	for (const part of normalized.split('/')) {
		if (!part || part === '.' || part === '..') {
			throw error(400, 'Invalid image key.');
		}
	}
	return normalized;
}

function resolvePath(key: string): string {
	const safe = assertSafeKey(key);
	return path.join(getUploadDir(), ...safe.split('/'));
}

function contentTypeForKey(key: string): string {
	const ext = key.split('.').pop()?.toLowerCase() ?? '';
	return EXT_MIME[ext] ?? 'application/octet-stream';
}

async function ensureUploadDir(): Promise<void> {
	await mkdir(getUploadDir(), { recursive: true });
}

export async function putImage(
	key: string,
	data: ArrayBuffer | Buffer,
	contentType: string
): Promise<void> {
	await ensureUploadDir();
	const filePath = resolvePath(key);
	await mkdir(path.dirname(filePath), { recursive: true });
	const body = data instanceof Buffer ? data : Buffer.from(new Uint8Array(data));
	await writeFile(filePath, body, { flag: 'wx' });
	// contentType is stored implicitly via file extension; key already includes it.
	void contentType;
}

export type StoredImage = {
	body: Buffer;
	contentType: string;
	etag: string;
};

export async function getImage(key: string): Promise<StoredImage | null> {
	const filePath = resolvePath(key);
	try {
		const [body, info] = await Promise.all([readFile(filePath), stat(filePath)]);
		const etag = `"${createHash('md5').update(body).digest('hex')}"`;
		return {
			body,
			contentType: contentTypeForKey(key),
			etag
		};
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw err;
	}
}
