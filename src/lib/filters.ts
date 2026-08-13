import type { SearchFilters } from './registry';

/**
 * URL <-> filter translation, shared by the full registry page and the htmx
 * partial so both read a request identically. Anything unparseable is dropped
 * rather than defaulted, so a mangled URL degrades to "no filter" instead of
 * an error page.
 */

const int = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
};

export function filtersFromParams(params: URLSearchParams): SearchFilters {
  return {
    q: params.get('q')?.trim() || undefined,
    era: params.get('era') || undefined,
    series: params.get('series') || undefined,
    country: params.get('country') || undefined,
    yearFrom: int(params.get('year_from')),
    yearTo: int(params.get('year_to')),
    modifiedOnly: params.get('modified') === '1',
    includeArchived: params.get('archived') === '1',
    page: int(params.get('page')) ?? 1,
  };
}

/** Rebuilds a query string, with overrides applied. Empty values are omitted. */
export function buildQuery(
  filters: SearchFilters,
  overrides: Partial<SearchFilters> = {}
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (merged.q) params.set('q', merged.q);
  if (merged.era) params.set('era', merged.era);
  if (merged.series) params.set('series', merged.series);
  if (merged.country) params.set('country', merged.country);
  if (merged.yearFrom !== undefined) params.set('year_from', String(merged.yearFrom));
  if (merged.yearTo !== undefined) params.set('year_to', String(merged.yearTo));
  if (merged.modifiedOnly) params.set('modified', '1');
  if (merged.includeArchived) params.set('archived', '1');
  if (merged.page && merged.page > 1) params.set('page', String(merged.page));

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const hasAnyFilter = (f: SearchFilters): boolean =>
  Boolean(f.q || f.era || f.series || f.country || f.yearFrom || f.yearTo || f.modifiedOnly || f.includeArchived);
