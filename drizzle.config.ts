import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs on Node (migrations / studio), not on Workers, so it reads a
// plain connection string from the environment. Set DATABASE_URL in .env.
const url = process.env.DATABASE_URL ?? 'mysql://root:root@localhost:3306/my_custom_forms';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'mysql',
	dbCredentials: { url },
	verbose: true,
	strict: true
});
