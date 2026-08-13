/**
 * Chassis / commission number handling.
 *
 * Parsing is best-effort and used for search, sorting, and duplicate detection.
 * It is deliberately NOT used to infer which era a car belongs to — the
 * submitter picks that explicitly. Triumph's numbering is irregular enough
 * (FC spans two eras, FH spans two more, VINs follow a different shape
 * entirely) that guessing would produce confident wrong answers.
 */

export interface ParsedChassis {
  /** Uppercase alphanumeric, the form used for uniqueness and lookup. */
  normalized: string;
  prefix: string | null;
  serial: number | null;
  suffix: string | null;
}

/** Strip everything that isn't a letter or digit and uppercase the rest. */
export function normalizeChassis(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Splits the common commission-number shape: letters, digits, optional trailing
 * letters (`FH45231L`). Anything that doesn't fit — VINs like `TFADW1AT400123`
 * — still gets a normalized form and a best-guess serial from its final run of
 * digits, so it remains searchable and sortable.
 */
export function parseChassis(input: string): ParsedChassis {
  const normalized = normalizeChassis(input);

  if (!normalized) {
    return { normalized: '', prefix: null, serial: null, suffix: null };
  }

  const simple = /^([A-Z]+)(\d+)([A-Z]*)$/.exec(normalized);
  if (simple) {
    const [, prefix, digits, suffix] = simple;
    const serial = Number(digits);
    return {
      normalized,
      prefix,
      serial: Number.isSafeInteger(serial) ? serial : null,
      suffix: suffix || null,
    };
  }

  const leading = /^([A-Z]+)/.exec(normalized);
  const lastDigits = normalized.match(/(\d+)(?!.*\d)/);
  const serial = lastDigits ? Number(lastDigits[1]) : null;

  return {
    normalized,
    prefix: leading ? leading[1] : null,
    serial: serial !== null && Number.isSafeInteger(serial) ? serial : null,
    suffix: null,
  };
}

/** Display form: `FH 45231 L`. Falls back to the raw input when unparseable. */
export function formatChassis(parsed: ParsedChassis, fallback: string): string {
  if (!parsed.prefix || parsed.serial === null) return fallback.trim();
  return [parsed.prefix, parsed.serial, parsed.suffix].filter(Boolean).join(' ');
}
