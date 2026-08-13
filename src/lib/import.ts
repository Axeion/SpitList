import { parseChassis } from './chassis';

/**
 * Bulk-import support: turning somebody else's spreadsheet into something the
 * registry's own validation can judge.
 *
 * The rows are converted to FormData and pushed through `validateSubmission` —
 * the exact function the public form uses. That is deliberate. An importer with
 * its own validation rules would drift from the form's, and the two would
 * disagree about what a valid car is. It also means imported rows get the same
 * `provided` tracking, so a partial club roster becomes a partial correction
 * rather than a wipe.
 */

/** Header aliases, lowercased and stripped of punctuation before matching. */
const COLUMN_ALIASES: Record<string, string[]> = {
  chassis_number: [
    'chassis', 'chassisnumber', 'chassisno', 'commission', 'commissionnumber',
    'commissionno', 'number', 'vin', 'chassisvin', 'serialnumber', 'id',
  ],
  era_code: ['model', 'era', 'mark', 'mk', 'modelera', 'type', 'variant'],
  series_id: ['series', 'seriesid'],
  model_year: ['year', 'modelyear', 'yr'],
  build_year: ['buildyear', 'yearbuilt', 'manufactured', 'builddate'],
  first_registered_on: ['firstregistered', 'registered', 'registrationdate', 'regdate'],
  engine_cc: ['engine', 'enginesize', 'cc', 'capacity', 'enginecc'],
  engine_number: ['enginenumber', 'engineno'],
  colour: ['colour', 'color', 'paint', 'paintcolour', 'paintcolor'],
  colour_code: ['colourcode', 'colorcode', 'paintcode'],
  notes: ['notes', 'history', 'comments', 'remarks', 'description'],
  modification_notes: ['modifications', 'modificationnotes', 'mods'],
  owner_name: ['owner', 'ownername', 'name', 'member'],
  owner_city: ['city', 'town', 'ownercity'],
  owner_region: ['region', 'state', 'county', 'province', 'ownerregion'],
  owner_country: ['country', 'countrycode', 'ownercountry'],
};

/** Era spellings seen in club data. Bare "4" is excluded: Spitfire 4 is the Mk1. */
const ERA_ALIASES: Record<string, string> = {
  mk1: 'mk1', mki: 'mk1', mark1: 'mk1', spitfire4: 'mk1', spitfire4mk1: 'mk1', '1': 'mk1',
  mk2: 'mk2', mkii: 'mk2', mark2: 'mk2', spitfire4mk2: 'mk2', '2': 'mk2',
  mk3: 'mk3', mkiii: 'mk3', mark3: 'mk3', spitfiremk3: 'mk3', '3': 'mk3',
  mk4: 'mk4', mkiv: 'mk4', mark4: 'mk4', spitfiremkiv: 'mk4',
  '1500': '1500', spitfire1500: '1500', mk1500: '1500',
};

export const normaliseKey = (value: string) =>
  value.toLowerCase().replace(/^﻿/, '').replace(/[^a-z0-9]/g, '');

export interface ColumnMapping {
  /** csv header -> our field name */
  matched: Record<string, string>;
  /** headers we could not place */
  ignored: string[];
  /** fields we found no column for */
  missing: string[];
}

export function detectColumns(headers: string[]): ColumnMapping {
  const matched: Record<string, string> = {};
  const ignored: string[] = [];
  const taken = new Set<string>();

  for (const header of headers) {
    const key = normaliseKey(header);
    if (!key) continue;

    let field: string | undefined;
    for (const [target, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (taken.has(target)) continue;
      if (normaliseKey(target) === key || aliases.includes(key)) {
        field = target;
        break;
      }
    }

    if (field) {
      matched[header] = field;
      taken.add(field);
    } else {
      ignored.push(header);
    }
  }

  const missing = Object.keys(COLUMN_ALIASES).filter((field) => !taken.has(field));
  return { matched, ignored, missing };
}

export const normaliseEra = (value: string): string | null =>
  ERA_ALIASES[normaliseKey(value)] ?? null;

/**
 * Infers the era from the chassis prefix, but only when the prefix belongs to
 * exactly one era. FC spans Mk1 and Mk2 and FH spans MkIV and the 1500, so those
 * stay unresolved rather than being guessed at.
 */
export function inferEraFromPrefix(
  chassisNumber: string,
  seriesByPrefix: Map<string, string[]>
): string | null {
  const { prefix } = parseChassis(chassisNumber);
  if (!prefix) return null;
  const eras = seriesByPrefix.get(prefix);
  return eras && eras.length === 1 ? eras[0] : null;
}

/** Truthy spellings that show up in spreadsheet boolean columns. */
const TRUTHY = new Set(['1', 'y', 'yes', 'true', 't', 'x', 'modified']);
export const isTruthy = (value: string) => TRUTHY.has(value.trim().toLowerCase());

/**
 * Builds the FormData that `validateSubmission` expects from one CSV row.
 *
 * Visibility flags are never set from a spreadsheet. Someone else's roster
 * cannot consent on an owner's behalf, so imported owner details are stored
 * unpublished and stay that way until the owner asks otherwise.
 */
export function rowToFormData(
  row: Record<string, string>,
  mapping: ColumnMapping,
  eraCode: string | null
): FormData {
  const form = new FormData();

  for (const [header, field] of Object.entries(mapping.matched)) {
    const value = (row[header] ?? '').trim();
    if (!value) continue;
    if (field === 'era_code') continue; // resolved separately
    if (field === 'modification_notes') {
      form.set('modification_notes', value);
      form.set('is_modified', 'on');
      continue;
    }
    form.set(field, value);
  }

  if (eraCode) form.set('era_code', eraCode);
  return form;
}
