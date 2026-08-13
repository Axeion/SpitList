#!/usr/bin/env node
/**
 * Seeds reference data (real production figures) and a set of PLACEHOLDER cars
 * so the stats surfaces have something live to read.
 *
 * The placeholder cars are synthetic. They carry source = 'seed' and are
 * deleted and regenerated on every run, so nothing real can be clobbered by
 * re-seeding and nothing synthetic can survive into production unnoticed:
 *
 *     delete from cars where source = 'seed';
 *
 * No owner names are generated — the seed sets locations and visibility flags
 * only, so no invented person ever appears in the registry.
 */
import { readFile } from 'node:fs/promises';
import { connect } from './_client.mjs';

const TOTAL_BY_ERA = { mk1: 24, mk2: 21, mk3: 34, mk4: 31, 1500: 76 };

// Placeholder serial bands. These are NOT sourced factory ranges — see
// docs/data-model.md. They exist only to make synthetic numbers look plausible.
const SERIAL_BANDS = {
  'fc-mk1': [1, 44500],
  'fc-mk2': [50001, 94800],
  'fd-mk3': [1, 51200],
  'fh-mk4': [3, 64900],
  'fm-1500': [1, 58000],
  'fh-1500': [65000, 130000],
  'vin-1500': [400001, 416000],
};

const SERIES_BY_ERA = {
  mk1: ['fc-mk1'],
  mk2: ['fc-mk2'],
  mk3: ['fd-mk3'],
  mk4: ['fh-mk4'],
  1500: ['fm-1500', 'fm-1500', 'fh-1500', 'fh-1500', 'vin-1500'],
};

const COLOURS = [
  ['Signal Red', '32'], ['British Racing Green', '25'], ['Damson', '54'],
  ['Sapphire Blue', '65'], ['Jasmine Yellow', '64'], ['White', '19'],
  ['Pimento', '72'], ['Mimosa', '84'], ['Java', '75'], ['Sienna', '82'],
  ['Carmine Red', '117'], ['Inca Yellow', '76'], ['Tahiti Blue', '126'],
  ['Russet Brown', '86'], ['Delft', '106'], ['Topaz', '96'],
];

// [country, region, weight] — weighted toward the markets the car sold into.
const PLACES = [
  ['US', 'California', 14], ['US', 'Ohio', 7], ['US', 'Texas', 6],
  ['US', 'Washington', 5], ['US', 'New York', 5], ['US', 'Colorado', 4],
  ['GB', 'Hampshire', 8], ['GB', 'Yorkshire', 6], ['GB', 'Devon', 4],
  ['GB', 'Lanarkshire', 3], ['CA', 'Ontario', 5], ['CA', 'British Columbia', 3],
  ['AU', 'Victoria', 4], ['AU', 'New South Wales', 3], ['NZ', 'Auckland', 2],
  ['DE', 'Bayern', 4], ['DE', 'Nordrhein-Westfalen', 3], ['NL', 'Gelderland', 3],
  ['FR', 'Rhône-Alpes', 3], ['FR', 'Bretagne', 2], ['BE', 'Vlaanderen', 2],
  ['SE', 'Skåne', 2], ['DK', 'Midtjylland', 2], ['CH', 'Bern', 2],
  ['IT', 'Lombardia', 2], ['FI', 'Uusimaa', 1], ['PT', 'Lisboa', 1],
  ['GR', 'Attica', 1], ['PE', 'Lima', 1],
];

const MODS = [
  'GT6 2.0 straight-six fitted — "Spit 6" conversion, commission plate intact.',
  'Ford Essex V6 swap by a previous owner; original engine retained.',
  'Rover V8 conversion, uprated brakes and diff.',
  'Five-speed gearbox conversion, otherwise standard.',
];

/** mulberry32 — small deterministic PRNG so re-seeding gives the same set. */
function rng(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(19621031); // Spitfire launch, near enough
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const chance = (p) => rand() < p;

function pickWeighted(rows) {
  const total = rows.reduce((sum, r) => sum + r.at(-1), 0);
  let n = rand() * total;
  for (const row of rows) {
    n -= row.at(-1);
    if (n <= 0) return row;
  }
  return rows.at(-1);
}

const sql = connect();

try {
  console.log('Seeding reference data...');
  await sql.unsafe(await readFile('db/seed/0001_reference.sql', 'utf8'));

  const eras = Object.fromEntries(
    (await sql`select code, year_from, year_to, engine_cc from model_eras`).map((e) => [e.code, e])
  );
  const seriesYears = Object.fromEntries(
    (await sql`select id, prefix, year_from, year_to from chassis_series`).map((s) => [s.id, s])
  );

  const removed = await sql`delete from cars where source = 'seed' returning id`;
  if (removed.length) console.log(`Cleared ${removed.length} previous placeholder car(s).`);

  const rows = [];
  let n = 0;

  for (const [eraCode, count] of Object.entries(TOTAL_BY_ERA)) {
    const era = eras[eraCode];
    for (let i = 0; i < count; i++) {
      const seriesId = pick(SERIES_BY_ERA[eraCode]);
      const series = seriesYears[seriesId];
      const [lo, hi] = SERIAL_BANDS[seriesId];
      const serial = int(lo, hi);

      const isVin = series.prefix === 'VIN';
      const suffix = isVin ? null : pick(['L', 'L', 'LO', 'O', null, null]);
      const prefix = series.prefix;
      const number = isVin
        ? `TFADW${serial}`
        : `${prefix}${serial}${suffix ?? ''}`;

      const yearFrom = series.year_from ?? era.year_from;
      const yearTo = series.year_to ?? era.year_to;
      const modelYear = int(yearFrom, yearTo);

      const [country, region] = pickWeighted(PLACES);
      const [colour, colourCode] = pick(COLOURS);
      const modified = chance(0.08);

      // Spread intake across ~30 months so the intake view has a shape.
      const listedDaysAgo = int(1, 900);

      n += 1;
      rows.push({
        // public_ref comes from the car_public_ref_seq default, same as a real
        // submission, so seeded and submitted refs can never collide.
        era_code: eraCode,
        series_id: seriesId,
        chassis_number: isVin ? number : `${prefix} ${serial}${suffix ? ` ${suffix}` : ''}`,
        chassis_normalized: number.toUpperCase(),
        chassis_prefix: prefix,
        chassis_serial: serial,
        chassis_suffix: suffix,
        model_year: modelYear,
        build_year: chance(0.3) ? modelYear - 1 : modelYear,
        engine_cc: era.engine_cc,
        colour,
        colour_code: colourCode,
        is_modified: modified,
        modification_notes: modified ? pick(MODS) : null,
        owner_country: country,
        owner_region: region,
        show_location: chance(0.55),
        show_owner_name: false,
        status: chance(0.03) ? 'archived' : 'published',
        source: 'seed',
        first_listed_at: new Date(Date.now() - listedDaysAgo * 86400000),
      });
    }
  }

  await sql`insert into cars ${sql(rows)}`;

  const [totals] = await sql`select * from registry_totals`;
  console.log(`\nInserted ${rows.length} placeholder cars.`);
  console.log(`Registry now reads: ${totals.registered} published of ${totals.units_built} built (${totals.share_pct}%).`);
} catch (err) {
  console.error(`\nSeed failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
