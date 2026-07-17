import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { createConnection, type Connection } from 'mysql2/promise';
import { error } from '@sveltejs/kit';
import * as schema from './schema';

export type DB = MySql2Database<typeof schema>;

/**
 * Build a Drizzle client for the current request.
 *
 * On Cloudflare Workers, Hyperdrive pools the origin DB and garbage-collects
 * the Worker-side client when the request ends — so a fresh `createConnection`
 * per request is correct and cheap.
 *
 * Local Vite/Wrangler talks to MySQL over a real TCP socket. Those sockets are
 * *not* cleaned up automatically, so opening one per request leaks until MySQL
 * returns "Too many connections". Reuse a single connection in that case.
 */
type LocalCache = { key: string; connection: Connection; db: DB };

const globalForDb = globalThis as typeof globalThis & {
	__localMysql?: LocalCache;
};

function isLocalMysqlHost(host: string): boolean {
	return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

export async function getDb(platform: App.Platform | undefined): Promise<DB> {
	if (!platform?.env?.HYPERDRIVE) {
		throw error(
			500,
			'Database is not configured. Ensure the HYPERDRIVE binding is set (see wrangler.jsonc).'
		);
	}

	const hd = platform.env.HYPERDRIVE;
	const key = `${hd.host}:${hd.port}:${hd.database}:${hd.user}`;

	if (isLocalMysqlHost(hd.host)) {
		const cached = globalForDb.__localMysql;
		if (cached?.key === key) return cached.db;
		if (cached) {
			await cached.connection.end().catch(() => {});
			globalForDb.__localMysql = undefined;
		}
	}

	const connection = await createConnection({
		host: hd.host,
		user: hd.user,
		password: hd.password,
		database: hd.database,
		port: hd.port,
		// Required to enable mysql2 compatibility on the Workers runtime.
		disableEval: true
	});

	const db = drizzle(connection, { schema, mode: 'default' });

	if (isLocalMysqlHost(hd.host)) {
		globalForDb.__localMysql = { key, connection, db };
	}

	return db;
}

export { schema };
