import { db, num } from './db';
import { normalizeChassis } from './chassis';

export interface EraStat {
  code: string;
  ordinal: number;
  name: string;
  shortLabel: string;
  yearFrom: number;
  yearTo: number;
  engineCc: number | null;
  blurb: string | null;
  unitsBuilt: number;
  registered: number;
  sharePct: number;
}

export interface RegistryTotals {
  unitsBuilt: number;
  registered: number;
  archived: number;
  sharePct: number;
  lastListedAt: Date | null;
}

export interface SeriesNote {
  id: string;
  prefix: string;
  label: string;
  market: string;
  yearFrom: number | null;
  yearTo: number | null;
  notes: string | null;
}

export async function getEraStats(): Promise<EraStat[]> {
  const rows = await db()`
    select code, ordinal, name, short_label, year_from, year_to,
           engine_cc, blurb, units_built, registered, share_pct
    from registry_stats_by_era
    order by ordinal
  `;

  return rows.map((r) => ({
    code: r.code,
    ordinal: num(r.ordinal),
    name: r.name,
    shortLabel: r.short_label,
    yearFrom: num(r.year_from),
    yearTo: num(r.year_to),
    engineCc: r.engine_cc === null ? null : num(r.engine_cc),
    blurb: r.blurb,
    unitsBuilt: num(r.units_built),
    registered: num(r.registered),
    sharePct: num(r.share_pct),
  }));
}

export async function getTotals(): Promise<RegistryTotals> {
  const [r] = await db()`select * from registry_totals`;

  return {
    unitsBuilt: num(r.units_built),
    registered: num(r.registered),
    archived: num(r.archived),
    sharePct: num(r.share_pct),
    lastListedAt: r.last_listed_at ?? null,
  };
}

/**
 * Mean cars added per month over the last twelve months, ignoring the current
 * partial month. Drives the "about N new cars join every month" line, which was
 * a hardcoded "20" in the concept.
 */
export async function getMonthlyIntake(): Promise<number | null> {
  const [r] = await db()`
    select round(avg(added)) as avg_added
    from registry_intake_by_month
    where month >= date_trunc('month', now()) - interval '12 months'
      and month <  date_trunc('month', now())
  `;
  return r?.avg_added == null ? null : num(r.avg_added);
}

/** The FH / FM / VIN explainer cards, read from reference data. */
export async function getSeriesNotes(eraCode = '1500'): Promise<SeriesNote[]> {
  const rows = await db()`
    select id, prefix, label, market, year_from, year_to, notes
    from chassis_series
    where era_code = ${eraCode}
    order by ordinal
  `;

  return rows.map((r) => ({
    id: r.id,
    prefix: r.prefix,
    label: r.label,
    market: r.market,
    yearFrom: r.year_from === null ? null : num(r.year_from),
    yearTo: r.year_to === null ? null : num(r.year_to),
    notes: r.notes,
  }));
}

export interface RangeMatch {
  seriesId: string;
  seriesLabel: string;
  seriesMarket: string;
  eraCode: string;
  eraLabel: string;
  eraName: string;
  serialFrom: number;
  /** Null where the source gives an opening number but no close. */
  serialTo: number | null;
  modelYear: number | null;
  note: string | null;
  verified: boolean;
  source: string;
  sourceUrl: string | null;
}

export interface RangeLookup {
  /** Ranges containing the serial. Empty is a meaningful answer, not a failure. */
  matches: RangeMatch[];
  /**
   * True when the prefix has ranges on record but none contain this serial —
   * the number sits in a gap, or past the end. Distinguishes "we looked and it
   * isn't there" from "we have nothing to look in".
   */
  hasRangesForPrefix: boolean;
}

/**
 * Which series and era a commission serial falls into.
 *
 * Returns every match rather than picking one: a prefix can legitimately span
 * two eras (FH runs from the MkIV straight through the 1500), and the caller
 * has to show that rather than guess. Ordered so a verified match is offered
 * before an unverified one.
 *
 * Kept here rather than in decode.ts, which takes no database and shouldn't
 * start.
 */
export async function resolveSerial(prefix: string, serial: number): Promise<RangeLookup> {
  const sql = db();
  const p = prefix.trim().toUpperCase();
  if (!p || !Number.isInteger(serial) || serial < 0) {
    return { matches: [], hasRangesForPrefix: false };
  }

  const rows = await sql`
    select r.series_id, s.label as series_label, s.market as series_market,
           s.era_code, e.short_label as era_label, e.name as era_name,
           r.serial_from, r.serial_to, r.model_year, r.note,
           r.verified, r.source, r.source_url,
           ${serial} between r.serial_from and coalesce(r.serial_to, 2147483647) as hit
    from chassis_ranges r
    join chassis_series s on s.id = r.series_id
    join model_eras e on e.code = s.era_code
    where s.prefix = ${p}
    order by r.verified desc, e.ordinal, r.serial_from
  `;

  return {
    hasRangesForPrefix: rows.length > 0,
    matches: rows
      .filter((r) => r.hit)
      .map((r) => ({
        seriesId: r.series_id,
        seriesLabel: r.series_label,
        seriesMarket: r.series_market,
        eraCode: r.era_code,
        eraLabel: r.era_label,
        eraName: r.era_name,
        serialFrom: num(r.serial_from),
        serialTo: r.serial_to === null ? null : num(r.serial_to),
        modelYear: r.model_year === null ? null : num(r.model_year),
        note: r.note,
        verified: r.verified,
        source: r.source,
        sourceUrl: r.source_url,
      })),
  };
}

// ---------------------------------------------------------------------------
// Registry browse / search
//
// PRIVACY BOUNDARY. Everything below is public-facing. Owner identity is
// resolved here, once, so no page or component can accidentally render a
// private field:
//
//   * owner_name       only when show_owner_name
//   * location fields  only when show_location
//   * contact_email    never selected at all
//
// Do not add a "raw car" query for public pages. If a field needs exposing,
// it gets exposed here or not at all.
// ---------------------------------------------------------------------------

export interface CarListing {
  publicRef: string;
  eraCode: string;
  eraLabel: string;
  seriesId: string | null;
  seriesPrefix: string | null;
  chassisNumber: string;
  modelYear: number | null;
  engineCc: number | null;
  colour: string | null;
  isModified: boolean;
  status: string;
  /** Null unless the owner published it. */
  ownerName: string | null;
  /** Null unless the owner published their location. */
  location: string | null;
  country: string | null;
}

export interface CarDetail extends CarListing {
  chassisPrefix: string | null;
  chassisSerial: number | null;
  chassisSuffix: string | null;
  seriesLabel: string | null;
  buildYear: number | null;
  firstRegisteredOn: Date | null;
  engineNumber: string | null;
  colourCode: string | null;
  commissionPlatePresent: boolean;
  modificationNotes: string | null;
  notes: string | null;
  firstListedAt: Date;
  updatedAt: Date;
}

export interface SearchFilters {
  q?: string;
  era?: string;
  series?: string;
  country?: string;
  yearFrom?: number;
  yearTo?: number;
  modifiedOnly?: boolean;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  cars: CarListing[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const PAGE_SIZE = 25;

/**
 * `show_location` gates the whole location block, so the pieces are assembled
 * only after that check passes.
 */
function toLocation(row: Record<string, any>): string | null {
  if (!row.show_location) return null;
  const parts = [row.owner_city, row.owner_region, row.owner_country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function toListing(row: Record<string, any>): CarListing {
  return {
    publicRef: row.public_ref,
    eraCode: row.era_code,
    eraLabel: row.era_label,
    seriesId: row.series_id ?? null,
    seriesPrefix: row.series_prefix ?? null,
    chassisNumber: row.chassis_number,
    modelYear: row.model_year === null ? null : num(row.model_year),
    engineCc: row.engine_cc === null ? null : num(row.engine_cc),
    colour: row.colour ?? null,
    isModified: row.is_modified,
    status: row.status,
    ownerName: row.show_owner_name ? (row.owner_name ?? null) : null,
    location: toLocation(row),
    country: row.show_location ? (row.owner_country ?? null) : null,
  };
}

/** Builds the shared WHERE clause. Returns a postgres.js fragment. */
function buildConditions(filters: SearchFilters) {
  const sql = db();
  const parts = [];

  parts.push(
    filters.includeArchived
      ? sql`c.status in ('published', 'archived')`
      : sql`c.status = 'published'`
  );

  if (filters.era) parts.push(sql`c.era_code = ${filters.era}`);
  if (filters.series) parts.push(sql`c.series_id = ${filters.series}`);

  // Location filtering only makes sense against published locations, and
  // filtering on a hidden one would leak it by inference.
  if (filters.country) {
    parts.push(sql`(c.show_location and c.owner_country = ${filters.country})`);
  }

  if (filters.yearFrom !== undefined) parts.push(sql`c.model_year >= ${filters.yearFrom}`);
  if (filters.yearTo !== undefined) parts.push(sql`c.model_year <= ${filters.yearTo}`);
  if (filters.modifiedOnly) parts.push(sql`c.is_modified`);

  if (filters.q) {
    const nq = normalizeChassis(filters.q);
    if (nq) {
      // Substring rather than prefix match, so "45231" finds "FH45231L".
      // Sequential at this table size; revisit with pg_trgm if it grows.
      parts.push(sql`c.chassis_normalized like ${'%' + nq + '%'}`);
    } else {
      // Query had no alphanumerics — match nothing rather than everything.
      parts.push(sql`false`);
    }
  }

  return parts.reduce((acc, part) => sql`${acc} and ${part}`);
}

export async function searchCars(filters: SearchFilters = {}): Promise<SearchResult> {
  const sql = db();
  const pageSize = Math.min(Math.max(filters.pageSize ?? PAGE_SIZE, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const where = buildConditions(filters);

  const [countRow] = await sql`
    select count(*) as total
    from cars c
    where ${where}
  `;
  const total = num(countRow.total);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(page, pageCount);

  const rows = await sql`
    select c.public_ref, c.era_code, e.short_label as era_label,
           c.series_id, s.prefix as series_prefix,
           c.chassis_number, c.model_year, c.engine_cc, c.colour,
           c.is_modified, c.status,
           c.owner_name, c.show_owner_name,
           c.owner_country, c.owner_region, c.owner_city, c.show_location
    from cars c
    join model_eras e on e.code = c.era_code
    left join chassis_series s on s.id = c.series_id
    where ${where}
    order by e.ordinal, c.chassis_serial nulls last, c.chassis_normalized
    limit ${pageSize} offset ${(safePage - 1) * pageSize}
  `;

  return { cars: rows.map(toListing), total, page: safePage, pageSize, pageCount };
}

export async function getCarByRef(publicRef: string): Promise<CarDetail | null> {
  const sql = db();
  const [row] = await sql`
    select c.public_ref, c.era_code, e.short_label as era_label,
           c.series_id, s.prefix as series_prefix, s.label as series_label,
           c.chassis_number, c.chassis_prefix, c.chassis_serial, c.chassis_suffix,
           c.model_year, c.build_year, c.first_registered_on,
           c.engine_cc, c.engine_number, c.colour, c.colour_code,
           c.commission_plate_present, c.is_modified, c.modification_notes,
           c.notes, c.status, c.first_listed_at, c.updated_at,
           c.owner_name, c.show_owner_name,
           c.owner_country, c.owner_region, c.owner_city, c.show_location
    from cars c
    join model_eras e on e.code = c.era_code
    left join chassis_series s on s.id = c.series_id
    where c.public_ref = ${publicRef}
      and c.status in ('published', 'archived')
  `;

  if (!row) return null;

  return {
    ...toListing(row),
    chassisPrefix: row.chassis_prefix ?? null,
    chassisSerial: row.chassis_serial === null ? null : num(row.chassis_serial),
    chassisSuffix: row.chassis_suffix ?? null,
    seriesLabel: row.series_label ?? null,
    buildYear: row.build_year === null ? null : num(row.build_year),
    firstRegisteredOn: row.first_registered_on ?? null,
    engineNumber: row.engine_number ?? null,
    colourCode: row.colour_code ?? null,
    commissionPlatePresent: row.commission_plate_present,
    modificationNotes: row.modification_notes ?? null,
    notes: row.notes ?? null,
    firstListedAt: row.first_listed_at,
    updatedAt: row.updated_at,
  };
}

export interface FilterOptions {
  eras: { code: string; label: string; name: string }[];
  series: { id: string; label: string; eraCode: string }[];
  countries: { code: string; count: number }[];
  yearRange: { min: number; max: number };
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const sql = db();

  const [eras, series, countries, [range]] = await Promise.all([
    sql`select code, short_label, name from model_eras order by ordinal`,
    sql`select id, label, era_code from chassis_series order by ordinal`,
    // Only countries the owners chose to publish.
    sql`
      select owner_country as code, count(*) as count
      from cars
      where status = 'published' and show_location and owner_country is not null
      group by owner_country
      order by count desc, owner_country
    `,
    sql`
      select min(year_from) as min, max(year_to) as max
      from model_eras
    `,
  ]);

  return {
    eras: eras.map((e) => ({ code: e.code, label: e.short_label, name: e.name })),
    series: series.map((s) => ({ id: s.id, label: s.label, eraCode: s.era_code })),
    countries: countries.map((c) => ({ code: c.code, count: num(c.count) })),
    yearRange: { min: num(range.min), max: num(range.max) },
  };
}

/** Does this chassis number already exist? Drives submission routing. */
export async function findCarIdByChassis(
  normalized: string
): Promise<{ id: string; publicRef: string } | null> {
  const [row] = await db()`
    select id, public_ref from cars where chassis_normalized = ${normalized}
  `;
  return row ? { id: row.id, publicRef: row.public_ref } : null;
}
