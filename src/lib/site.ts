/**
 * Site-level constants and clearly-labelled estimates.
 *
 * Anything here that is an *estimate* rather than a measurement is marked as
 * such and rendered with a qualifier. Counts that can be measured live come
 * from the database instead — see src/lib/registry.ts.
 */

export const SITE = {
  name: 'Spitplate',
  tagline: 'Triumph Spitfire Registry',
  domain: 'spitplate.com',
  contactEmail: 'registry@spitplate.com',
} as const;

/**
 * Estimated share of total production believed to survive. This is a
 * marque-community estimate, not a figure this registry can measure — the site
 * always renders it with a "~" and an "estimated" label.
 */
export const SURVIVAL_ESTIMATE_PCT = 20;

export const NAV_LINKS = [
  { href: '#registry', label: 'Registry' },
  { href: '#history', label: 'History' },
  { href: '#stats', label: 'Stats' },
  { href: '#clubs', label: 'Clubs' },
  { href: '#resources', label: 'Resources' },
] as const;

export const formatInt = (n: number) => n.toLocaleString('en-US');

/**
 * Share-of-production percentages span three orders of magnitude between a
 * young registry and a mature one, so the precision follows the value instead
 * of being fixed.
 */
export function formatShare(pct: number): string {
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct > 0) return `${pct.toFixed(2)}%`;
  return '0%';
}

export const formatDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
