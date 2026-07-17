# AGENTS.md

Guidance for coding agents working in this repository.

## What this is

A self-hosted, Google-Forms-style app for research: build dynamic branching forms
(conditional flow + A/B splits), collect responses, and export to CSV. SvelteKit (Svelte 5,
runes) deployed to Cloudflare Workers.

## Tech stack

- **SvelteKit + Svelte 5 (runes mode)**. The adapter is configured in `vite.config.ts`
  (`@sveltejs/adapter-cloudflare`) — there is **no `svelte.config.js`**.
- **Cloudflare Workers** runtime. Bindings are declared in `wrangler.jsonc`:
  `HYPERDRIVE` (MySQL), `IMAGES` (R2), `LOGIN_LIMITER` (Rate Limiting), plus `ADMIN_PASSWORD`
  and `SESSION_SECRET` secrets. Typed in `src/app.d.ts` under `App.Platform`.
- **MySQL via Hyperdrive + `mysql2` + Drizzle ORM**. `drizzle-kit` handles migrations.
- Everything must run on the **Workers runtime**: use Web APIs / Web Crypto, avoid Node-only
  modules. `mysql2` connections must pass `disableEval: true` (see `src/lib/server/db/index.ts`).

## Commands

- `npm run dev` — dev server (Cloudflare bindings emulated from `wrangler.jsonc` + `.dev.vars`).
- `npm run check` — `svelte-kit sync` + `svelte-check`. **Run after changes; keep it at 0 errors/0 warnings.**
- `npm run build` — production build (adapter output at `.svelte-kit/cloudflare/_worker.js`).
- `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` — Drizzle (Node, reads `DATABASE_URL` from `.env`).
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
  - `db/` connection + schema, `auth.ts` (HMAC signed-cookie sessions, constant-time compare),
    `ratelimit.ts`, `forms.ts`, `replies.ts`.
- `src/lib/components/` — `QuestionView.svelte` renders one node and is reused by the runner
  **and** the preview; `builder/` holds the editor + preview.

### Routes

- `src/routes/form/[formId]/` — public runner. `+page.server.ts` loads the first node;
  `api/+server.ts` is server-authoritative: it computes the next node, lazily creates the
  submission on the **first answered question**, upserts answers, resolves A/B splits, and
  marks `FINISHED` at `END`.
- `src/routes/img/[key]/+server.ts` — streams images from R2.
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
- Get the DB with `await getDb(platform)` inside a request; it throws if `HYPERDRIVE` is missing.
  Locally it reuses one TCP connection (Workers+Hyperdrive GCs per-request clients; Node does not).
- Local dev DB connection comes from `.env` `DATABASE_URL`: `vite.config.ts` loads it and sets
  `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`, which overrides any
  `localConnectionString`. `wrangler.jsonc` intentionally holds no DB credentials.
- The flow engine is pure and must stay that way — keep DB/randomness injection at the call site
  (`advance(...)` accepts an optional `rng`).
- A form's spec is **locked once it has submissions** (`hasSubmissions`); builder save/edit is
  rejected server-side. Deleting all replies unlocks it.
- `FlowRule[]` convention: conditional rules first, one unconditional default **last**. The
  builder normalizes to this; `validateSpec` must pass before publishing.
- Never store secrets in `wrangler.jsonc`; use `wrangler secret put` (prod) / `.dev.vars` (local).
- Do not edit generated files (`.svelte-kit/`) or the plan file in `.cursor/plans/`.
