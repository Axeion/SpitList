# Spitplate

An independent registry of surviving Triumph Spitfires, logged by commission and
VIN number.

**Domain:** spitplate.com (registered, not yet live)
**Status:** repo scaffolded; home page renders live from Postgres.

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

Astro 5+ in SSR mode (`@astrojs/node` standalone) over Postgres, with plain SQL
migrations. Reasoning, alternatives considered, and the client-JS budget are in
[`docs/stack-decision.md`](docs/stack-decision.md).

```
src/
  components/   one per page section; styles are scoped per component
  layouts/      Base.astro — head, nav, footer, scroll-reveal
  lib/          db.ts (pool), registry.ts (queries), site.ts (constants)
  data/         static club and resource lists
  pages/        index.astro
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

Multi-stage `Dockerfile` producing a standalone Node server, `docker-compose.yml`
for app + Postgres on the VPS, and `Caddyfile.example` for the native Caddy
reverse proxy.

```bash
POSTGRES_PASSWORD=... docker compose up -d --build
docker compose run --rm app npm run db:migrate
```

Only `127.0.0.1:4321` is published; Caddy terminates TLS in front of it. Moving
to Neon means dropping the `db` service and repointing `DATABASE_URL`.

## Next

In roughly the order the handoff calls for:

1. **Registry browse and search** — filter by era, series, chassis number, year,
   and (where published) location. This is where htmx arrives.
2. **Submission flow** — public add/update form writing to `submissions`, with
   the n8n webhook (`N8N_SUBMISSION_WEBHOOK_URL`) firing a Discord approval
   card on insert.
3. **Admin moderation view** — review the queue, apply an approved submission to
   `cars`.
4. **Reference pages** — VIN and commission-number decoders, paint codes, as
   markdown content collections.

Known follow-ups: fonts are loaded from Google Fonts and should be self-hosted
before launch (privacy, and one less render-blocking third party); the club
directory has unverified links, which render as plain text rather than dead
links until confirmed.

## Design

Palette, type, and the odometer motif carry forward from the original concept
mockup, preserved at [`docs/spitplate-concept.html`](docs/spitplate-concept.html).
Tokens live in `src/styles/global.css`.

The concept's three JS effects were reimplemented rather than ported: the
odometer, stats bars, and gauge are all server-rendered at their true values and
only *animated* by script, so the page carries the same information with
JavaScript disabled, and honours `prefers-reduced-motion`.
