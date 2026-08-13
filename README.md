# Spitplate

An independent registry of surviving Triumph Spitfires, logged by commission and
VIN number.

**Domain:** spitplate.com (registered, not yet live)
**Status:** home, registry browse/search, and the submission + moderation flow
all run live against Postgres.

> Spitplate is a new, independently-branded project. It is **not** a fork,
> rehost, or continuation of the International Triumph Spitfire Database at
> spitlist.info, and shares no data with it. Any work on rehosting that site is
> a separate codebase and a separate engagement.

## Quick start

```bash
cp .env.example .env          # point DATABASE_URL at your Postgres
npm install
npm run db:setup              # migrate + seed reference and placeholder data
npm run dev                   # http://localhost:4321
```

Without a reachable database the page returns a 500 rather than rendering
zeroes — a registry that silently shows an empty count when Postgres is down is
worse than one that visibly fails.

## Routes

| Route | What it does |
| --- | --- |
| `/` | Home. Live stats, odometer, era cards. |
| `/registry` | Browse and search. Filter by chassis number, era, series, country, year, modified, archived. |
| `/registry/results` | htmx fragment for the same query. Same component as `/registry`, so the two cannot disagree. |
| `/registry/:ref` | One car. `SP-00042`. |
| `/submit` | Public add/correct form (GET renders, POST files). |
| `/submit/thanks` | Post/Redirect/Get landing, so a refresh doesn't file twice. |
| `/api/submissions/:id` | Moderation callback for n8n. Bearer auth. |
| `/health` | DB ping. 200 `ok` / 503 `degraded`. |

## Submission and moderation flow

```
visitor → POST /submit ──→ submissions (status=pending) ──→ n8n webhook → Discord card
                                                                              │
                              cars ←── POST /api/submissions/:id ←────────────┘
                                        {"action":"approve"|"reject"}
```

A submission is a *proposal*, never a direct write. If the chassis number is
already registered the submission is filed as an `update` against that car
rather than a duplicate `create` — that is what makes "anyone can file a
correction" safe: nothing is overwritten until a moderator approves it.

**Approving** applies the payload to `cars` inside one transaction, with the
pending row locked, so two moderators hitting approve at the same moment cannot
both apply it. A create whose chassis number got registered while it sat in the
queue returns `409` rather than corrupting anything.

```bash
curl -X POST https://spitplate.com/api/submissions/$ID \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"action":"approve","reviewer":"dalton"}'
```

Responses: `200` approved/rejected · `401` bad token · `404` unknown id ·
`409` already reviewed, or chassis conflict · `503` `ADMIN_API_TOKEN` unset.

> n8n must send `content-type: application/json`. Astro's CSRF origin check
> treats a form-encoded cross-origin POST as an attack and returns `403`.

### Abuse controls

There are no accounts (out of scope for v1), so the public form leans on:

- **Honeypot** — a hidden `website` field. Filled means bot: the request gets a
  normal thank-you page and is silently discarded. Telling a bot it failed only
  teaches it to retry.
- **Rate limit** — 5 submissions per hour per address, counted from the
  `submissions` table itself, so it survives restarts and needs no extra store.
  Only successful submissions count.
- **CSRF** — Astro's origin check, on by default for server output.
- **`ADMIN_API_TOKEN` unset means closed**, never open.

The rate limit reads `X-Forwarded-For`, which is only trustworthy because
Railway's edge sets it. If this app is ever exposed directly, that header
becomes attacker-controlled and the limit becomes decorative.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Astro dev server |
| `npm run build` | Production build to `dist/` |
| `npm start` | Run the built server |
| `npm run check` | Typecheck `.astro` and `.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Reference data + regenerate placeholder cars |
| `npm run db:setup` | Both of the above |

## Stack

Astro in SSR mode (`@astrojs/node` standalone) over Postgres, with plain SQL
migrations and htmx for the registry filters. Reasoning, alternatives considered, and the client-JS budget are in
[`docs/stack-decision.md`](docs/stack-decision.md).

```
src/
  components/   one per page section; styles are scoped per component
  layouts/      Base.astro — head, nav, footer, scroll-reveal
  lib/          db.ts (pool), registry.ts (queries), site.ts (constants)
  data/         static club and resource lists
  pages/        index, registry/, submit/, api/, health
db/
  migrations/   numbered .sql, applied in order, tracked in schema_migrations
  seed/         reference data
scripts/        migrate.mjs, seed.mjs
docs/           stack decision, data model, original concept mockup
```

## What is live vs. placeholder

Every number on the page is read from the database at request time — the
odometer, the era cards, the stats table, the share percentages, the "last entry
added" date, and the monthly intake figure. Nothing is hardcoded.

Two things are **not** measurements, and are labelled as such on the page:

- **Production totals** (314,332 built) are factory history, held as reference
  data in `model_eras`.
- **The ~20% survival gauge** is a marque-community estimate this registry
  cannot measure. It lives in `src/lib/site.ts` as `SURVIVAL_ESTIMATE_PCT` and
  always renders with a "~" and a qualifier.

The ~186 cars currently in the database are **synthetic placeholders** so the
stats surfaces have something real to read. They all carry `source = 'seed'` and
are swept with `delete from cars where source = 'seed';`. See
[`docs/data-model.md`](docs/data-model.md).

## Deploying

One multi-stage `Dockerfile` serves both supported targets. It ships `db/` and
`scripts/` into the runtime image, so migrations can be run against the deployed
version either way.

`GET /health` pings the database and returns 200 (`ok`) or 503 (`degraded`).
It's the healthcheck for both paths — a healthy response means "can serve real
data", not just "process is up".

### Railway (current target)

```bash
railway init                    # or `railway link` to use an existing project
railway add --database postgres
railway up
```

#### Variables to set on the app service

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | **A reference variable, typed literally** — not a pasted connection string. Substitute the service's real name if it isn't `Postgres`. |
| `ADMIN_API_TOKEN` | `openssl rand -hex 32` | Guards the n8n moderation callback. Unset means that route refuses everything. |
| `N8N_SUBMISSION_WEBHOOK_URL` | your n8n webhook, or leave unset | Unset just means no notification; submissions still queue. |
| `PORT` | **do not set** | Railway injects it. Setting it yourself can break routing. |

> **The one that bites.** Do not copy `DATABASE_URL` out of `.env.example`. It
> points at `localhost`, which inside a Railway container is the app itself, not
> your database — the pre-deploy migration fails and takes the whole deploy with
> it. `${{Postgres.DATABASE_URL}}` resolves to the private-network host
> (`postgres.railway.internal`), which is faster and free; `DATABASE_PUBLIC_URL`
> goes out through the TCP proxy and bills egress, so only use it from your
> laptop.

Give Spitplate its own Postgres service rather than sharing one with another
project: the registry owns its schema, and its migrations run automatically on
every deploy.

#### If the deploy fails

- **Pre-deploy / migrate stage** — almost always `DATABASE_URL`. The script
  prints what's wrong and what to set; check the deploy logs rather than
  guessing.
- **Healthcheck stage** — the app booted but `/health` returned 503, which means
  it reached the container and not the database. Same variable, same fix.
- **Build stage** — a real build error; the logs will name the file.

`railway.json` handles the rest: Dockerfile builder, healthcheck on `/health`,
and `npm run db:migrate` as a pre-deploy step so schema changes land before the
new version takes traffic. Railway injects `PORT` and terminates TLS.

Two things worth knowing before changing them:

- The image is **Debian-slim, not Alpine**, deliberately. Railway's private
  networking is IPv6-only and musl-based images need an extra opt-in flag to
  resolve `*.railway.internal`.
- **Seeding is not part of the deploy.** `db:seed` generates synthetic cars and
  must never run against production. Only `db:migrate` is wired in.

### Local Postgres via compose

The quickest way to get a database without installing one:

```bash
POSTGRES_PASSWORD=spitplate docker compose up -d db
npm run db:setup
```

### Self-hosted VPS (fallback, not the current target)

`docker-compose.yml` brings up app + Postgres together, and `Caddyfile.example`
has the reverse-proxy block for native Caddy. Kept because the same Dockerfile
drives both, but nothing routes through Caddy on Railway.

```bash
POSTGRES_PASSWORD=... docker compose up -d --build
docker compose run --rm app npm run db:migrate
```

## Next

1. **Admin moderation view** — a web queue at `/admin/submissions`. The
   approve/reject write path already exists and is what n8n calls; this is a
   human-facing surface over the same functions, and the first thing here that
   will need real auth rather than a shared token.
2. **Reference pages** — VIN and commission-number decoders, paint codes, as
   markdown content collections.
3. **Sourcing real serial ranges** for `chassis_series`, currently NULL on
   purpose.
4. **Image uploads** — deferred in the handoff, and the main thing owners will
   ask for once the registry has entries.

Known follow-ups: fonts are loaded from Google Fonts and should be self-hosted
before launch (privacy, and one less render-blocking third party); the club
directory has unverified links, which render as plain text rather than dead
links until confirmed; registry search uses a substring `LIKE`, which is a
sequential scan — fine at this size, wants `pg_trgm` if the table grows.

## Design

Palette, type, and the odometer motif carry forward from the original concept
mockup, preserved at [`docs/spitplate-concept.html`](docs/spitplate-concept.html).
Tokens live in `src/styles/global.css`.

The concept's three JS effects were reimplemented rather than ported: the
odometer, stats bars, and gauge are all server-rendered at their true values and
only *animated* by script, so the page carries the same information with
JavaScript disabled, and honours `prefers-reduced-motion`.
