import { normalizeChassis } from './chassis';

/**
 * Number decoder.
 *
 * Deliberately narrow. It reports only what can be established from the number's
 * *structure* plus tables captured verbatim in docs/sources/. It stays pure: no
 * database, no network. Mapping a serial to a series and era needs the
 * chassis_ranges table and lives in registry.resolveSerial(), which the decoder
 * page calls alongside this.
 *
 * A decoder that confidently returns a wrong year is worse than one that says it
 * doesn't know, so anything not in a captured source comes back flagged
 * uncertain rather than guessed at.
 */

/** Late-Spitfire VIN: five letters, one digit, two letters, then digits. */
const VIN_PATTERN = /^([A-Z]{5})(\d)([A-Z]{2})(\d+)$/;

/** Commission number: letters, digits, optional trailing letters. */
const COMMISSION_PATTERN = /^([A-Z]{1,4})(\d+)([A-Z]*)$/;

/**
 * The VIN character that describes the car rather than the sequence.
 *
 * Two-source: the Amicale Spitfire tables and the prefix list this was first
 * built from agree on all four codes.
 */
const STEERING_OVERDRIVE: Record<string, { steering: string; overdrive: boolean }> = {
  '1': { steering: 'Right-hand drive', overdrive: false },
  '2': { steering: 'Left-hand drive', overdrive: false },
  '5': { steering: 'Right-hand drive', overdrive: true },
  '6': { steering: 'Left-hand drive', overdrive: true },
};

/**
 * VIN five-letter prefix → market, from docs/sources/amicale-serials.md.
 * Single source: the Information Warehouse page does not break the late VIN
 * prefixes down at all, so nothing corroborates these.
 */
const VIN_MARKETS: Record<string, string> = {
  TFADW: 'Home and general export',
  TFVDW: 'United States (federal)',
  TFZDW: 'United States (California)',
  TFLDW: 'Canada',
};

/** VIN model-year code, same source and the same single-source caveat. */
const VIN_MODEL_YEARS: Record<string, string> = {
  AT: '1979–80',
  BT: '1981',
};

/**
 * Commission-number suffixes.
 *
 * `L` and `O` are corroborated by the Amicale tables, which state the
 * convention outright: "'L' suffix for LHD, nothing for RHD, 'O' suffix for
 * Overdrive". The Information Warehouse reads `L` as right-hand drive and is
 * outvoted three to one — see docs/sources/iw-models-options.md.
 *
 * `U` and `UC` come from the Information Warehouse alone.
 *
 * Longer codes are listed first because the suffix is read greedily: "UC" has
 * to resolve as California, not as U followed by an unrecognised C.
 */
const SUFFIX_MEANINGS: [string, string][] = [
  ['UC', 'United States, California specification'],
  ['L', 'Left-hand drive'],
  ['O', 'Overdrive fitted'],
  ['U', 'United States specification'],
];

/** Splits a suffix into the longest known codes it is made of, left to right. */
function readSuffix(suffix: string): { known: string[]; unreadable: string[] } {
  const known: string[] = [];
  const unreadable: string[] = [];

  let i = 0;
  while (i < suffix.length) {
    const match = SUFFIX_MEANINGS.find(([code]) => suffix.startsWith(code, i));
    if (match) {
      known.push(match[1]);
      i += match[0].length;
    } else {
      unreadable.push(suffix[i]);
      i += 1;
    }
  }

  return { known, unreadable };
}

export interface DecodedFact {
  label: string;
  value: string;
  /** Set when we can read the character but not what it means. */
  uncertain?: boolean;
}

export type Decoded =
  | {
      format: 'vin';
      normalized: string;
      prefix: string;
      serial: number;
      facts: DecodedFact[];
      unknowns: string[];
    }
  | {
      format: 'commission';
      normalized: string;
      prefix: string;
      serial: number;
      suffix: string | null;
      facts: DecodedFact[];
      unknowns: string[];
    }
  | { format: 'unrecognised'; normalized: string };

export function decodeNumber(input: string): Decoded {
  const normalized = normalizeChassis(input);
  if (normalized.length < 3) return { format: 'unrecognised', normalized };

  const vin = VIN_PATTERN.exec(normalized);
  if (vin) {
    const [, prefix, digit, modelCode, sequence] = vin;
    const facts: DecodedFact[] = [{ label: 'Number type', value: 'VIN (built October 1979 or later)' }];
    const unknowns: string[] = [];

    const so = STEERING_OVERDRIVE[digit];
    if (so) {
      facts.push({ label: 'Steering', value: so.steering });
      facts.push({ label: 'Overdrive', value: so.overdrive ? 'Fitted' : 'Not fitted' });
    } else {
      facts.push({ label: 'Steering / overdrive', value: `Code "${digit}"`, uncertain: true });
      unknowns.push(`Steering/overdrive code "${digit}" is not one we document.`);
    }

    const market = VIN_MARKETS[prefix];
    if (market) {
      facts.push({ label: 'Market', value: market });
    } else {
      facts.push({ label: 'Market', value: `Prefix "${prefix}"`, uncertain: true });
      unknowns.push(`VIN prefix "${prefix}" is not in the market table we hold.`);
    }

    const modelYear = VIN_MODEL_YEARS[modelCode];
    if (modelYear) {
      facts.push({ label: 'Model year', value: modelYear });
    } else {
      facts.push({ label: 'Model year', value: `Code "${modelCode}"`, uncertain: true });
      unknowns.push(`Model-year code "${modelCode}" is not one we document.`);
    }

    facts.push({ label: 'Build sequence', value: String(Number(sequence)) });

    if (market || modelYear) {
      unknowns.push(
        'The market and model-year codes come from one club compilation, not a factory record.'
      );
    }

    return { format: 'vin', normalized, prefix, serial: Number(sequence), facts, unknowns };
  }

  const commission = COMMISSION_PATTERN.exec(normalized);
  if (commission) {
    const [, prefix, digits, rawSuffix] = commission;
    const suffix = rawSuffix || null;
    const facts: DecodedFact[] = [
      { label: 'Number type', value: 'Commission number (built before October 1979)' },
      { label: 'Prefix', value: prefix },
      { label: 'Serial', value: Number(digits).toLocaleString('en-US') },
    ];
    const unknowns: string[] = [];

    if (suffix) {
      // "LO" resolves to both meanings, "UC" to one, and an unrecognised letter
      // is reported rather than silently dropped.
      const { known, unreadable } = readSuffix(suffix);
      for (const letter of unreadable) {
        unknowns.push(`Suffix letter "${letter}" is not one we document yet.`);
      }
      facts.push({
        label: 'Suffix',
        value: known.length ? `${suffix} — ${known.join(', ')}` : suffix,
        uncertain: known.length === 0,
      });
    }

    // No blanket "ranges are unsourced" line any more. Which era a serial falls
    // into is a database question; the decoder page answers it with
    // registry.resolveSerial() and says so there, including when the answer is
    // that this prefix has no ranges on record.

    return { format: 'commission', normalized, prefix, serial: Number(digits), suffix, facts, unknowns };
  }

  return { format: 'unrecognised', normalized };
}
