# Custom Forms

A small, self-hosted alternative to Google Forms for research: build dynamic, branching
forms with conditional flows and A/B splits, collect responses, and export them to CSV.

Built with SvelteKit (Svelte 5) and designed to run on a bare-metal VPS with Node.js,
MySQL, and local filesystem storage for images.

## Features

- Question types: text, number, single choice, multiple choice, and slider.
- Conditional flow: send respondents to different questions based on their answers.
- Auto-advance for single-choice questions, with a Back button always available.
- Section breaks (informational screens with just Continue / Back).
- A/B testing via weighted split nodes; each respondent's branch is recorded.
- Images on any question or break (stored on the local filesystem).
- Partial saves: a submission is created on the first answered question (status `PARTIAL`)
  and marked `FINISHED` when the flow reaches the end.
- Metadata captured per submission: IP, user agent, and a `?source=` tag from the share link.
- Simple admin area (single password, no user accounts) with brute-force throttling.
- CSV export and a "delete all replies" action. A form's questions lock once it has replies;
  deleting all replies unlocks it again.

## Tech stack

- SvelteKit + `@sveltejs/adapter-node`
- MySQL using `mysql2` + Drizzle ORM
- Local filesystem for images (`data/uploads/` by default)
- In-memory rate limiting for admin login

## Local development

1. Install dependencies:

```sh
npm install
```

2. Start a local MySQL (matches `.env.example`):

```sh
docker compose up -d
```

3. Create your env file:

```sh
cp .env.example .env
```

4. Run migrations against the local database:

```sh
npm run db:migrate
```

5. Start the dev server:

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

## Deploying to a VPS

1. Install Node.js (20+) and MySQL on the server.

2. Clone the repo, install dependencies, and build:

```sh
npm ci
npm run build
```

3. Create a `.env` at the project root (same variables as local). `npm run start` loads it
   automatically via Node's `--env-file`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | MySQL connection string |
| `ADMIN_PASSWORD` | yes | Admin login password |
| `SESSION_SECRET` | yes | Random string for signing cookies |
| `UPLOAD_DIR` | no | Image storage path (default: `data/uploads`) |
| `PORT` | no | HTTP port (default: `3000`) |
| `HOST` | no | Bind address (default: `0.0.0.0`) |

4. Apply migrations to the production database:

```sh
npm run db:migrate
```

5. Run the app:

```sh
npm run start
```

`npm run start` runs `node --env-file=.env build`, so `PORT`, `DATABASE_URL`, and the other
vars from `.env` are available without exporting them in the shell.
Put a reverse proxy (nginx, Caddy, etc.) in front for TLS. Back up both the MySQL database
and the upload directory.

## Project layout

- `src/lib/forms/` – shared form spec types, the flow engine, and builder helpers
- `src/lib/server/` – DB connection, local storage, auth, rate limiting, and reply helpers
- `src/lib/components/` – the shared runner UI (`QuestionView`) and builder components
- `src/routes/form/[formId]/` – the public form runner and its answer API
- `src/routes/admin/` – login and the form builder / replies admin area
- `drizzle/` – generated SQL migrations
