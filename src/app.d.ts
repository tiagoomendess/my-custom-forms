// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/// <reference types="@cloudflare/workers-types" />

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** True when the current request carries a valid admin session cookie. */
			isAdmin: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				HYPERDRIVE: Hyperdrive;
				IMAGES: R2Bucket;
				LOGIN_LIMITER: RateLimit;
				ADMIN_PASSWORD: string;
				SESSION_SECRET: string;
			};
			cf: CfProperties;
			ctx: ExecutionContext;
		}
	}

	/** Workers Rate Limiting binding (https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit). */
	interface RateLimit {
		limit(options: { key: string }): Promise<{ success: boolean }>;
	}
}

export {};
