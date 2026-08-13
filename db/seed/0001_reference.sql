-- Reference data: production history, not registry data.
--
-- Production totals are the widely-published factory figures also used by the
-- International Triumph Spitfire Database and the marque clubs. They are the
-- denominator for every "share of production" figure on the site.
--
-- Idempotent: safe to re-run.

insert into model_eras (code, ordinal, name, short_label, year_from, year_to, units_built, engine_cc, blurb) values
  ('mk1',  1, 'Spitfire 4',      'Mk1',  1962, 1965,  45753, 1147,
   'Michelotti''s body over the Herald frame, drivetrain and independent suspension. Roll-up windows in a class that mostly did not have them.'),
  ('mk2',  2, 'Spitfire 4 Mk2',  'Mk2',  1965, 1967,  37409, 1147,
   'Same silhouette and the same 1,147cc four, with a warmer camshaft and a tidier interior.'),
  ('mk3',  3, 'Spitfire Mk3',    'Mk3',  1967, 1970,  65320, 1296,
   'Engine out to 1,296cc with a redesigned four-port head, and the raised front bumper that answered US regulations.'),
  ('mk4',  4, 'Spitfire MkIV',   'MkIV', 1971, 1974,  70021, 1296,
   'Michelotti back for a second pass: squared-off tail, and a reworked rear suspension that settled the cornering argument.'),
  ('1500', 5, 'Spitfire 1500',   '1500', 1973, 1981,  95829, 1493,
   'The block stroked to 1,493cc. Emissions equipment on US-market cars quietly ate most of the gain.')
on conflict (code) do update set
  ordinal     = excluded.ordinal,
  name        = excluded.name,
  short_label = excluded.short_label,
  year_from   = excluded.year_from,
  year_to     = excluded.year_to,
  units_built = excluded.units_built,
  engine_cc   = excluded.engine_cc,
  blurb       = excluded.blurb;

-- Commission-number series. serial_from / serial_to are left null on purpose:
-- see docs/data-model.md. Publishing a range implies we can stand behind it,
-- and these need sourcing from BMH build records first.
insert into chassis_series (id, prefix, era_code, ordinal, label, market, year_from, year_to, notes) values
  ('fc-mk1',   'FC',  'mk1',  1, 'FC series — Mk1',            'worldwide',      1962, 1965,
   'Opening commission sequence, carried straight through into the Mk2.'),
  ('fc-mk2',   'FC',  'mk2',  2, 'FC series — Mk2',            'worldwide',      1965, 1967,
   'Continues the Mk1 sequence rather than restarting it.'),
  ('fd-mk3',   'FD',  'mk3',  3, 'FD series — Mk3',            'worldwide',      1967, 1970,
   'New prefix for the 1,296cc car.'),
  ('fh-mk4',   'FH',  'mk4',  4, 'FH series — MkIV',           'worldwide',      1970, 1974,
   'Opens with the MkIV and does not stop when the 1500 arrives.'),
  ('fm-1500',  'FM',  '1500', 5, 'FM series — 1500, N. America','north-america', 1973, 1978,
   'A separate sequence opened in 1973 to bring the 1500 to the US and Canada while the rest of the world was still buying MkIVs.'),
  ('fh-1500',  'FH',  '1500', 6, 'FH series — 1500, rest of world', 'rest-of-world', 1975, 1980,
   'Continues the numbering Triumph started with the MkIV. Used on every pre-VIN 1500 outside North America.'),
  ('vin-1500', 'VIN', '1500', 7, 'VIN series — 1979–81',       'worldwide',      1979, 1981,
   'Cars built under the modern VIN system, in serial order — model-year labels do not always track cleanly with the sequence.')
on conflict (id) do update set
  prefix    = excluded.prefix,
  era_code  = excluded.era_code,
  ordinal   = excluded.ordinal,
  label     = excluded.label,
  market    = excluded.market,
  year_from = excluded.year_from,
  year_to   = excluded.year_to,
  notes     = excluded.notes;
