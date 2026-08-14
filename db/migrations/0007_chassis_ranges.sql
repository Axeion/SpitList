-- Commission-number ranges, with provenance.
--
-- Two things forced a separate table rather than filling in
-- chassis_series.serial_from / serial_to:
--
--   1. Ranges are not contiguous. The Mk3 runs FD1–FD15306, then
--      FD20000–FD51967, then FD75000–FD92803. One pair of columns cannot hold
--      that, and the gaps matter — a serial inside one is not a valid car of
--      that model, which is the basis for validating a submission.
--   2. chassis_series has `unique (prefix, era_code)`, so the obvious
--      workaround of one series row per range is not available.
--
-- Every range carries where it came from. A registry that asks owners to trust
-- its data has to be able to answer "says who", and a range that turns out to be
-- wrong needs to be traceable to the document that supplied it.

create table chassis_ranges (
  id           bigserial primary key,
  series_id    text not null references chassis_series (id) on delete cascade,

  serial_from  integer not null,
  -- Nullable, and that is the point. The 1500 sequences are documented as
  -- "FH75001 onwards" and "FM28001U onwards" — no source gives a closing
  -- number. Inventing one would either reject a real car above the guess or
  -- pass off a guess as a fact; an open upper bound says exactly what is known.
  serial_to    integer,
  -- Null where a range spans model years rather than identifying one.
  model_year   smallint,
  note         text,

  source       text not null,
  source_url   text,
  retrieved_on date,

  -- Only true where two independent sources agree. Unverified ranges are shown
  -- to the reader labelled as such; they never drive an unqualified claim.
  verified     boolean not null default false,

  created_at   timestamptz not null default now(),

  check (serial_to is null or serial_to >= serial_from),
  -- One row per (series, starting number). Without this the seed has nothing to
  -- upsert against and every re-run duplicates the table.
  unique (series_id, serial_from)
);

create index chassis_ranges_series_idx on chassis_ranges (series_id);
create index chassis_ranges_lookup_idx on chassis_ranges (series_id, serial_from, serial_to);

comment on column chassis_ranges.verified is
  'True only where two independent sources agree. The decoder qualifies '
  'anything false rather than hiding it.';

comment on column chassis_series.serial_from is
  'Superseded by chassis_ranges. Never populated; kept until that table is in '
  'use everywhere, then dropped.';
comment on column chassis_series.serial_to is
  'Superseded by chassis_ranges. See serial_from.';
