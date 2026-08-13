-- Public references were assigned by the seed script, which is fine for
-- synthetic data and useless the moment two submissions are approved at once.
-- Hand the job to a sequence so allocation is atomic.

create sequence car_public_ref_seq;

-- Start ahead of anything already assigned, so existing rows keep their refs.
select setval(
  'car_public_ref_seq',
  greatest(
    coalesce(
      (select max(substring(public_ref from 'SP-([0-9]+)')::bigint) from cars),
      0
    ),
    1
  )
);

alter table cars
  alter column public_ref
  set default 'SP-' || lpad(nextval('car_public_ref_seq')::text, 5, '0');
