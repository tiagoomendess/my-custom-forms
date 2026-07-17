import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { createPool, type Pool } from 'mysql2/promise';
import { error } from '@sveltejs/kit';
import { getDatabaseConfig } from '../env';
import * as schema from './schema';

export type DB = MySql2Database<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
	__mysqlPool?: Pool;
	__mysqlDb?: DB;
};

function poolKey(config: ReturnType<typeof getDatabaseConfig>): string {
	return `${config.host}:${config.port}:${config.database}:${config.user}`;
}

export async function getDb(): Promise<DB> {
	let config: ReturnType<typeof getDatabaseConfig>;
	try {
		config = getDatabaseConfig();
	} catch {
		throw error(500, 'Database is not configured. Set DATABASE_URL in the environment.');
	}

	const key = poolKey(config);
	const cached = globalForDb.__mysqlPool;
	if (cached && globalForDb.__mysqlDb && (cached as Pool & { __key?: string }).__key === key) {
		return globalForDb.__mysqlDb;
	}

	if (cached) await cached.end().catch(() => {});

	const pool = createPool({
		host: config.host,
		user: config.user,
		password: config.password,
		database: config.database,
		port: config.port,
		waitForConnections: true,
		connectionLimit: 10
	});
	(pool as Pool & { __key?: string }).__key = key;

	const db = drizzle(pool, { schema, mode: 'default' });
	globalForDb.__mysqlPool = pool;
	globalForDb.__mysqlDb = db;
	return db;
}

export { schema };
