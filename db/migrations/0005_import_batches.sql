-- Bulk imports need to be undoable.
--
-- A batch label on both tables makes "load 4,000 club rows, discover the year
-- column was off by one, undo it" a single operation instead of an archaeology
-- project. Without this, an import is indistinguishable from organic data the
-- moment it lands.

alter table submissions add column import_batch text;
alter table cars        add column import_batch text;

create index submissions_import_batch_idx on submissions (import_batch) where import_batch is not null;
create index cars_import_batch_idx        on cars (import_batch)        where import_batch is not null;

comment on column cars.import_batch is
  'Set by scripts/import.ts. Identifies the batch a row arrived in, so it can '
  'be rolled back. Null for organic submissions.';
