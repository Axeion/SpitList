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
    title: 'Commission number decoder',
    detail: 'Read a pre-1979 chassis tag',
    href: '/reference/commission-numbers',
    ready: false,
  },
  {
    title: 'VIN decoder',
    detail: '1979–81 modern-format cars',
    href: '/reference/vin',
    ready: false,
  },
  {
    title: 'Triumph paint code chart',
    detail: 'Match your original colour',
    href: '/reference/paint-codes',
    ready: false,
  },
  {
    title: 'British Motor Heritage certificates',
    detail: 'Order factory build records',
    href: '/reference/heritage-certificates',
    ready: false,
  },
  {
    title: 'Model era guide',
    detail: 'What changed, and when',
    href: '/reference/model-eras',
    ready: false,
  },
  {
    title: 'How to read your commission plate',
    detail: 'Where it lives on each model',
    href: '/reference/finding-your-plate',
    ready: false,
  },
];
