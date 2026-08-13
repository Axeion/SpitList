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
