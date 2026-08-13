# Bulk import

For loading a dataset someone has given you — a club roster, a spreadsheet, an
export from another registry — into the review queue.

```bash
npm run import -- roster.csv --source "TSSC roster 2026"            # dry run
npm run import -- roster.csv --source "TSSC roster 2026" --commit
npm run import -- --rollback import-2026-08-13-a3f9                 # undo
```

## Before anything else: provenance

`--source` is required. An imported row with no recorded origin is
indistinguishable from one an owner sent in, and the difference matters — this
registry's claim is that entries are contributed and corrected by owners.

**Only import data you have permission to use.** A registry's compiled contents
are the product of someone's work, and in the UK and EU are protected as such
independently of copyright. Owner names and locations carry a second problem:
those people consented to being listed *somewhere else*. That is why the
importer never sets the visibility flags — see below.

## Dry run is the default

Nothing is written without `--commit`. The dry run prints:

- the **column mapping** it detected, so you can catch `year` landing in the
  wrong field before 4,000 rows do
- how many rows are new cars vs corrections to chassis numbers already on file
- every row it cannot use, with line numbers

Check the mapping. It is the single most common way an import goes wrong.

## What it does with a row

Rows are converted to form fields and pushed through `validateSubmission` — the
same function the public form uses. An importer with its own rules would drift
from the form's, and the two would disagree about what a valid car is.

That reuse also brings the `provided` tracking: a roster with only chassis
number, model and colour produces a correction touching only those three fields.
Importing a thin dataset over rich existing entries cannot blank them.

**Era resolution.** Taken from the model column where it is recognisable
(`Mk3`, `MKIII`, `1500`, `Mark 3` all work). Where it is missing, the era is
inferred from the chassis prefix — but only when the prefix belongs to exactly
one era. `FC` spans Mk1 and Mk2, `FH` spans MkIV and the 1500, so those rows are
reported rather than guessed at.

**Visibility is never imported.** `show_owner_name` and `show_location` are
always false on imported rows, whatever the spreadsheet says. Someone else's
roster cannot consent on an owner's behalf. Owner details are stored so a
moderator can use them, and stay unpublished until the owner asks otherwise.

**No Discord notification.** The webhook fires from the web form, not from here,
which is what stops a 4,000-row import from posting 4,000 cards.

## Reviewing

By default rows land in `submissions` as pending, and appear in
`/admin/submissions` like any other.

For a source you trust wholesale, `--auto-approve` applies them directly and
records `reviewed_by` as `import: <source>`. That is a human deciding once for a
batch rather than clicking through thousands of identical cards — the decision
still happens and is still recorded, just at batch granularity.

Every imported car keeps a submission row pointing at it, so the origin of any
individual entry stays answerable.

## Rolling back

```bash
npm run import -- --rollback import-2026-08-13-a3f9
```

Removes the batch's submissions, and the cars it created.

**Two things it deliberately does not do:**

1. **Cars edited since the import are kept**, and reported. Undoing them would
   discard work someone did afterwards, which is worse than leaving a stray row.
2. **Corrections applied to pre-existing cars are not reverted.** The importer
   does not store previous field values, so a rollback cannot restore them. If a
   batch contained corrections to established entries, treat the rollback as
   partial and check those cars by hand. Reverting them properly needs a
   per-field audit log, which does not exist yet.

Given (2), prefer running corrections-heavy imports **without** `--auto-approve`
so they can be judged individually before they touch anything.

## Column names

Headers are matched case- and punctuation-insensitively against a list of
aliases, so `Chassis No.`, `chassis_number` and `COMMISSION NUMBER` all land in
the same place. Unrecognised columns are listed as ignored rather than silently
dropped.

Recognised: chassis number, model/era, series, model year, build year, first
registered, engine cc, engine number, colour, paint code, notes, modifications,
owner name, city, region, country.

See [`import-template.csv`](import-template.csv) for a starting point.
