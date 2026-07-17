/** In-memory login rate limiter (5 attempts per 60 seconds per key). */
const WINDOW_MS = 60_000;
const LIMIT = 5;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export async function checkRateLimit(key: string): Promise<boolean> {
	const now = Date.now();
	const bucket = buckets.get(key);

	if (!bucket || now >= bucket.resetAt) {
		buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
		return true;
	}

	if (bucket.count >= LIMIT) return false;
	bucket.count++;
	return true;
}
