import { db, num } from './db';
import type { SubmissionPayload } from './validation';

/**
 * Moderator-side queries.
 *
 * These deliberately read the fields the public side hides — owner name,
 * location, submitter email — because reviewing a submission without seeing
 * them is guesswork. Everything here sits behind the /admin Basic auth in
 * src/middleware.ts. Nothing in this module may be imported by a public page.
 */

export interface FieldDiff {
  key: string;
  label: string;
  current: string | null;
  proposed: string | null;
  changed: boolean;
  /**
   * Whether the submitter filled this field in. Fields they left blank are not
   * part of a correction at all — approval leaves them alone — so showing them
   * as "current -> —" would advertise a wipe that will not happen.
   */
  inProposal: boolean;
  /** Private fields are labelled so a moderator knows what is not public. */
  isPrivate: boolean;
}

export interface ReviewItem {
  id: string;
  kind: 'create' | 'update';
  targetPublicRef: string | null;
  createdAt: Date;
  submitterName: string | null;
  submitterEmail: string | null;
  submitterNote: string | null;
  /** Slug of the club whose link produced this, if any. */
  referralClub: string | null;
  payload: SubmissionPayload;
  diff: FieldDiff[];
  changedCount: number;
  /**
   * Set when the serial sits outside every range recorded for its prefix.
   * Advisory: the queue flags it, the moderator decides. Null when it is inside
   * a range, when we hold no ranges for the prefix, or when there is no serial
   * to check.
   */
  outOfRange: OutOfRange | null;
}

export interface OutOfRange {
  prefix: string;
  serial: number;
  /** The ranges recorded for the claimed model, formatted. Empty if there are none. */
  known: string[];
  /**
   * The model this serial *does* fall into, if any. The interesting case: a
   * number in the right sequence but filed against the wrong model, which is
   * what a mangled model column looks like row after row.
   */
  matchesInstead: string | null;
}

/** payload key -> [label, cars column, private?] */
const FIELDS: [keyof SubmissionPayload, string, string, boolean?][] = [
  ['chassisNumber', 'Chassis number', 'chassis_number'],
  ['eraCode', 'Model era', 'era_code'],
  ['seriesId', 'Series', 'series_id'],
  ['modelYear', 'Model year', 'model_year'],
  ['buildYear', 'Build year', 'build_year'],
  ['firstRegisteredOn', 'First registered', 'first_registered_on'],
  ['engineCc', 'Engine (cc)', 'engine_cc'],
  ['engineNumber', 'Engine number', 'engine_number'],
  ['colour', 'Colour', 'colour'],
  ['colourCode', 'Paint code', 'colour_code'],
  ['commissionPlatePresent', 'Plate present', 'commission_plate_present'],
  ['isModified', 'Modified', 'is_modified'],
  ['modificationNotes', 'Modification notes', 'modification_notes'],
  ['notes', 'History', 'notes'],
  ['ownerName', 'Owner name', 'owner_name', true],
  ['ownerCity', 'Owner city', 'owner_city', true],
  ['ownerRegion', 'Owner region', 'owner_region', true],
  ['ownerCountry', 'Owner country', 'owner_country', true],
  ['showOwnerName', 'Publish name', 'show_owner_name'],
  ['showLocation', 'Publish location', 'show_location'],
];

function display(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function buildDiff(payload: SubmissionPayload, current: Record<string, any> | null): FieldDiff[] {
  // Submissions filed before `provided` existed carry no list; treat every
  // field as part of the proposal, which is how they were reviewed.
  const provided = Array.isArray(payload.provided) ? new Set(payload.provided) : null;

  return FIELDS.map(([key, label, column, isPrivate]) => {
    const inProposal = provided ? provided.has(key as string) : true;
    const proposed = inProposal ? display(payload[key]) : null;
    const currentValue = current ? display(current[column]) : null;
    return {
      key: key as string,
      label,
      current: currentValue,
      proposed,
      // On a create everything filled in is new. On an update, only a field the
      // submitter actually touched can count as a change.
      changed: current ? inProposal && currentValue !== proposed : proposed !== null,
      inProposal,
      isPrivate: Boolean(isPrivate),
    };
  });
}

export async function listPendingForReview(limit = 50): Promise<ReviewItem[]> {
  // Ranges come back whole and are checked in memory — a queue page should not
  // fire a query per row, and the table is a handful of rows.
  const [rows, rangeRows] = await Promise.all([
    db()`
      select s.id, s.kind, s.payload, s.created_at,
             s.submitter_name, s.submitter_email, s.submitter_note, s.referral_club,
             c.public_ref as target_public_ref,
             to_jsonb(c) - 'id' as current_car
      from submissions s
      left join cars c on c.id = s.target_car_id
      where s.status = 'pending'
      order by s.created_at asc
      limit ${limit}
    `,
    db()`
      select s.prefix, s.era_code, e.short_label as era_label,
             r.serial_from, r.serial_to
      from chassis_ranges r
      join chassis_series s on s.id = r.series_id
      join model_eras e on e.code = s.era_code
      order by r.serial_from
    `,
  ]);

  interface Range {
    from: number;
    to: number | null;
    eraCode: string;
    eraLabel: string;
  }

  const rangesByPrefix = new Map<string, Range[]>();
  for (const r of rangeRows) {
    const list = rangesByPrefix.get(r.prefix) ?? [];
    list.push({
      from: num(r.serial_from),
      to: r.serial_to === null ? null : num(r.serial_to),
      eraCode: r.era_code,
      eraLabel: r.era_label,
    });
    rangesByPrefix.set(r.prefix, list);
  }

  const format = (r: Range) =>
    r.to === null
      ? `${r.from.toLocaleString('en-US')} onwards`
      : `${r.from.toLocaleString('en-US')}–${r.to.toLocaleString('en-US')}`;

  /**
   * Checked against the *claimed* model, not just the prefix. FH runs from the
   * MkIV straight into the 1500, so `FH45231` filed as a 1500 is inside a real
   * FH range and still wrong — a prefix-only check would wave it through, and
   * that mismatch is the one worth a moderator's eye.
   */
  function checkRange(payload: SubmissionPayload): OutOfRange | null {
    const prefix = payload.chassisPrefix?.toUpperCase();
    const serial = payload.chassisSerial;
    if (!prefix || serial == null) return null;

    const list = rangesByPrefix.get(prefix);
    if (!list?.length) return null;

    const hit = (r: Range) => serial >= r.from && (r.to === null || serial <= r.to);
    const forClaimedEra = list.filter((r) => r.eraCode === payload.eraCode);

    // Nothing recorded for the model claimed — nothing to measure against.
    if (!forClaimedEra.length) return null;
    if (forClaimedEra.some(hit)) return null;

    const elsewhere = list.find((r) => hit(r) && r.eraCode !== payload.eraCode);

    return {
      prefix,
      serial,
      known: forClaimedEra.map(format),
      matchesInstead: elsewhere?.eraLabel ?? null,
    };
  }

  return rows.map((r) => {
    const diff = buildDiff(r.payload, r.current_car);
    return {
      id: r.id,
      kind: r.kind,
      targetPublicRef: r.target_public_ref ?? null,
      createdAt: r.created_at,
      submitterName: r.submitter_name ?? null,
      submitterEmail: r.submitter_email ?? null,
      submitterNote: r.submitter_note ?? null,
      referralClub: r.referral_club ?? null,
      payload: r.payload,
      diff,
      changedCount: diff.filter((d) => d.changed).length,
      outOfRange: checkRange(r.payload),
    };
  });
}

export interface QueueCounts {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
}

export async function getQueueCounts(): Promise<QueueCounts> {
  const [row] = await db()`
    select
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'approved' and reviewed_at > now() - interval '24 hours') as approved_today,
      count(*) filter (where status = 'rejected' and reviewed_at > now() - interval '24 hours') as rejected_today
    from submissions
  `;
  return {
    pending: num(row.pending),
    approvedToday: num(row.approved_today),
    rejectedToday: num(row.rejected_today),
  };
}

/** Cars contributed through each club's referral link. */
export interface ClubTally {
  slug: string;
  submitted: number;
  published: number;
}

export async function getClubTallies(): Promise<ClubTally[]> {
  const rows = await db()`
    select s.referral_club as slug,
           count(*) as submitted,
           count(c.id) filter (where c.status = 'published') as published
    from submissions s
    left join cars c on c.id = s.resulting_car_id
    where s.referral_club is not null
    group by s.referral_club
  `;
  return rows.map((r) => ({
    slug: r.slug,
    submitted: num(r.submitted),
    published: num(r.published),
  }));
}

export interface RecentReview {
  id: string;
  kind: string;
  status: string;
  reviewedAt: Date;
  reviewedBy: string | null;
  reviewNote: string | null;
  chassisNumber: string | null;
  resultingPublicRef: string | null;
}

export async function listRecentlyReviewed(limit = 15): Promise<RecentReview[]> {
  const rows = await db()`
    select s.id, s.kind, s.status, s.reviewed_at, s.reviewed_by, s.review_note,
           s.payload->>'chassisNumber' as chassis_number,
           c.public_ref as resulting_public_ref
    from submissions s
    left join cars c on c.id = s.resulting_car_id
    where s.status in ('approved', 'rejected')
    order by s.reviewed_at desc
    limit ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    reviewedAt: r.reviewed_at,
    reviewedBy: r.reviewed_by ?? null,
    reviewNote: r.review_note ?? null,
    chassisNumber: r.chassis_number ?? null,
    resultingPublicRef: r.resulting_public_ref ?? null,
  }));
}
