-- Spitplate registry — initial schema.
--
-- Shape notes:
--   * `cars` is the canonical, public registry. A row only exists here once a
--     moderator has approved it.
--   * `submissions` is the moderation queue. It holds *proposed* creates and
--     *proposed* edits to existing cars, so an owner correcting someone else's
--     entry does not mutate the registry until it is reviewed. This is what the
--     "corrected by owners" promise costs structurally.
--   * Owner identity and location default to private. `show_owner_name` and
--     `show_location` are the only things that may reveal them, and
--     `contact_email` is never public under any flag.

create type car_status as enum ('published', 'archived');
create type submission_kind as enum ('create', 'update');
create type submission_status as enum ('pending', 'approved', 'rejected', 'withdrawn');

-- ---------------------------------------------------------------------------
-- Reference data: how Triumph actually built and numbered the car.
-- ---------------------------------------------------------------------------

create table model_eras (
  code          text primary key,          -- 'mk1' | 'mk2' | 'mk3' | 'mk4' | '1500'
  ordinal       smallint not null unique,
  name          text     not null,          -- 'Spitfire Mk3'
  short_label   text     not null,          -- 'Mk3'
  year_from     smallint not null,
  year_to       smallint not null,
  units_built   integer  not null,
  engine_cc     integer,
  blurb         text
);

comment on column model_eras.units_built is
  'Factory production total. Public production history, not registry data — '
  'this is the denominator the registered count is measured against.';

-- One row per (commission-number prefix x era) segment. A prefix can span more
-- than one era (FC covers Mk1 and Mk2; FH covers MkIV and rest-of-world 1500),
-- which is why this is not keyed on the prefix alone.
create table chassis_series (
  id            text primary key,           -- 'fh-1500'
  prefix        text     not null,          -- 'FH'
  era_code      text     not null references model_eras (code) on delete restrict,
  ordinal       smallint not null,
  label         text     not null,
  market        text     not null,          -- 'worldwide' | 'north-america' | 'rest-of-world'
  year_from     smallint,
  year_to       smallint,
  -- Serial ranges are intentionally nullable and unverified for now. See
  -- docs/data-model.md — these need sourcing from BMH build records before
  -- anything in the app treats them as authoritative.
  serial_from   integer,
  serial_to     integer,
  notes         text,
  unique (prefix, era_code)
);

-- ---------------------------------------------------------------------------
-- The registry.
-- ---------------------------------------------------------------------------

create table cars (
  id                  uuid primary key default gen_random_uuid(),
  public_ref          text not null unique,       -- 'SP-00001', stable external handle

  era_code            text not null references model_eras (code) on delete restrict,
  series_id           text references chassis_series (id) on delete set null,

  -- Chassis / commission number, kept both as written and as parsed.
  chassis_number      text not null,              -- as submitted: 'FH 45231 L'
  chassis_normalized  text not null,              -- 'FH45231L', uppercase alnum
  chassis_prefix      text,                       -- 'FH'
  chassis_serial      bigint,                     -- 45231
  chassis_suffix      text,                       -- 'L' (LHD), 'O' (overdrive), ...

  -- Method note: where build date and first registration disagree, registration
  -- wins; `model_year` is the resolved judgment, the other two are the evidence.
  model_year          smallint,
  build_year          smallint,
  first_registered_on date,

  engine_cc           integer,
  engine_number       text,
  commission_plate_present boolean not null default true,

  colour              text,
  colour_code         text,

  -- Swaps and conversions stay in the registry as long as the car still carries
  -- its original commission number.
  is_modified         boolean not null default false,
  modification_notes  text,
  notes               text,

  -- Owner block. Private by default; see the two show_* flags.
  owner_name          text,
  owner_country       char(2),                    -- ISO 3166-1 alpha-2
  owner_region        text,
  owner_city          text,
  show_owner_name     boolean not null default false,
  show_location       boolean not null default false,
  contact_email       text,                       -- never rendered publicly

  status              car_status not null default 'published',
  source              text not null default 'submission',  -- 'submission'|'club'|'import'|'seed'

  first_listed_at     timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column cars.contact_email is
  'Moderator contact only. No query in the public app may select this column.';

create unique index cars_chassis_normalized_key on cars (chassis_normalized);
create index cars_era_idx        on cars (era_code);
create index cars_series_idx     on cars (series_id);
create index cars_status_idx     on cars (status);
create index cars_model_year_idx on cars (model_year);
create index cars_country_idx    on cars (owner_country) where show_location;
create index cars_serial_idx     on cars (chassis_prefix, chassis_serial);
-- Prefix search ("FH452...") over the normalized form.
create index cars_chassis_prefix_search_idx on cars (chassis_normalized text_pattern_ops);

-- ---------------------------------------------------------------------------
-- Moderation queue.
-- ---------------------------------------------------------------------------

create table submissions (
  id              uuid primary key default gen_random_uuid(),
  kind            submission_kind not null,
  target_car_id   uuid references cars (id) on delete set null,   -- set for 'update'
  payload         jsonb not null,                                  -- proposed field values

  submitter_name  text,
  submitter_email text,
  submitter_note  text,

  status          submission_status not null default 'pending',
  review_note     text,
  reviewed_at     timestamptz,
  reviewed_by     text,
  resulting_car_id uuid references cars (id) on delete set null,   -- set on approval

  source_ip       inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index submissions_queue_idx on submissions (status, created_at desc);
create index submissions_target_idx on submissions (target_car_id) where target_car_id is not null;

-- ---------------------------------------------------------------------------

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cars_set_updated_at
  before update on cars
  for each row execute function set_updated_at();
