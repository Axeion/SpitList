#!/usr/bin/env node
/**
 * Applies db/migrations/*.sql in filename order, once each, inside a
 * transaction per file. Applied versions are tracked in schema_migrations.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connect } from './_client.mjs';

const DIR = 'db/migrations';

const sql = connect();

try {
  await sql`
    create table if not exists schema_migrations (
      version     text primary key,
      applied_at  timestamptz not null default now()
    )
  `;

  const applied = new Set(
    (await sql`select version from schema_migrations`).map((r) => r.version)
  );

  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();
  let ran = 0;

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;

    const body = await readFile(join(DIR, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (version) values (${version})`;
    });

    console.log(`applied  ${version}`);
    ran += 1;
  }

  console.log(ran ? `\n${ran} migration(s) applied.` : 'Already up to date.');
} catch (err) {
  console.error(`\nMigration failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
