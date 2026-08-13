/**
 * Club directory. Static per the handoff — no CMS until it grows.
 * `url: null` means we have not confirmed a current link yet; those render as
 * plain text rather than a dead link.
 */
export interface Club {
  name: string;
  country: string;
  url: string | null;
}

export const CLUBS: Club[] = [
  { name: 'Vintage Triumph Register', country: 'US', url: 'https://vtr.org' },
  { name: 'Triumph Sports Six Club', country: 'UK', url: 'https://tssc.org.uk' },
  { name: 'Club Triumph', country: 'UK', url: 'https://club.triumph.org.uk' },
  { name: 'Amicale Spitfire Club', country: 'FR', url: null },
  { name: 'Rhône-Alpes Spitfire Club', country: 'FR', url: null },
  { name: 'Triumph Spitfire Club of Holland', country: 'NL', url: null },
  { name: 'The Triumph Club Holland', country: 'NL', url: null },
  { name: 'Spitfire Club Deutschlands', country: 'DE', url: null },
  { name: 'Dansk Triumph Automobil Klub', country: 'DK', url: null },
  { name: 'Triumph Club of Sweden', country: 'SE', url: null },
  { name: 'The Swiss Spitfire Club', country: 'CH', url: null },
  { name: 'Registro Italiano Triumph Spitfires', country: 'IT', url: null },
  { name: 'Triumph Cars Club of Finland', country: 'FI', url: null },
  { name: 'Triumph British Oldtimers', country: 'BE', url: null },
  { name: 'Belgium TR Register', country: 'BE', url: null },
  { name: 'Triumph Sports Club Greece', country: 'GR', url: null },
  { name: 'Auckland Triumph Car Club', country: 'NZ', url: null },
  { name: 'Triumph Sports Owners Assoc.', country: 'AU', url: null },
  { name: 'Triumph Spitfire Peru', country: 'PE', url: null },
  { name: 'Triumph Club of Northern Ireland', country: 'NI', url: null },
  { name: 'Triumph Spitfire Portugal', country: 'PT', url: null },
];

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
