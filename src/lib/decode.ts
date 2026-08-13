import { normalizeChassis } from './chassis';

/**
 * Number decoder.
 *
 * Deliberately narrow. It reports only what can be established from the number's
 * *structure* plus reference data this project actually holds — the prefix, the
 * VIN steering/overdrive digit, the series a prefix belongs to. It does not map a
 * serial to a model year, because those ranges have not been sourced against a
 * primary record (see docs/data-model.md). A decoder that confidently returns a
 * wrong year is worse than one that says it doesn't know.
 */

/** Late-Spitfire VIN: five letters, one digit, two letters, then digits. */
const VIN_PATTERN = /^([A-Z]{5})(\d)([A-Z]{2})(\d+)$/;

/** Commission number: letters, digits, optional trailing letters. */
const COMMISSION_PATTERN = /^([A-Z]{1,4})(\d+)([A-Z]*)$/;

/** The one VIN character that describes the car rather than the sequence. */
const STEERING_OVERDRIVE: Record<string, { steering: string; overdrive: boolean }> = {
  '1': { steering: 'Right-hand drive', overdrive: false },
  '2': { steering: 'Left-hand drive', overdrive: false },
  '5': { steering: 'Right-hand drive', overdrive: true },
  '6': { steering: 'Left-hand drive', overdrive: true },
};

const SUFFIX_MEANINGS: Record<string, string> = {
  L: 'Left-hand drive',
  O: 'Overdrive fitted',
};

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

    facts.push({ label: 'Build sequence', value: String(Number(sequence)) });
    unknowns.push(
      `The prefix "${prefix}" and the model code "${modelCode}" carry model and market information we have not sourced a table for.`
    );

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
      // Read the suffix letter by letter, so "LO" resolves to both meanings and
      // an unrecognised letter is reported rather than silently dropped.
      const known: string[] = [];
      for (const letter of suffix) {
        const meaning = SUFFIX_MEANINGS[letter];
        if (meaning) known.push(meaning);
        else unknowns.push(`Suffix letter "${letter}" is not one we document yet.`);
      }
      facts.push({
        label: 'Suffix',
        value: known.length ? `${suffix} — ${known.join(', ')}` : suffix,
        uncertain: known.length === 0,
      });
    }

    unknowns.push(
      'Serial ranges per model year have not been sourced, so the number alone cannot date this car.'
    );

    return { format: 'commission', normalized, prefix, serial: Number(digits), suffix, facts, unknowns };
  }

  return { format: 'unrecognised', normalized };
}
