#!/usr/bin/env node
/**
 * Applies the reference data in db/seed/*.sql, in filename order. Nothing else.
 *
 * This is the half of the old `db:seed` that is safe in production, and it runs
 * on every deploy. The distinction matters:
 *
 *   db/seed/*.sql       real production history — build totals, commission
 *                       series, sourced serial ranges. Idempotent upserts.
 *                       Ships to production.
 *
 *   scripts/seed.mjs    the above, plus ~190 synthetic placeholder cars so the
 *                       stats surfaces have something to read in development.
 *                       MUST NOT run against production.
 *
 * Those two were one command until the chassis_ranges work, which exposed the
 * problem: migrations created the table on deploy and nothing ever filled it,
 * because the only thing that could also would have injected fake cars into the
 * live registry.
 *
 * Everything in db/seed/ must therefore stay idempotent and stay real. If you
 * add a file there, it runs against production on the next deploy.
 */
import { readdir, readFile } from 'node:fs/promises';
import { connect, explainConnectionError } from './_client.mjs';

const sql = connect();

try {
  const files = (await readdir('db/seed')).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    await sql.unsafe(await readFile(`db/seed/${file}`, 'utf8'));
    console.log(`applied  ${file}`);
  }

  const [counts] = await sql`
    select
      (select count(*) from model_eras) as eras,
      (select count(*) from chassis_series) as series,
      (select count(*) from chassis_ranges) as ranges,
      (select count(*) from chassis_ranges where verified) as verified
  `;

  console.log(
    `\n${files.length} file(s). ` +
      `${counts.eras} eras, ${counts.series} series, ` +
      `${counts.ranges} ranges (${counts.verified} two-source verified).`
  );
} catch (err) {
  console.error(`\nReference data failed: ${err.message}`);
  const hint = explainConnectionError(err);
  if (hint) console.error(`\n${hint}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
