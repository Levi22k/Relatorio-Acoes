-- Apply after the existing incremental migrations. No passwords belong here.
begin;
create table if not exists caderno.administrators (
 login text primary key check(login='levi'),
 user_id uuid not null unique references auth.users(id)
);
alter table caderno.administrators enable row level security;
revoke all on caderno.administrators from public,anon,authenticated;
create or replace function public.caderno_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from caderno.administrators where user_id=auth.uid());
$$;
revoke all on function public.caderno_is_admin() from public;
grant execute on function public.caderno_is_admin() to anon,authenticated;
-- Username alias for Supabase Auth. Password verification is performed by Auth.
create or replace function public.caderno_login_email(login text) returns text
language sql stable security definer set search_path='' as $$
 select u.email from caderno.administrators a join auth.users u on u.id=a.user_id
 where a.login=lower(trim(login));
$$;
revoke all on function public.caderno_login_email(text) from public;
grant execute on function public.caderno_login_email(text) to anon,authenticated;

create table if not exists caderno.ranking_hidden(name_key text primary key, name text not null, hidden_at timestamptz not null default now());
alter table caderno.ranking_hidden enable row level security;
revoke all on caderno.ranking_hidden from public,anon,authenticated;
do $$begin
 if to_regprocedure('caderno.before_access_api(text,jsonb)') is null then
  alter function public.caderno_api(text,jsonb) set schema caderno;
  alter function caderno.caderno_api(text,jsonb) rename to before_access_api;
 end if;
end;$$;
revoke all on function caderno.before_access_api(text,jsonb) from public,anon,authenticated;
create or replace function public.caderno_api(op text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare admin boolean=public.caderno_is_admin(); person text;
begin
 if op='ranking.hidden.list' then
  return (select coalesce(jsonb_agg(name_key),'[]') from caderno.ranking_hidden);
 end if;
 if not admin then
  if op in ('actions.list','members.list') then null;
  elsif op in ('actions.save','members.save') then
   -- Guest creation only. Even a null/empty supplied ID cannot request an update.
   if payload ? 'id' then raise exception 'Somente o administrador pode editar registros.' using errcode='42501'; end if;
  else raise exception 'Esta operação exige acesso de administrador.' using errcode='42501';
  end if;
 end if;
 if op in ('ranking.hide','ranking.restore') then
  person=trim(payload->>'name');
  if person is null or length(person) not between 1 and 80 then raise exception 'Nome inválido.'; end if;
  if op='ranking.hide' then
   insert into caderno.ranking_hidden(name_key,name) values(caderno.name_key(person),person) on conflict(name_key) do nothing;
  else delete from caderno.ranking_hidden where name_key=caderno.name_key(person); end if;
  return '{"ok":true}';
 end if;
 return caderno.before_access_api(op,payload);
end;$$;
revoke all on function public.caderno_api(text,jsonb) from public;
grant execute on function public.caderno_api(text,jsonb) to anon,authenticated;

do $$begin
 if to_regprocedure('caderno.before_access_visibility(text,jsonb)') is null then
  alter function public.caderno_treasury_visibility(text,jsonb) set schema caderno;
  alter function caderno.caderno_treasury_visibility(text,jsonb) rename to before_access_visibility;
 end if;
end;$$;
revoke all on function caderno.before_access_visibility(text,jsonb) from public,anon,authenticated;
create or replace function public.caderno_treasury_visibility(op text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.caderno_is_admin() then raise exception 'Esta operação exige acesso de administrador.' using errcode='42501';end if;
 return caderno.before_access_visibility(op,payload);
end;$$;
revoke all on function public.caderno_treasury_visibility(text,jsonb) from public;
grant execute on function public.caderno_treasury_visibility(text,jsonb) to anon,authenticated;
drop policy if exists caderno_image_delete on storage.objects;
create policy caderno_image_delete on storage.objects for delete to authenticated
 using(bucket_id='action-prints' and public.caderno_is_admin());
notify pgrst,'reload schema';
commit;
