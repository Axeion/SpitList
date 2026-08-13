import { existsSync } from 'node:fs';
import postgres from 'postgres';

/**
 * Scripts run outside Astro, so they load .env themselves. Node 22 has this
 * built in — no dotenv dependency.
 */
export function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

export function connect() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
    process.exit(1);
  }
  return postgres(url, { onnotice: () => {} });
}

/**
 * Turns a connection failure into something actionable. This runs as Railway's
 * pre-deploy step, where the whole deploy fails on it, and the default
 * "ECONNREFUSED 127.0.0.1:5432" gives no hint that the real problem is a
 * localhost URL copied from .env.example into a container.
 */
export function explainConnectionError(err) {
  if (err?.code !== 'ECONNREFUSED' && err?.code !== 'ENOTFOUND') return null;

  let host = '(unparseable)';
  try {
    host = new URL(process.env.DATABASE_URL ?? '').hostname;
  } catch {
    /* keep the placeholder */
  }

  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_SERVICE_ID);

  if (isLocal && onRailway) {
    return [
      `DATABASE_URL points at "${host}", which inside a Railway container is the`,
      'app itself, not your database.',
      '',
      'Set it to the Postgres service reference variable instead:',
      '',
      '    DATABASE_URL=${{Postgres.DATABASE_URL}}',
      '',
      "(substitute the service's real name if it is not `Postgres`).",
    ].join('\n');
  }

  if (isLocal) {
    return `Nothing is listening on ${host}. Start Postgres, or run: docker compose up -d db`;
  }

  return `Could not reach "${host}". Check DATABASE_URL and that the database is running.`;
}
