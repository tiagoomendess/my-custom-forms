/**
 * Thin wrapper around the Workers Rate Limiting binding. Fails open when the
 * binding is missing (e.g. some local-dev setups) so development is not blocked,
 * but is always enforced in production where the binding exists.
 */
export async function checkRateLimit(
	platform: App.Platform | undefined,
	key: string
): Promise<boolean> {
	const limiter = platform?.env?.LOGIN_LIMITER;
	if (!limiter) return true;
	const { success } = await limiter.limit({ key });
	return success;
}
