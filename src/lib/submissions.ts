import { db, num } from './db';
import { findCarIdByChassis } from './registry';
import type { SubmissionPayload, SubmissionMeta } from './validation';

/**
 * The moderation queue: creating proposals, and applying them to `cars`.
 *
 * Nothing here writes to `cars` except `applySubmission`, and that only runs
 * against a submission that is still pending. Approval is the single gate
 * between "someone typed this" and "the registry says this".
 */

export interface PendingSubmission {
  id: string;
  kind: 'create' | 'update';
  targetPublicRef: string | null;
  payload: SubmissionPayload;
  submitterName: string | null;
  submitterNote: string | null;
  createdAt: Date;
}

export interface CreatedSubmission {
  id: string;
  kind: 'create' | 'update';
  /** Set when the chassis number already exists — this is a correction. */
  targetPublicRef: string | null;
}

/**
 * Files a submission. If the chassis number is already registered this becomes
 * an `update` proposal against that car rather than a duplicate `create`, which
 * is what makes "spot an error and file a correction" work without letting
 * anyone overwrite an entry.
 */
export async function createSubmission(
  payload: SubmissionPayload,
  meta: SubmissionMeta,
  request: { ip: string | null; userAgent: string | null }
): Promise<CreatedSubmission> {
  const existing = await findCarIdByChassis(payload.chassisNormalized);
  const kind = existing ? 'update' : 'create';

  const [row] = await db()`
    insert into submissions (
      kind, target_car_id, payload,
      submitter_name, submitter_email, submitter_note,
      source_ip, user_agent
    ) values (
      ${kind}, ${existing?.id ?? null}, ${db().json(payload as any)},
      ${meta.submitterName}, ${meta.submitterEmail}, ${meta.submitterNote},
      ${request.ip}, ${request.userAgent}
    )
    returning id
  `;

  return { id: row.id, kind, targetPublicRef: existing?.publicRef ?? null };
}

/**
 * Crude but durable rate limit: how many submissions has this address filed in
 * the last hour? Backed by the table itself, so it survives restarts and needs
 * no extra store.
 *
 * Caveat: the address comes from X-Forwarded-For, which is only trustworthy
 * because Railway's proxy sets it. Do not rely on this if the app is ever
 * exposed directly.
 */
export async function recentSubmissionCount(ip: string | null): Promise<number> {
  if (!ip) return 0;
  const [row] = await db()`
    select count(*) as count
    from submissions
    where source_ip = ${ip}
      and created_at > now() - interval '1 hour'
  `;
  return num(row.count);
}

export async function listPending(limit = 50): Promise<PendingSubmission[]> {
  const rows = await db()`
    select s.id, s.kind, s.payload, s.submitter_name, s.submitter_note,
           s.created_at, c.public_ref as target_public_ref
    from submissions s
    left join cars c on c.id = s.target_car_id
    where s.status = 'pending'
    order by s.created_at asc
    limit ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    targetPublicRef: r.target_public_ref ?? null,
    payload: r.payload,
    submitterName: r.submitter_name ?? null,
    submitterNote: r.submitter_note ?? null,
    createdAt: r.created_at,
  }));
}

/** payload key -> cars column, for the fields a submission may set. */
const COLUMN_OF: Record<string, string> = {
  chassisNumber: 'chassis_number',
  chassisNormalized: 'chassis_normalized',
  chassisPrefix: 'chassis_prefix',
  chassisSerial: 'chassis_serial',
  chassisSuffix: 'chassis_suffix',
  eraCode: 'era_code',
  seriesId: 'series_id',
  modelYear: 'model_year',
  buildYear: 'build_year',
  firstRegisteredOn: 'first_registered_on',
  engineCc: 'engine_cc',
  engineNumber: 'engine_number',
  colour: 'colour',
  colourCode: 'colour_code',
  commissionPlatePresent: 'commission_plate_present',
  isModified: 'is_modified',
  modificationNotes: 'modification_notes',
  notes: 'notes',
  ownerName: 'owner_name',
  ownerCountry: 'owner_country',
  ownerRegion: 'owner_region',
  ownerCity: 'owner_city',
  showOwnerName: 'show_owner_name',
  showLocation: 'show_location',
};

/**
 * Columns to write for a correction: only the fields the submitter actually
 * filled in.
 *
 * Writing the whole payload would blank every field they left empty — someone
 * fixing one car's colour would wipe its year, engine, series and paint code.
 * Older submissions predate `provided`; those fall back to the full payload,
 * which is the behaviour they were reviewed under.
 */
export function toUpdateColumns(payload: SubmissionPayload): Record<string, unknown> {
  if (!Array.isArray(payload.provided)) return toCarColumns(payload);

  const columns: Record<string, unknown> = {};
  for (const key of payload.provided) {
    const column = COLUMN_OF[key];
    if (column) columns[column] = (payload as Record<string, any>)[key];
  }
  return columns;
}

/** Maps the whole validated payload onto `cars` columns. Used for new cars. */
function toCarColumns(payload: SubmissionPayload) {
  return {
    era_code: payload.eraCode,
    series_id: payload.seriesId,
    chassis_number: payload.chassisNumber,
    chassis_normalized: payload.chassisNormalized,
    chassis_prefix: payload.chassisPrefix,
    chassis_serial: payload.chassisSerial,
    chassis_suffix: payload.chassisSuffix,
    model_year: payload.modelYear,
    build_year: payload.buildYear,
    first_registered_on: payload.firstRegisteredOn,
    engine_cc: payload.engineCc,
    engine_number: payload.engineNumber,
    colour: payload.colour,
    colour_code: payload.colourCode,
    commission_plate_present: payload.commissionPlatePresent,
    is_modified: payload.isModified,
    modification_notes: payload.modificationNotes,
    notes: payload.notes,
    owner_name: payload.ownerName,
    owner_country: payload.ownerCountry,
    owner_region: payload.ownerRegion,
    owner_city: payload.ownerCity,
    show_owner_name: payload.showOwnerName,
    show_location: payload.showLocation,
  };
}

export type ReviewOutcome =
  | { ok: true; carPublicRef: string; kind: 'create' | 'update' }
  | { ok: false; reason: 'not_found' | 'already_reviewed' | 'conflict' | 'empty' };

/**
 * Approves a submission and writes it through to `cars`, in one transaction.
 *
 * The status check is inside the transaction and locks the row, so two
 * moderators clicking approve at the same moment cannot both apply it.
 */
export async function approveSubmission(
  id: string,
  reviewer: string
): Promise<ReviewOutcome> {
  const sql = db();

  try {
    return await sql.begin(async (tx) => {
      const [submission] = await tx`
        select id, kind, status, target_car_id, payload
        from submissions
        where id = ${id}
        for update
      `;

      if (!submission) return { ok: false, reason: 'not_found' } as const;
      if (submission.status !== 'pending') {
        return { ok: false, reason: 'already_reviewed' } as const;
      }

      let carId: string;
      let publicRef: string;

      if (submission.kind === 'update' && submission.target_car_id) {
        // Merge, don't replace — see toUpdateColumns.
        const columns = toUpdateColumns(submission.payload);
        if (Object.keys(columns).length === 0) {
          return { ok: false, reason: 'empty' } as const;
        }

        const [updated] = await tx`
          update cars set ${tx(columns)}
          where id = ${submission.target_car_id}
          returning id, public_ref
        `;
        if (!updated) return { ok: false, reason: 'not_found' } as const;
        carId = updated.id;
        publicRef = updated.public_ref;
      } else {
        // A new car takes the whole payload; unfilled columns fall to their
        // defaults, which is what they mean on a create.
        const columns = toCarColumns(submission.payload);
        const [created] = await tx`
          insert into cars ${tx({ ...columns, source: 'submission' })}
          returning id, public_ref
        `;
        carId = created.id;
        publicRef = created.public_ref;
      }

      await tx`
        update submissions
        set status = 'approved',
            reviewed_at = now(),
            reviewed_by = ${reviewer},
            resulting_car_id = ${carId}
        where id = ${id}
      `;

      return { ok: true, carPublicRef: publicRef, kind: submission.kind } as const;
    });
  } catch (err: any) {
    // Unique violation on chassis_normalized: a create was approved for a
    // chassis number that got registered in the meantime.
    if (err?.code === '23505') return { ok: false, reason: 'conflict' };
    throw err;
  }
}

export async function rejectSubmission(
  id: string,
  reviewer: string,
  note: string | null
): Promise<ReviewOutcome> {
  const [row] = await db()`
    update submissions
    set status = 'rejected',
        reviewed_at = now(),
        reviewed_by = ${reviewer},
        review_note = ${note}
    where id = ${id} and status = 'pending'
    returning id
  `;

  if (!row) return { ok: false, reason: 'already_reviewed' };
  return { ok: true, carPublicRef: '', kind: 'create' };
}
