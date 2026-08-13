import type { APIRoute } from 'astro';
import { db } from '../lib/db';

export const prerender = false;

/**
 * Liveness + readiness in one. The registry is useless without Postgres, so a
 * healthy response means "can serve real data", not merely "process is up" —
 * that is what makes it safe for a platform healthcheck to gate a deploy on.
 *
 * The underlying error is logged but never returned: connection failures carry
 * internal hostnames and usernames.
 */
export const GET: APIRoute = async () => {
  const headers = {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  };

  try {
    await db()`select 1`;
    return new Response(JSON.stringify({ status: 'ok', database: 'up' }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('[health] database check failed:', err);
    return new Response(JSON.stringify({ status: 'degraded', database: 'down' }), {
      status: 503,
      headers,
    });
  }
};
