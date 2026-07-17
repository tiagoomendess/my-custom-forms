# Custom Forms

A small, self-hosted alternative to Google Forms for research: build dynamic, branching
forms with conditional flows and A/B splits, collect responses, and export them to CSV.

Built with SvelteKit (Svelte 5) and designed to run on Cloudflare Workers with MySQL
(via Hyperdrive) and R2 for image storage.

## Features

- Question types: text, number, single choice, multiple choice, and slider.
- Conditional flow: send respondents to different questions based on their answers.
- Auto-advance for single-choice questions, with a Back button always available.
- Section breaks (informational screens with just Continue / Back).
- A/B testing via weighted split nodes; each respondent's branch is recorded.
- Images on any question or break (stored in R2).
- Partial saves: a submission is created on the first answered question (status `PARTIAL`)
  and marked `FINISHED` when the flow reaches the end.
- Metadata captured per submission: IP, user agent, and a `?source=` tag from the share link.
- Simple admin area (single password, no user accounts) with brute-force throttling.
- CSV export and a "delete all replies" action. A form's questions lock once it has replies;
  deleting all replies unlocks it again.

## Tech stack

- SvelteKit + `@sveltejs/adapter-cloudflare`
- MySQL through Cloudflare Hyperdrive, using `mysql2` + Drizzle ORM
- Cloudflare R2 (native binding) for images
- Workers Rate Limiting binding for login throttling

## Local development

1. Install dependencies:

```sh
npm install
```

2. Start a local MySQL (matches `.env.example` / `wrangler.jsonc`):

```sh
docker compose up -d
```

3. Create your env files:

```sh
cp .env.example .env          # used by drizzle-kit (migrations/studio)
cp .dev.vars.example .dev.vars # ADMIN_PASSWORD + SESSION_SECRET for local dev
```

4. Run migrations against the local database:

```sh
npm run db:migrate
```

5. Start the dev server. Cloudflare bindings are emulated by the SvelteKit platform proxy;
   the local MySQL connection comes from `.env` `DATABASE_URL` (wired to the Hyperdrive
   binding in `vite.config.ts`), so no DB credentials live in `wrangler.jsonc`:

```sh
npm run dev
```

Visit `/admin`, sign in with your `ADMIN_PASSWORD`, and build a form. Publish it to get a
public link at `/form/<id>`.

### Database scripts

- `npm run db:generate` – generate a new migration from schema changes
- `npm run db:migrate` – apply migrations
- `npm run db:push` – push the schema directly (handy in early development)
- `npm run db:studio` – open Drizzle Studio

## Deploying to Cloudflare

1. Create the backing resources (once):

```sh
# MySQL connection pooling + edge caching
wrangler hyperdrive create my-custom-forms-db \
  --connection-string="mysql://USER:PASS@HOST:3306/DBNAME"

# Object storage for images
wrangler r2 bucket create my-custom-forms-images
```

2. Put the returned Hyperdrive id into `wrangler.jsonc` (`hyperdrive[0].id`).

3. Set secrets:

```sh
wrangler secret put ADMIN_PASSWORD
wrangler secret put SESSION_SECRET
```

4. Apply migrations to your production MySQL (run `db:migrate` with `DATABASE_URL` pointed at
   the production database, e.g. through a tunnel or from a trusted host).

5. Build and deploy:

```sh
npm run deploy
```

Notes:

- The Rate Limiting binding (`LOGIN_LIMITER`) is defined in `wrangler.jsonc` and requires no
  extra provisioning.
- `mysql2` requires `nodejs_compat` and a compatibility date of 2024-09-23 or later (already
  set in `wrangler.jsonc`).

## Project layout

- `src/lib/forms/` – shared form spec types, the flow engine, and builder helpers
- `src/lib/server/` – DB connection, schema, auth, rate limiting, and reply helpers
- `src/lib/components/` – the shared runner UI (`QuestionView`) and builder components
- `src/routes/form/[formId]/` – the public form runner and its answer API
- `src/routes/admin/` – login and the form builder / replies admin area
- `drizzle/` – generated SQL migrations
