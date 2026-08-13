/**
 * Club directory. Static per the handoff — no CMS until it grows.
 * `url: null` means we have not confirmed a current link yet; those render as
 * plain text rather than a dead link.
 */
export interface Club {
  /** Stable identifier used in referral links. Never change one in use. */
  slug: string;
  name: string;
  country: string;
  url: string | null;
}

export const CLUBS: Club[] = [
  { slug: 'vtr', name: 'Vintage Triumph Register', country: 'US', url: 'https://vtr.org' },
  { slug: 'tssc', name: 'Triumph Sports Six Club', country: 'UK', url: 'https://tssc.org.uk' },
  { slug: 'club-triumph', name: 'Club Triumph', country: 'UK', url: 'https://club.triumph.org.uk' },
  { slug: 'amicale-spitfire', name: 'Amicale Spitfire Club', country: 'FR', url: null },
  { slug: 'rhone-alpes-spitfire', name: 'Rhône-Alpes Spitfire Club', country: 'FR', url: null },
  { slug: 'spitfire-club-holland', name: 'Triumph Spitfire Club of Holland', country: 'NL', url: null },
  { slug: 'triumph-club-holland', name: 'The Triumph Club Holland', country: 'NL', url: null },
  { slug: 'spitfire-club-deutschlands', name: 'Spitfire Club Deutschlands', country: 'DE', url: null },
  { slug: 'dtak', name: 'Dansk Triumph Automobil Klub', country: 'DK', url: null },
  { slug: 'triumph-club-sweden', name: 'Triumph Club of Sweden', country: 'SE', url: null },
  { slug: 'swiss-spitfire', name: 'The Swiss Spitfire Club', country: 'CH', url: null },
  { slug: 'registro-italiano', name: 'Registro Italiano Triumph Spitfires', country: 'IT', url: null },
  { slug: 'triumph-finland', name: 'Triumph Cars Club of Finland', country: 'FI', url: null },
  { slug: 'british-oldtimers', name: 'Triumph British Oldtimers', country: 'BE', url: null },
  { slug: 'belgium-tr', name: 'Belgium TR Register', country: 'BE', url: null },
  { slug: 'triumph-greece', name: 'Triumph Sports Club Greece', country: 'GR', url: null },
  { slug: 'auckland-triumph', name: 'Auckland Triumph Car Club', country: 'NZ', url: null },
  { slug: 'tsoa-au', name: 'Triumph Sports Owners Assoc.', country: 'AU', url: null },
  { slug: 'spitfire-peru', name: 'Triumph Spitfire Peru', country: 'PE', url: null },
  { slug: 'triumph-ni', name: 'Triumph Club of Northern Ireland', country: 'NI', url: null },
  { slug: 'spitfire-portugal', name: 'Triumph Spitfire Portugal', country: 'PT', url: null },
];

/** Look up a club by referral slug. Returns null for anything unrecognised. */
export const findClub = (slug: string | null | undefined): Club | null =>
  (slug ? CLUBS.find((club) => club.slug === slug) : undefined) ?? null;

/**
 * Reference pages. `href` points at a route we own; `ready: false` marks the
 * ones still to be written as markdown content, and they render disabled
 * instead of linking into a 404.
 */
export interface Resource {
  title: string;
  detail: string;
  href: string;
  ready: boolean;
}

export const RESOURCES: Resource[] = [
  {
    title: 'Number decoder',
    detail: 'Read a commission number or VIN',
    href: '/reference/decoder',
    ready: true,
  },
  {
    title: 'Commission numbers',
    detail: 'Pre-1979 chassis tags, and where to find them',
    href: '/reference/commission-numbers',
    ready: true,
  },
  {
    title: 'VIN numbers, 1979–81',
    detail: 'The modern-format late cars',
    href: '/reference/vin',
    ready: true,
  },
  {
    title: 'Heritage certificates',
    detail: 'Order the factory build record',
    href: '/reference/heritage-certificates',
    ready: true,
  },
  {
    title: 'Model era guide',
    detail: 'What changed, and when',
    href: '/reference/model-eras',
    ready: true,
  },
  {
    title: 'Triumph paint codes',
    detail: 'Chart not yet sourced',
    href: '/reference/paint-codes',
    ready: true,
  },
];
