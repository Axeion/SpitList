import { db, num } from './db';

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
