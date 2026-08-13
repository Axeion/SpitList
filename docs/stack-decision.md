# Stack decision

Status: proposed, implemented for the first slice
Date: 2026-08-13

## Constraints (from handoff)

- Hostinger KVM4 VPS, Docker, native Caddy reverse proxy in front
- PostgreSQL, small dataset (tens of thousands of rows at the absolute ceiling)
- n8n for notifications / moderation routing
- "Keep it simple — server-rendered or lightweight SPA is fine. Propose an
  option (e.g. Astro or plain templated HTML + htmx) rather than defaulting to
  a full SPA framework."

## Decision

**Astro 5 in SSR mode (`@astrojs/node`, standalone) + Postgres via the
`postgres` driver + plain SQL migrations.** htmx gets added when the registry
search lands; it is not a dependency yet because nothing needs it yet.

One Node process, one Docker image, Caddy terminates TLS in front of it.

### Why Astro over the alternatives

| Option | Verdict |
| --- | --- |
| **Astro SSR** | Server-rendered HTML by default, ships **zero client JS** unless a component opts in. Has content collections for the markdown reference pages (VIN decoder, paint codes) and API routes for the submission POST — both are requirements, both are free here. |
| Plain templates + htmx (Fastify/Express + Eta) | Fewer moving parts, but the markdown pipeline, asset hashing, and dev server all become hand-rolled. That work is exactly what Astro already does. |
| Next.js / Nuxt / SvelteKit | Heavier than this project demands. A registry that renders tables and a form does not need a React runtime. |
| Static SSG + separate API | Stats must be live from the DB and the registry is searchable — a static build fights both. |

Astro's cost is a build step and a `node_modules` that is large at build time
but not at runtime (the standalone output is a self-contained bundle). That is
an acceptable trade for the markdown and routing machinery.

### Why raw SQL over an ORM

The schema is small, stable, and read-heavy. Migrations are plain `.sql` files
run by a 60-line script (`scripts/migrate.mjs`) that tracks applied versions in
a `schema_migrations` table. Nothing here is complicated enough to earn Drizzle
or Prisma, and plain SQL keeps the schema legible to anyone who wants to audit
what the registry actually stores about an owner.

If the query layer starts sprawling, Drizzle is the migration path — it can
adopt an existing schema without a rewrite.

### Frontend JS budget

The concept mockup's three effects are reimplemented, not ported verbatim:

- **Odometer** — markup is server-rendered with the real digits in place, so
  the count is readable with JS disabled. The script only animates the roll,
  and skips it entirely under `prefers-reduced-motion`.
- **Stats bars / gauge** — server-rendered at their true widths, CSS
  transitions them in. Same no-JS guarantee.
- **Reveal-on-scroll** — one `IntersectionObserver`, and the `.reveal` class is
  applied by script so nothing is invisible without JS.

Total client JS is a single inline module of roughly 40 lines.

## Deployment shape

```
Caddy (native, host)  →  :4321 spitplate app container
                         :5432 postgres container (or Neon)
                         n8n (existing host instance) ← webhook on new submission
```

`docker-compose.yml` runs app + Postgres for a self-hosted VPS. Pointing
`DATABASE_URL` at Neon instead is a one-line change; the compose `db` service
can then be dropped. At this data size self-hosted Postgres on the KVM4 is
simpler and cheaper — Neon earns its keep only if we want branching for
staging.

`Caddyfile.example` has the reverse-proxy block.

## Open, deliberately deferred

- htmx for the registry filter (arrives with the registry page)
- n8n webhook fires on `submissions` insert (arrives with the submission flow)
- Image uploads, accounts, payments — out of scope for v1 per the handoff
