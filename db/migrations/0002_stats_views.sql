-- Live registry statistics. These are the source for the odometer, the era
-- cards, and the stats table — nothing on the page hardcodes a count.
--
-- Plain views, not materialized: the registry is small and the join is a
-- sequential scan over a few thousand rows. Revisit only if that stops being
-- true.

create view registry_stats_by_era as
select
  e.code,
  e.ordinal,
  e.name,
  e.short_label,
  e.year_from,
  e.year_to,
  e.engine_cc,
  e.blurb,
  e.units_built,
  count(c.id) filter (where c.status = 'published') as registered,
  round(
    count(c.id) filter (where c.status = 'published')::numeric
      / nullif(e.units_built, 0) * 100,
    2
  ) as share_pct
from model_eras e
left join cars c on c.era_code = e.code
group by e.code, e.ordinal, e.name, e.short_label, e.year_from, e.year_to,
         e.engine_cc, e.blurb, e.units_built;

create view registry_totals as
select
  (select sum(units_built) from model_eras)::bigint as units_built,
  count(*) filter (where status = 'published')       as registered,
  count(*) filter (where status = 'archived')        as archived,
  round(
    count(*) filter (where status = 'published')::numeric
      / nullif((select sum(units_built) from model_eras), 0) * 100,
    2
  ) as share_pct,
  max(first_listed_at) filter (where status = 'published') as last_listed_at
from cars;

-- Rolling intake, for the "about N new cars a month" line and the admin view.
create view registry_intake_by_month as
select
  date_trunc('month', first_listed_at) as month,
  count(*) as added
from cars
where status = 'published'
group by 1
order by 1 desc;
