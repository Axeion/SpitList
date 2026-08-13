import postgres from 'postgres';

let client: postgres.Sql | undefined;

/**
 * Lazy singleton. Nothing connects at build time — the pool opens on the first
 * request that actually needs it.
 *
 * If the database is unreachable the query throws and the request 500s. That is
 * deliberate: a registry that quietly renders zeroes when Postgres is down is
 * worse than one that visibly fails.
 */
export function db(): postgres.Sql {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. Copy .env.example to .env and point it at Postgres.'
      );
    }
    client = postgres(url, {
      max: 8,
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: () => {},
    });
  }
  return client;
}

/** postgres.js returns bigint and numeric as strings to protect precision. */
export const num = (value: string | number | null): number => Number(value ?? 0);
