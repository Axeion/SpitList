# Data model

Migrations live in `db/migrations/` and run in filename order. `db/seed/`
holds reference data plus the placeholder-car generator.

## Tables

### `model_eras`

The five production series, with the factory build total for each. This is
public production history, not registry data — it is the denominator every
"share of production" figure is measured against, and it does not change as
cars are added.

### `chassis_series`

Commission-number series, one row per **(prefix × era)** segment. A prefix can
span more than one era, which is why this is not keyed on the prefix alone:

| id | prefix | era | market |
| --- | --- | --- | --- |
| `fc-mk1` | FC | Mk1 | worldwide |
| `fc-mk2` | FC | Mk2 | worldwide |
| `fd-mk3` | FD | Mk3 | worldwide |
| `fh-mk4` | FH | MkIV | worldwide |
| `fm-1500` | FM | 1500 | North America |
| `fh-1500` | FH | 1500 | rest of world |
| `vin-1500` | VIN | 1500 | worldwide |
| `fdu-mk3` | FDU | Mk3 | North America |
| `7fd-mk3` | 7FD | Mk3 | North America |
| `fk-mk4` | FK | MkIV | North America |
| `fl-mk4` | FL | MkIV | rest of world |
| `1fm-1500` | 1FM | 1500 | North America |

> **`serial_from` / `serial_to` on this table are dead.** They are commented as
> superseded and never populated. Ranges live in `chassis_ranges`.

### `chassis_ranges`

Commission-number ranges, one row per contiguous block, each carrying its own
provenance. Introduced in `db/migrations/0007_chassis_ranges.sql`.

Three things forced a separate table rather than two columns on `chassis_series`:

1. **Ranges are not contiguous.** The Mk3 runs `FD1–FD15306`, then
   `FD20000–FD51967`, then `FD75000–FD92803`. The gaps carry information — a
   serial inside one is not a recorded car of that model.
2. **`chassis_series` has `unique (prefix, era_code)`**, so one series row per
   range is not available.
3. **Each range needs its own source.** A registry that asks owners to trust its
   data has to be able to answer "says who", and a range that turns out to be
   wrong has to be traceable to the document that supplied it.

`serial_to` is **nullable**. The 1500 sequences are documented as "FH75001
onwards" and "FM28001U onwards" — no source gives a closing number, and
inventing one would either reject a real car above the guess or pass a guess off
as a fact.

#### The two-source rule

`verified` is true only where two independent captured sources assert the same
thing. Everything else is stored, shown, and labelled as single-source rather
than hidden — that is more useful than silence and more honest than a bare
assertion.

The sources themselves live in `docs/sources/`, transcribed verbatim with a
retrieval date, so a future disagreement can be settled without re-researching.
Two are captured today: the Spitfire & GT6 Information Warehouse and the Amicale
Spitfire Club serial tables.

They are not symmetrical, and it shows in the data. The Amicale tables give
*opening* numbers and production totals; only the Information Warehouse gives
closing numbers. So every range whose end matters is unverified, and the two
verified rows are the two open-ended ones whose entire claim is a starting
number.

The rule has already earned its keep: the Information Warehouse reads suffix `L`
as right-hand drive, and the Amicale — with the Vintage Triumph Register and the
team.net prefix list — as left-hand. Three to one, so `L` is left-hand drive on
this site, and the disagreement is recorded in
`docs/sources/iw-models-options.md` rather than quietly resolved.

#### Who reads it

- `registry.resolveSerial(prefix, serial)` — every match, ordered verified first.
  A prefix spanning two eras can match more than one, and the caller shows that
  rather than picking.
- `/reference/decoder` — names the era and the source, and says explicitly when a
  serial falls in a gap.
- `/admin/submissions` and `scripts/import.ts` — **advisory only**. An
  out-of-range serial is flagged, never rejected. A registry whose premise is
  filling gaps in the record cannot turn a car away for sitting in one.

`src/lib/decode.ts` does not read this table and takes no database at all.

The seed script keeps its own *placeholder* bands for generating synthetic
numbers. They now track these ranges, so seeded cars don't trip the
out-of-range flag on every dev machine, but they are still local to the script
and must not be promoted into this table.

### `cars`

The canonical public registry. A row exists here only once a moderator has
approved it.

**Chassis number** is stored three ways: `chassis_number` as the owner wrote it,
`chassis_normalized` (uppercase alphanumeric, uniquely indexed) for lookup and
duplicate detection, and the parsed `chassis_prefix` / `chassis_serial` /
`chassis_suffix` for range queries and sorting.

**Dates.** `build_year`, `first_registered_on`, and `model_year` are separate on
purpose. Where build date and first registration disagree, registration wins and
`model_year` records that judgment — but both inputs stay so the call can be
re-litigated rather than re-guessed.

**Privacy.** Owner identity is private by default:

| Column | Public when |
| --- | --- |
| `owner_name` | `show_owner_name = true` |
| `owner_country`, `owner_region`, `owner_city` | `show_location = true` |
| `contact_email` | **never** |

`contact_email` is moderator-contact only. No query in the public app may select
it. Both flags default to `false`, so a submission that says nothing about
visibility publishes nothing about the owner.

**Modified cars** stay in the registry (`is_modified`, `modification_notes`) as
long as the car still carries its original commission number. If the plate is
gone, `commission_plate_present` goes false and the entry moves to
`status = 'archived'` rather than being deleted — an archived car still counts
as a known chassis, just not as a survivor.

### `submissions`

The moderation queue, and the reason `cars` can be trusted.

A submission is a *proposal*: `kind = 'create'` for a new car, `kind = 'update'`
for a correction against an existing one (`target_car_id`). The proposed values
live in `payload` (jsonb) and are applied to `cars` only on approval, at which
point `resulting_car_id` links the two.

Keeping corrections out of `cars` until review is what stops "anyone can correct
an entry" from becoming "anyone can overwrite an entry."

## Views

| View | Purpose |
| --- | --- |
| `registry_stats_by_era` | Built vs. registered vs. share, per era. Drives the era cards and the stats table. |
| `registry_totals` | Whole-registry rollup. Drives the odometer and the plate. |
| `registry_intake_by_month` | Additions per month. Drives the "about N new cars a month" line and the admin view. |

All three count `status = 'published'` only, so archived cars drop out of the
survivor counts while staying in the database.

These are plain views rather than materialized ones: the registry is small and
the join is a sequential scan over a few thousand rows. Revisit if that changes.

## Seed data

`npm run db:seed` does two separate things:

1. **Reference data** (`db/seed/0001_reference.sql`) — real production figures
   and series definitions. Idempotent upserts; safe in production.
2. **Placeholder cars** — synthetic entries so the stats surfaces have something
   live to read. Every one carries `source = 'seed'`, and the script deletes all
   `source = 'seed'` rows before regenerating, so re-seeding never touches real
   submissions and synthetic rows can always be swept:

   ```sql
   delete from cars where source = 'seed';
   ```

The generator sets locations and visibility flags but **never invents an owner
name**, so no fictional person can ever appear in the registry.

## Reading the registry

Every public query lives in `src/lib/registry.ts`, behind a single privacy
boundary. Owner identity is resolved once, there:

- `owner_name` only when `show_owner_name`
- location fields only when `show_location`
- `contact_email` is never selected at all

Country filtering is gated on `show_location` too — filtering on a hidden
location would leak it by inference. There is deliberately no "raw car" query
for public pages: if a field needs exposing, it gets exposed in that module or
not at all.

## Still to build

- Full-text / trigram search across chassis numbers and notes. Search is a
  substring `LIKE` today — a sequential scan, fine at this size. There is a
  `text_pattern_ops` index for prefix matching; `pg_trgm` if fuzzy matching is
  wanted later.
- A second source for the range *ends*. Every closing number we hold comes from
  one compilation. A club with a per-year breakdown, or a set of Heritage
  certificates, would let those rows go `verified` and give the decoder a model
  year rather than only a model.
- Ranges for `FDU`, `7FD`, `FK`, `FL` and `1FM`. Both sources name the prefixes;
  neither gives numbers for them.
- Dropping the dead `chassis_series.serial_from` / `serial_to` columns.
