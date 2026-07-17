import { env as privateEnv } from '$env/dynamic/private';

function required(name: string): string {
	const value = privateEnv[name];
	if (!value) throw new Error(`${name} is not set.`);
	return value;
}

/** Parsed MySQL connection settings from DATABASE_URL. */
export function getDatabaseConfig() {
	const url = new URL(required('DATABASE_URL'));
	const database = url.pathname.replace(/^\//, '');
	if (!database) throw new Error('DATABASE_URL must include a database name.');
	return {
		host: url.hostname,
		port: url.port ? Number(url.port) : 3306,
		user: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
		database
	};
}

export function getAdminPassword(): string {
	return required('ADMIN_PASSWORD');
}

export function getSessionSecret(): string {
	return required('SESSION_SECRET');
}

/** Directory for uploaded images. Defaults to ./data/uploads relative to cwd. */
export function getUploadDir(): string {
	return privateEnv.UPLOAD_DIR?.trim() || 'data/uploads';
}
