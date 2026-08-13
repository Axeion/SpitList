import { parseChassis } from './chassis';

/**
 * Submission validation. Everything the public form produces passes through
 * here before it reaches the database, and nothing downstream re-checks it.
 *
 * Two rules worth keeping:
 *   - Visibility flags are opt-IN. A missing checkbox means private, never
 *     "unchanged" or "default true".
 *   - Unknown fields are dropped rather than passed through. The payload is
 *     jsonb, so anything accepted here is something a moderator will later
 *     apply to `cars`.
 */

export interface SubmissionPayload {
  /**
   * Which fields the submitter actually filled in.
   *
   * This is what makes a correction a *correction*. A payload is a snapshot of
   * one form, and most of that form is blank — someone fixing a car's colour
   * leaves twenty other fields empty. Applying the whole snapshot to an
   * existing car would blank every one of them, so on approval of an update
   * only the keys listed here are written. Everything else keeps its value.
   *
   * An unticked checkbox counts as *not provided*, not as false. That means a
   * correction cannot flip a boolean back to false through the form — a real
   * limitation, and the safe direction to err in. It also means a third party
   * correcting a chassis number can never quietly un-publish the owner's name.
   */
  provided: string[];
  chassisNumber: string;
  chassisNormalized: string;
  chassisPrefix: string | null;
  chassisSerial: number | null;
  chassisSuffix: string | null;
  eraCode: string;
  seriesId: string | null;
  modelYear: number | null;
  buildYear: number | null;
  firstRegisteredOn: string | null;
  engineCc: number | null;
  engineNumber: string | null;
  colour: string | null;
  colourCode: string | null;
  commissionPlatePresent: boolean;
  isModified: boolean;
  modificationNotes: string | null;
  notes: string | null;
  ownerName: string | null;
  ownerCountry: string | null;
  ownerRegion: string | null;
  ownerCity: string | null;
  showOwnerName: boolean;
  showLocation: boolean;
}

export interface SubmissionMeta {
  submitterName: string | null;
  submitterEmail: string | null;
  submitterNote: string | null;
}

export type ValidationResult =
  | { ok: true; payload: SubmissionPayload; meta: SubmissionMeta }
  | { ok: false; errors: Record<string, string> };

/** Widest plausible window: production ran 1962–1981, registrations lag. */
const YEAR_MIN = 1960;
const YEAR_MAX = 1990;

const MAX = {
  chassis: 40,
  short: 120,
  email: 254,
  notes: 2000,
} as const;

const text = (value: FormDataEntryValue | null, limit: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, limit);
};

const checkbox = (value: FormDataEntryValue | null): boolean =>
  value === 'on' || value === 'true' || value === '1';

function integer(
  value: FormDataEntryValue | null,
  { min, max }: { min: number; max: number },
  field: string,
  errors: Record<string, string>
): number | null {
  const raw = text(value, 12);
  if (raw === null) return null;

  const n = Number(raw);
  if (!Number.isInteger(n)) {
    errors[field] = 'Must be a whole number.';
    return null;
  }
  if (n < min || n > max) {
    errors[field] = `Must be between ${min} and ${max}.`;
    return null;
  }
  return n;
}

export function validateSubmission(
  form: FormData,
  options: { eraCodes: string[]; seriesByEra: Record<string, string[]> }
): ValidationResult {
  const errors: Record<string, string> = {};

  // --- chassis number -------------------------------------------------------
  const chassisRaw = text(form.get('chassis_number'), MAX.chassis);
  let parsed = parseChassis('');
  if (!chassisRaw) {
    errors.chassis_number = 'A chassis or commission number is required.';
  } else {
    parsed = parseChassis(chassisRaw);
    if (parsed.normalized.length < 3) {
      errors.chassis_number = 'That does not look like a chassis number.';
    }
  }

  // --- era / series ---------------------------------------------------------
  const eraCode = text(form.get('era_code'), 20);
  if (!eraCode) {
    errors.era_code = 'Choose which model this is.';
  } else if (!options.eraCodes.includes(eraCode)) {
    errors.era_code = 'Unknown model era.';
  }

  let seriesId = text(form.get('series_id'), 40);
  if (seriesId && eraCode) {
    const allowed = options.seriesByEra[eraCode] ?? [];
    if (!allowed.includes(seriesId)) {
      // Mismatched rather than malicious, usually — the era select changed
      // after the series was picked. Drop it instead of failing the submission.
      seriesId = null;
    }
  }

  // --- dates ----------------------------------------------------------------
  const modelYear = integer(
    form.get('model_year'), { min: YEAR_MIN, max: YEAR_MAX }, 'model_year', errors
  );
  const buildYear = integer(
    form.get('build_year'), { min: YEAR_MIN, max: YEAR_MAX }, 'build_year', errors
  );

  let firstRegisteredOn = text(form.get('first_registered_on'), 10);
  if (firstRegisteredOn) {
    const date = new Date(firstRegisteredOn);
    if (Number.isNaN(date.getTime())) {
      errors.first_registered_on = 'Use YYYY-MM-DD.';
      firstRegisteredOn = null;
    } else if (date > new Date()) {
      errors.first_registered_on = 'That date is in the future.';
      firstRegisteredOn = null;
    }
  }

  // --- engine / paint -------------------------------------------------------
  const engineCc = integer(
    form.get('engine_cc'), { min: 500, max: 8000 }, 'engine_cc', errors
  );

  // --- owner block ----------------------------------------------------------
  // Read the whole value before validating. Truncating to two characters first
  // would silently turn three-letter codes into wrong two-letter ones —
  // "DNK" (Denmark) becomes "DN", "PRT" (Portugal) becomes "PR" (Puerto Rico).
  // Better to reject and ask.
  const ownerCountryRaw = text(form.get('owner_country'), 20);
  let ownerCountry: string | null = null;
  if (ownerCountryRaw) {
    if (!/^[A-Za-z]{2}$/.test(ownerCountryRaw)) {
      errors.owner_country = 'Use the two-letter country code — GB, US, DE, DK.';
    } else {
      ownerCountry = ownerCountryRaw.toUpperCase();
    }
  }

  const submitterEmail = text(form.get('submitter_email'), MAX.email);
  if (submitterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    errors.submitter_email = 'That email address does not look right.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Payload key -> form field. Checkboxes count as provided only when ticked;
  // the browser sends nothing at all for an unticked box, which is exactly the
  // "no opinion" we want to preserve.
  const FIELD_SOURCES: [string, string, 'value' | 'checkbox'][] = [
    ['chassisNumber', 'chassis_number', 'value'],
    ['eraCode', 'era_code', 'value'],
    ['seriesId', 'series_id', 'value'],
    ['modelYear', 'model_year', 'value'],
    ['buildYear', 'build_year', 'value'],
    ['firstRegisteredOn', 'first_registered_on', 'value'],
    ['engineCc', 'engine_cc', 'value'],
    ['engineNumber', 'engine_number', 'value'],
    ['colour', 'colour', 'value'],
    ['colourCode', 'colour_code', 'value'],
    ['commissionPlatePresent', 'plate_missing', 'checkbox'],
    ['isModified', 'is_modified', 'checkbox'],
    ['modificationNotes', 'modification_notes', 'value'],
    ['notes', 'notes', 'value'],
    ['ownerName', 'owner_name', 'value'],
    ['ownerCountry', 'owner_country', 'value'],
    ['ownerRegion', 'owner_region', 'value'],
    ['ownerCity', 'owner_city', 'value'],
    ['showOwnerName', 'show_owner_name', 'checkbox'],
    ['showLocation', 'show_location', 'checkbox'],
  ];

  const provided: string[] = [];
  for (const [key, field, mode] of FIELD_SOURCES) {
    const raw = form.get(field);
    const given =
      mode === 'checkbox'
        ? checkbox(raw)
        : typeof raw === 'string' && raw.trim() !== '';
    if (given) provided.push(key);
  }

  // Series is dropped when it contradicts the era, so it must not stay marked
  // as provided — otherwise approval would null out a correct existing series.
  if (seriesId === null) {
    const at = provided.indexOf('seriesId');
    if (at !== -1) provided.splice(at, 1);
  }

  // The parsed parts travel with the number they came from.
  if (provided.includes('chassisNumber')) {
    provided.push('chassisNormalized', 'chassisPrefix', 'chassisSerial', 'chassisSuffix');
  }

  return {
    ok: true,
    payload: {
      provided,
      chassisNumber: chassisRaw!,
      chassisNormalized: parsed.normalized,
      chassisPrefix: parsed.prefix,
      chassisSerial: parsed.serial,
      chassisSuffix: parsed.suffix,
      eraCode: eraCode!,
      seriesId,
      modelYear,
      buildYear,
      firstRegisteredOn,
      engineCc,
      engineNumber: text(form.get('engine_number'), MAX.short),
      colour: text(form.get('colour'), MAX.short),
      colourCode: text(form.get('colour_code'), 20),
      // Present unless explicitly reported missing, matching the field's
      // meaning: most cars still carry the plate.
      commissionPlatePresent: !checkbox(form.get('plate_missing')),
      isModified: checkbox(form.get('is_modified')),
      modificationNotes: text(form.get('modification_notes'), MAX.notes),
      notes: text(form.get('notes'), MAX.notes),
      ownerName: text(form.get('owner_name'), MAX.short),
      ownerCountry,
      ownerRegion: text(form.get('owner_region'), MAX.short),
      ownerCity: text(form.get('owner_city'), MAX.short),
      showOwnerName: checkbox(form.get('show_owner_name')),
      showLocation: checkbox(form.get('show_location')),
    },
    meta: {
      submitterName: text(form.get('submitter_name'), MAX.short),
      submitterEmail,
      submitterNote: text(form.get('submitter_note'), MAX.notes),
    },
  };
}
