import type { APIRoute } from 'astro';
import { db } from '../lib/db';

export const prerender = false;

/**
 * Liveness + readiness in one. The registry is useless without Postgres, so a
 * healthy response means "can serve real data", not merely "process is up" —
 * that is what makes it safe for a platform healthcheck to gate a deploy on.
 *
 * Reference data is part of that contract, and learning it the hard way is why
 * this check counts rows instead of running `select 1`. A database with the
 * schema but no `model_eras` serves every page with a 200 and quietly cannot
 * accept a single car: the model dropdown on /submit is built from that table,
 * so an empty one leaves a visitor staring at a form they cannot complete. The
 * old check called that healthy.
 *
 * A deploy blocked by this is a deploy that would have shipped an unusable
 * site. `preDeployCommand` runs `db:deploy`, so reference data is applied
 * before this ever runs — if it is missing here, the seed step was skipped.
 *
 * The underlying error is logged but never returned: connection failures carry
 * internal hostnames and usernames.
 */
export const GET: APIRoute = async () => {
  const headers = {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  };

  let eras = 0;
  let series = 0;

  try {
    const sql = db();
    const [row] = await sql`
      select
        (select count(*) from model_eras) as eras,
        (select count(*) from chassis_series) as series
    `;
    eras = Number(row.eras);
    series = Number(row.series);
  } catch (err) {
    console.error('[health] database check failed:', err);
    return new Response(JSON.stringify({ status: 'degraded', database: 'down' }), {
      status: 503,
      headers,
    });
  }

  if (eras === 0) {
    console.error(
      '[health] model_eras is empty — reference data has not been applied. ' +
        'Run `npm run db:reference` against this database.'
    );
    return new Response(
      JSON.stringify({
        status: 'degraded',
        database: 'up',
        reference: 'missing',
        eras,
        series,
      }),
      { status: 503, headers }
    );
  }

  return new Response(
    JSON.stringify({ status: 'ok', database: 'up', reference: 'ok', eras, series }),
    { status: 200, headers }
  );
};
