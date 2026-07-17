# AGENTS.md

Guidance for coding agents working in this repository.

## What this is

A self-hosted, Google-Forms-style app for research: build dynamic branching forms
(conditional flow + A/B splits), collect responses, and export to CSV. SvelteKit (Svelte 5,
runes) deployed on a bare-metal VPS with Node.js.

## Tech stack

- **SvelteKit + Svelte 5 (runes mode)**. The adapter is configured in `vite.config.ts`
  (`@sveltejs/adapter-node`) — there is **no `svelte.config.js`**.
- **Node.js** runtime on a VPS. Configuration via environment variables (see `.env.example`):
  `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, optional `UPLOAD_DIR`, `PORT`, `HOST`,
  `BODY_SIZE_LIMIT` (set to `5M` so image uploads are not rejected by adapter-node’s 512K default).
- **MySQL via `mysql2` + Drizzle ORM**. `drizzle-kit` handles migrations.
- **Local filesystem** for uploaded question/cover images (`src/lib/server/storage.ts`).

## Commands

- `npm run dev` — dev server (loads `.env` via `vite.config.ts`).
- `npm run check` — `svelte-kit sync` + `svelte-check`. **Run after changes; keep it at 0 errors/0 warnings.**
- `npm run build` — production build (adapter output in `build/`).
- `npm run start` — run the production build (`node --env-file=.env build`); loads root `.env`
  automatically (including `PORT` / `HOST`).
- `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` — Drizzle (reads `DATABASE_URL` from `.env`).
- Local MySQL: `docker compose up -d`.

## Architecture

The form definition is a single JSON graph (`FormSpec`) stored in `forms.spec`. A form is a
map of nodes; the flow engine walks it one node at a time.

- `src/lib/forms/types.ts` — `FormSpec`, `Node` (`question` | `break` | `split`), `FlowRule`,
  `Condition`, `PublicNode` projection. **Single source of truth**, shared by client + server.
- `src/lib/forms/engine.ts` — **pure** flow engine (`startNode`, `advance`, `resolveTarget`,
  `validateSpec`). Used by both the public runner and the builder's live preview, so behaviour
  is identical. No DB or platform access here.
- `src/lib/forms/builder.ts` — client-only helpers (id generation, node factories, spec<->items).
- `src/lib/server/` — server-only (never import into client bundles):
  - `env.ts` — reads env vars; `db/` connection + schema; `storage.ts` — local image files;
    `auth.ts` (HMAC signed-cookie sessions, constant-time compare), `ratelimit.ts`, `forms.ts`,
    `replies.ts`.
- `src/lib/components/` — `QuestionView.svelte` renders one node and is reused by the runner
  **and** the preview; `builder/` holds the editor + preview.

### Routes

- `src/routes/form/[formId]/` — public runner. `+page.server.ts` loads the first node;
  `api/+server.ts` is server-authoritative: it computes the next node, lazily creates the
  submission on the **first answered question**, upserts answers, resolves A/B splits, and
  marks `FINISHED` at `END`.
- `src/routes/img/[...key]/` — streams images from local storage.
- `src/routes/admin/` — password login (rate-limited), form list, builder
  (`forms/[id]`), and `forms/[id]/replies` (table, CSV export, delete-all).
- `src/hooks.server.ts` — sets `locals.isAdmin` and guards all `/admin` routes.

### Data model (`src/lib/server/db/schema.ts`)

`forms`, `submissions` (metadata: ip, user_agent, source, ab_assignments, status), `answers`
(unique on `(submission_id, question_id)` to allow upserts). Change the schema, then
`npm run db:generate` and commit the SQL in `drizzle/`.

## Conventions & gotchas

- In `+server.ts` / `+page.server.ts`, import `RequestHandler` / `Actions` / `PageServerLoad`
  from **`./$types`**, never from `@sveltejs/kit` (the generic versions type route params as
  optional and break `params.x`).
- Get the DB with `await getDb()` inside a request; it throws if `DATABASE_URL` is missing.
  A module-level connection pool is reused across requests.
- Uploaded images live under `UPLOAD_DIR` (default `data/uploads/`). Back up this directory
  alongside the database. Production must set `BODY_SIZE_LIMIT=5M` (adapter-node defaults to
  `512K` and will 413 before the upload handler’s own 5 MB check).
- The flow engine is pure and must stay that way — keep DB/randomness injection at the call site
  (`advance(...)` accepts an optional `rng`).
- A form's spec is **locked once it has submissions** (`hasSubmissions`); builder save/edit is
  rejected server-side. Deleting all replies unlocks it.
- `FlowRule[]` convention: conditional rules first, one unconditional default **last**. The
  builder normalizes to this; `validateSpec` must pass before publishing.
- Never commit secrets; use `.env` locally and on the VPS (`npm run start` loads it via
  `--env-file=.env`).
- Do not edit generated files (`.svelte-kit/`) or the plan file in `.cursor/plans/`.
