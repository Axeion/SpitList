#!/usr/bin/env node
/**
 * Bulk CSV import.
 *
 *   npm run import -- data.csv --source "TSSC roster 2026"          # dry run
 *   npm run import -- data.csv --source "TSSC roster 2026" --commit
 *   npm run import -- data.csv --source "..." --commit --auto-approve
 *   npm run import -- --rollback import-2026-08-13-a3f9
 *
 * Dry run is the default and writes nothing. Bulk-loading someone else's
 * spreadsheet into a registry is the single easiest way to poison it, so the
 * safe mode is the one you get without asking.
 *
 * Rows land in `submissions`, not `cars` — the same queue the public form feeds,
 * with the same validation, the same duplicate detection, and the same
 * merge-not-replace behaviour for chassis numbers already on file. No Discord
 * notification is sent: that fires from the web form, not from here, which is
 * what stops a 4,000-row import from posting 4,000 cards.
 */
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import postgres from 'postgres';
import { connect, explainConnectionError } from './_client.mjs';
import { detectColumns, inferEraFromPrefix, normaliseEra, rowToFormData } from '../src/lib/import.ts';
import { validateSubmission } from '../src/lib/validation.ts';
import { parseChassis } from '../src/lib/chassis.ts';

interface Args {
  file?: string;
  source?: string;
  batch?: string;
  commit: boolean;
  autoApprove: boolean;
  rollback?: string;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { commit: false, autoApprove: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--commit') args.commit = true;
    else if (arg === '--auto-approve') args.autoApprove = true;
    else if (arg === '--source') args.source = argv[++i];
    else if (arg === '--batch') args.batch = argv[++i];
    else if (arg === '--rollback') args.rollback = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (!arg.startsWith('-')) args.file = arg;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const sql = connect();

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

try {
  if (args.rollback) {
    await rollback(args.rollback);
  } else {
    await runImport();
  }
} catch (err: any) {
  console.error(`\nImport failed: ${err.message}`);
  const hint = explainConnectionError(err);
  if (hint) console.error(`\n${hint}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}

async function runImport() {
  if (!args.file) {
    console.error('Usage: npm run import -- <file.csv> --source "where this came from" [--commit]');
    process.exitCode = 1;
    return;
  }
  if (!args.source) {
    // Provenance is not optional. An imported row with no recorded origin is
    // indistinguishable from one an owner sent in.
    console.error('--source is required: record where this data came from.');
    process.exitCode = 1;
    return;
  }

  const batch = args.batch ?? `import-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`;

  const raw = await readFile(args.file, 'utf8');
  const rows: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });

  if (rows.length === 0) {
    console.log('No rows found.');
    return;
  }

  const headers = Object.keys(rows[0]);
  const mapping = detectColumns(headers);

  console.log(`\n${bold('Columns')}`);
  for (const [header, field] of Object.entries(mapping.matched)) {
    console.log(`  ${header.padEnd(24)} -> ${field}`);
  }
  if (mapping.ignored.length) {
    console.log(`  ${dim(`ignored: ${mapping.ignored.join(', ')}`)}`);
  }
  if (!Object.values(mapping.matched).includes('chassis_number')) {
    console.error('\nNo chassis-number column found. Nothing can be imported without one.');
    process.exitCode = 1;
    return;
  }

  // Reference data for era resolution and validation.
  const eras = await sql`select code from model_eras order by ordinal`;
  const series = await sql`select id, prefix, era_code from chassis_series`;

  // Ranges, loaded once and checked in memory. A roster of a few thousand rows
  // against a handful of ranges does not need a query per row.
  const rangeRows = await sql`
    select s.prefix, s.era_code, r.serial_from, r.serial_to
    from chassis_ranges r
    join chassis_series s on s.id = r.series_id
  `;
  type Range = { from: number; to: number | null; eraCode: string };
  const rangesByPrefix = new Map<string, Range[]>();
  for (const r of rangeRows) {
    const list = rangesByPrefix.get(r.prefix as string) ?? [];
    list.push({
      from: Number(r.serial_from),
      to: r.serial_to === null ? null : Number(r.serial_to),
      eraCode: r.era_code as string,
    });
    rangesByPrefix.set(r.prefix as string, list);
  }

  /**
   * Advisory only — never a problem, never a reason to skip a row.
   *
   * Checked against the model the row claims, not just the prefix: FH runs from
   * the MkIV into the 1500, so a MkIV number filed as a 1500 is inside a real FH
   * range and still wrong. That mismatch, repeated down a file, is what a
   * mangled model column looks like — which is the case worth catching before
   * a few thousand rows go into the queue.
   *
   * One or two out-of-range cars in a thousand is the normal state of a
   * forty-year-old record and means nothing.
   */
  function outOfRange(prefix: string | null, serial: number | null, eraCode: string): boolean {
    if (!prefix || serial === null) return false;
    const list = rangesByPrefix.get(prefix.toUpperCase());
    if (!list?.length) return false;
    const forEra = list.filter((r) => r.eraCode === eraCode);
    if (!forEra.length) return false;
    return !forEra.some((r) => serial >= r.from && (r.to === null || serial <= r.to));
  }

  const eraCodes = eras.map((e) => e.code as string);
  const seriesByEra: Record<string, string[]> = {};
  const seriesByPrefix = new Map<string, string[]>();
  for (const s of series) {
    (seriesByEra[s.era_code] ??= []).push(s.id);
    const list = seriesByPrefix.get(s.prefix) ?? [];
    if (!list.includes(s.era_code)) list.push(s.era_code);
    seriesByPrefix.set(s.prefix, list);
  }

  const eraHeader = Object.entries(mapping.matched).find(([, f]) => f === 'era_code')?.[0];
  const limit = args.limit ?? rows.length;

  const problems: string[] = [];
  const seen = new Map<string, number>();
  const prepared: {
    line: number;
    form: FormData;
    normalized: string;
    chassis: string;
    outOfRange: boolean;
  }[] = [];

  for (const [index, row] of rows.slice(0, limit).entries()) {
    const line = index + 2; // 1-based, plus the header row

    const chassisHeader = Object.entries(mapping.matched).find(([, f]) => f === 'chassis_number')![0];
    const chassis = (row[chassisHeader] ?? '').trim();
    if (!chassis) {
      problems.push(`line ${line}: no chassis number`);
      continue;
    }

    // Era: from the column if present and recognised, otherwise inferred from
    // the prefix when that is unambiguous.
    let eraCode: string | null = null;
    const rawEra = eraHeader ? (row[eraHeader] ?? '').trim() : '';
    if (rawEra) {
      eraCode = normaliseEra(rawEra);
      if (!eraCode) problems.push(`line ${line}: unrecognised model "${rawEra}"`);
    }
    eraCode ??= inferEraFromPrefix(chassis, seriesByPrefix);
    if (!eraCode) {
      problems.push(`line ${line}: cannot determine model for "${chassis}"`);
      continue;
    }

    const form = rowToFormData(row, mapping, eraCode);
    const result = validateSubmission(form, { eraCodes, seriesByEra });
    if (!result.ok) {
      const detail = Object.entries(result.errors).map(([f, m]) => `${f}: ${m}`).join('; ');
      problems.push(`line ${line} (${chassis}): ${detail}`);
      continue;
    }

    const normalized = result.payload.chassisNormalized;
    const firstSeen = seen.get(normalized);
    if (firstSeen) {
      problems.push(`line ${line} (${chassis}): duplicate of line ${firstSeen} in this file`);
      continue;
    }
    seen.set(normalized, line);
    prepared.push({
      line,
      form,
      normalized,
      chassis,
      outOfRange: outOfRange(
        result.payload.chassisPrefix,
        result.payload.chassisSerial,
        result.payload.eraCode
      ),
    });
  }

  // Which of these already exist? One query, not one per row.
  const existing = prepared.length
    ? await sql`
        select chassis_normalized, public_ref
        from cars
        where chassis_normalized in ${sql(prepared.map((p) => p.normalized))}
      `
    : [];
  const existingByChassis = new Map(existing.map((r) => [r.chassis_normalized as string, r.public_ref as string]));

  const creates = prepared.filter((p) => !existingByChassis.has(p.normalized));
  const updates = prepared.filter((p) => existingByChassis.has(p.normalized));

  console.log(`\n${bold('Summary')}`);
  console.log(`  rows read       ${rows.length}`);
  console.log(`  usable          ${prepared.length}`);
  console.log(`  new cars        ${creates.length}`);
  console.log(`  corrections     ${updates.length}  ${dim('(chassis already registered)')}`);
  console.log(`  problems        ${problems.length}`);

  const flagged = prepared.filter((p) => p.outOfRange);
  if (flagged.length) {
    const pct = Math.round((flagged.length / prepared.length) * 100);
    console.log(
      `  out of range    ${flagged.length}  ${dim(`(${pct}% — advisory, these still import)`)}`
    );
    console.log(`\n${bold('Out of range')} ${dim(`(first ${Math.min(flagged.length, 10)})`)}`);
    for (const p of flagged.slice(0, 10)) {
      console.log(`  line ${p.line}: ${p.chassis}`);
    }
    if (flagged.length > 10) console.log(`  ${dim(`... and ${flagged.length - 10} more`)}`);
    if (pct >= 25) {
      console.log(
        `  ${dim('a quarter or more of the file is out of range — check the column mapping before committing')}`
      );
    }
  }

  if (problems.length) {
    console.log(`\n${bold('Problems')} ${dim(`(first ${Math.min(problems.length, 20)})`)}`);
    for (const problem of problems.slice(0, 20)) console.log(`  ${problem}`);
    if (problems.length > 20) console.log(`  ${dim(`... and ${problems.length - 20} more`)}`);
  }

  if (!args.commit) {
    console.log(`\n${bold('Dry run — nothing written.')}`);
    console.log(`Re-run with ${bold('--commit')} to file ${prepared.length} row(s) into the review queue.`);
    return;
  }

  console.log(`\nWriting batch ${bold(batch)} ...`);
  let filed = 0;
  let approved = 0;

  for (const item of prepared) {
    const result = validateSubmission(item.form, { eraCodes, seriesByEra });
    if (!result.ok) continue; // already reported above

    const targetRef = existingByChassis.get(item.normalized);
    const [target] = targetRef
      ? await sql`select id from cars where chassis_normalized = ${item.normalized}`
      : [];

    const [submission] = await sql`
      insert into submissions (
        kind, target_car_id, payload, submitter_name, submitter_note, import_batch
      ) values (
        ${target ? 'update' : 'create'}, ${target?.id ?? null},
        ${sql.json(result.payload as any)},
        ${args.source}, ${`Bulk import: ${args.source}`}, ${batch}
      )
      returning id
    `;
    filed += 1;

    if (args.autoApprove) {
      const outcome = await applyImmediately(submission.id, batch, args.source!);
      if (outcome) approved += 1;
    }

    if (filed % 250 === 0) console.log(`  ${filed}/${prepared.length}`);
  }

  console.log(`\n${bold('Done.')}`);
  console.log(`  filed     ${filed} submission(s)`);
  if (args.autoApprove) console.log(`  applied   ${approved} to the registry`);
  else console.log(`  ${dim('pending review at /admin/submissions')}`);
  console.log(`\nUndo with:  npm run import -- --rollback ${batch}`);
}

/**
 * Applies an imported submission straight through. Only reachable behind
 * --auto-approve, which is a human deciding once for a whole batch from a source
 * they trust, rather than clicking through thousands of identical cards.
 */
async function applyImmediately(submissionId: string, batch: string, source: string): Promise<boolean> {
  try {
    return await sql.begin(async (tx: postgres.TransactionSql) => {
      const [submission] = await tx`
        select id, kind, target_car_id, payload from submissions
        where id = ${submissionId} and status = 'pending'
        for update
      `;
      if (!submission) return false;

      const payload = submission.payload;
      const provided: string[] = Array.isArray(payload.provided) ? payload.provided : [];

      const COLUMNS: Record<string, string> = {
        chassisNumber: 'chassis_number', chassisNormalized: 'chassis_normalized',
        chassisPrefix: 'chassis_prefix', chassisSerial: 'chassis_serial',
        chassisSuffix: 'chassis_suffix', eraCode: 'era_code', seriesId: 'series_id',
        modelYear: 'model_year', buildYear: 'build_year',
        firstRegisteredOn: 'first_registered_on', engineCc: 'engine_cc',
        engineNumber: 'engine_number', colour: 'colour', colourCode: 'colour_code',
        commissionPlatePresent: 'commission_plate_present', isModified: 'is_modified',
        modificationNotes: 'modification_notes', notes: 'notes',
        ownerName: 'owner_name', ownerCountry: 'owner_country',
        ownerRegion: 'owner_region', ownerCity: 'owner_city',
        showOwnerName: 'show_owner_name', showLocation: 'show_location',
      };

      const columns: Record<string, unknown> = {};
      for (const key of provided) {
        const column = COLUMNS[key];
        if (column) columns[column] = payload[key];
      }
      if (Object.keys(columns).length === 0) return false;

      let carId: string;
      if (submission.kind === 'update' && submission.target_car_id) {
        const [updated] = await tx`
          update cars set ${tx(columns)} where id = ${submission.target_car_id}
          returning id
        `;
        if (!updated) return false;
        carId = updated.id;
      } else {
        const [created] = await tx`
          insert into cars ${tx({ ...columns, source: 'import', import_batch: batch })}
          returning id
        `;
        carId = created.id;
      }

      await tx`
        update submissions
        set status = 'approved', reviewed_at = now(),
            reviewed_by = ${`import: ${source}`}, resulting_car_id = ${carId}
        where id = ${submissionId}
      `;
      return true;
    });
  } catch (err: any) {
    if (err?.code === '23505') return false; // raced with another row
    throw err;
  }
}

async function rollback(batch: string) {
  const [counts] = await sql`
    select
      (select count(*) from submissions where import_batch = ${batch}) as submissions,
      (select count(*) from cars where import_batch = ${batch}) as cars,
      (select count(*) from cars where import_batch = ${batch} and updated_at > created_at) as touched
  `;

  console.log(`\n${bold(`Batch ${batch}`)}`);
  console.log(`  submissions  ${counts.submissions}`);
  console.log(`  cars         ${counts.cars}`);
  console.log(`  of which edited since import: ${counts.touched}`);

  if (Number(counts.submissions) === 0 && Number(counts.cars) === 0) {
    console.log('\nNothing to roll back.');
    return;
  }

  // Cars corrected since the import are left alone: undoing them would discard
  // work someone did after the fact, which is worse than leaving a stray row.
  const removed = await sql`
    delete from cars
    where import_batch = ${batch} and updated_at <= created_at
    returning public_ref
  `;
  const submissions = await sql`
    delete from submissions where import_batch = ${batch} returning id
  `;

  console.log(`\n${bold('Rolled back.')}`);
  console.log(`  removed ${removed.length} car(s) and ${submissions.length} submission(s)`);
  if (Number(counts.touched) > 0) {
    console.log(`  ${dim(`kept ${counts.touched} car(s) edited since import — review manually`)}`);
  }
}
