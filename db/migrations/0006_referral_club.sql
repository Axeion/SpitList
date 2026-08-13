-- Which club sent a submission our way.
--
-- Clubs are being asked to hand their members a link. "Forty-two cars arrived
-- through yours" is the only answer that makes that ask worth repeating, and it
-- cannot be reconstructed after the fact.
--
-- Stored on submissions rather than cars: every approved car keeps its
-- submission row, so attribution survives without duplicating it.

alter table submissions add column referral_club text;

create index submissions_referral_club_idx
  on submissions (referral_club) where referral_club is not null;

comment on column submissions.referral_club is
  'Slug of the club whose link produced this submission. Validated against '
  'src/data/clubs.ts on the way in — never a free-text value from the query string.';
