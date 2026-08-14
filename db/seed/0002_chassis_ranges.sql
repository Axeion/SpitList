-- Commission-number ranges, with provenance.
--
-- Two independent compilations were captured verbatim before anything here was
-- written:
--
--   docs/sources/iw-models-options.md   Spitfire & GT6 Information Warehouse
--   docs/sources/amicale-serials.md     Amicale Spitfire Club serial tables
--
-- `verified = true` means both of them assert the same thing. It is set on
-- fewer rows than you might expect, because the two sources are not
-- symmetrical: the Amicale tables give *opening* numbers and production
-- totals, while only the Information Warehouse gives closing numbers. So every
-- range whose end matters is single-source, and every range that is only a
-- starting point is corroborated.
--
-- That asymmetry is worth stating plainly rather than papering over. It means
-- the decoder can say "this is a 1500" with confidence and cannot say "this is
-- the 4,112th of 44,656 Mk1s" at all.
--
-- Where the two sources disagreed — the Information Warehouse reads the `L`
-- suffix as right-hand drive, the Amicale as left-hand — no range was affected,
-- and the disagreement is recorded in docs/sources/iw-models-options.md rather
-- than silently resolved.
--
-- Idempotent: keyed on (series_id, serial_from), so re-running updates in place.

insert into chassis_ranges
  (series_id, serial_from, serial_to, model_year, note, source, source_url, retrieved_on, verified)
values
  -- Mk1 ---------------------------------------------------------------------
  -- Both sources open the sequence at FC1 and agree on 45,573 cars. Only the
  -- Information Warehouse closes it, so the range is unverified.
  ('fc-mk1', 1, 44656, null,
   'Oct 1962 – Dec 1964. Opening number corroborated; the closing number FC44656 comes from one source only.',
   'Spitfire & GT6 Information Warehouse (range); Amicale Spitfire Club (opening number, production total)',
   'https://triumphspitfire.com/reference-pages/spitfire-gt6-models-and-options/',
   '2026-08-13', false),

  -- Mk2 ---------------------------------------------------------------------
  -- FC50001 is given by both sources. FC88912 by one.
  ('fc-mk2', 50001, 88912, null,
   'Dec 1964 – Jan 1967. Continues the Mk1 sequence after a gap rather than restarting. FC50001 is corroborated; the closing number is not.',
   'Spitfire & GT6 Information Warehouse (range); Amicale Spitfire Club (opening number, production total)',
   'https://triumphspitfire.com/reference-pages/spitfire-gt6-models-and-options/',
   '2026-08-13', false),

  -- Mk3: three separate blocks, not one range -------------------------------
  -- The Amicale table lists the Mk3 as plain "FD" with no numbers at all, so
  -- the three-block structure rests entirely on the Information Warehouse.
  ('fd-mk3', 1, 15306, null,
   'First Mk3 block. Single source; the Amicale tables give the FD prefix but no numbers.',
   'Spitfire & GT6 Information Warehouse',
   'https://triumphspitfire.com/reference-pages/spitfire-gt6-models-and-options/',
   '2026-08-13', false),
  ('fd-mk3', 20000, 51967, null,
   'Second Mk3 block. FD15307–FD19999 is a gap: no Mk3 is recorded with a number in it. Single source.',
   'Spitfire & GT6 Information Warehouse',
   'https://triumphspitfire.com/reference-pages/spitfire-gt6-models-and-options/',
   '2026-08-13', false),
  ('fd-mk3', 75000, 92803, null,
   'Third Mk3 block, from around Oct 1969. FD51968–FD74999 is a gap. Single source.',
   'Spitfire & GT6 Information Warehouse',
   'https://triumphspitfire.com/reference-pages/spitfire-gt6-models-and-options/',
   '2026-08-13', false),

  -- MkIV --------------------------------------------------------------------
  -- The Amicale body-number column reads "1 FH", which agrees that the
  -- sequence starts at 1 rather than the Information Warehouse's FH3. Both
  -- readings are within a rounding error of each other and neither is
  -- corroborated, so the range opens at 1 and stays unverified.
  ('fh-mk4', 1, 64995, null,
   'Nov 1970 – Nov 1974. Rest of world; North America used FK, then FM. One source gives FH3 as the first number and the other FH1 — the range opens at 1 so neither is excluded.',
   'Spitfire & GT6 Information Warehouse (closing number); Amicale Spitfire Club (opening number)',
   'https://triumphspitfire.com/reference-pages/spitfire-gt6-models-and-options/',
   '2026-08-13', false),

  -- 1500 --------------------------------------------------------------------
  -- Both of these are open-ended in both sources: "FH75001 onwards",
  -- "FM28001U onwards". The opening numbers are the entire claim, and both
  -- sources make it, so these two rows are the verified ones.
  ('fh-1500', 75001, null, null,
   'From Nov 1974, UK, Europe and the rest of the world. Both sources give FH75001 as the first 1500; neither records a closing number, so a number above it identifies a 1500 but does not date it.',
   'Spitfire & GT6 Information Warehouse; Amicale Spitfire Club',
   'https://triumphspitfire.com/reference-pages/spitfire-gt6-models-and-options/',
   '2026-08-13', true),
  ('fm-1500', 28001, null, null,
   'North American 1500s from FM28001U. Both sources give the opening number; neither records a closing number. Numbers below FM28001 are the 1973–74 North American cars — MkIV bodyshells with the 1500 engine, which this registry files under the 1500.',
   'Spitfire & GT6 Information Warehouse; Amicale Spitfire Club',
   'https://triumphspitfire.com/reference-pages/spitfire-gt6-models-and-options/',
   '2026-08-13', true)

on conflict (series_id, serial_from) do update set
  serial_to    = excluded.serial_to,
  model_year   = excluded.model_year,
  note         = excluded.note,
  source       = excluded.source,
  source_url   = excluded.source_url,
  retrieved_on = excluded.retrieved_on,
  verified     = excluded.verified;

-- No ranges for fdu-mk3, 7fd-mk3, fk-mk4, fl-mk4, 1fm-1500 or vin-1500. Both
-- sources name those prefixes; neither gives numbers for them. An empty result
-- from resolveSerial() on those prefixes is correct and the decoder says so.
