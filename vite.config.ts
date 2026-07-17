import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';

// Load .env for local dev and feed DATABASE_URL to the Hyperdrive binding via an
// env var, so the local DB connection string is never committed in wrangler.jsonc.
// This env var takes precedence over any `localConnectionString`, and must be set
// before the SvelteKit dev server calls getPlatformProxy (i.e. here).
dotenv.config();
if (process.env.DATABASE_URL) {
	// Both prefixes are accepted across wrangler versions.
	process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??= process.env.DATABASE_URL;
	process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??= process.env.DATABASE_URL;
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Deploys to Cloudflare Workers. See https://svelte.dev/docs/kit/adapter-cloudflare
			adapter: adapter()
		})
	]
});
