# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
# Debian-slim rather than Alpine on purpose: Railway's private networking is
# IPv6-only, and musl-based images need an extra opt-in flag to resolve
# *.railway.internal. glibc sidesteps that whole class of DNS failure, and the
# image is still small enough not to care.
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Drop dev dependencies before they get copied forward.
RUN npm prune --omit=dev

# ---- runtime --------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
# Migrations and seeds ship with the image so `docker compose run app npm run
# db:migrate` works against the deployed version.
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts

USER node
EXPOSE 4321

# Mirrors what Railway's healthcheckPath checks, for the compose/VPS path.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "./dist/server/entry.mjs"]
