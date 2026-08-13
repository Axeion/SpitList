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

> **`serial_from` / `serial_to` are deliberately NULL.** Publishing a serial
> range implies we can stand behind it, and these need sourcing from British
> Motor Heritage build records or club documentation first. The seed script has
> its own *placeholder* bands for generating synthetic numbers; those are local
> to the script and must not be promoted into this table.

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

## Still to build

- Applying an approved submission to `cars` (the write path).
- Full-text / trigram search across chassis numbers and notes. There is a
  `text_pattern_ops` index for prefix matching now; `pg_trgm` if fuzzy matching
  is wanted later.
- Sourcing real serial ranges for `chassis_series`.
