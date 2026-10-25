begin;
alter table caderno.actions drop constraint if exists actions_category_check;
alter table caderno.actions add constraint actions_category_check check(category in ('banks','stations','oil','stores','other','burned_city'));
create or replace function caderno.prize(category text,title text) returns bigint language sql immutable set search_path='' as $$
 select case when category='burned_city' or caderno.name_key(title) like '%cidadequeimada%' then 750000
 when category='banks' then case when lower(title) ~ '\m(armadillo|am)\M' then 1350000 else 1125000 end
 when category='stations' then case when lower(title) ~ '\m(armadillo|am)\M' then 900000 else 750000 end
 when category='oil' then 1350000 when category='stores' then 425000 else null end;
$$;
commit;
