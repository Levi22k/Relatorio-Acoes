begin;
alter table caderno.administrators add column if not exists active boolean not null default true;
alter table caderno.administrators add column if not exists owner boolean not null default false;
update caderno.administrators set owner=true where login='levi';
create unique index if not exists administrators_single_owner on caderno.administrators(owner) where owner;
create or replace function public.caderno_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from caderno.administrators where user_id=auth.uid() and active);
$$;
create or replace function public.caderno_is_owner() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from caderno.administrators where user_id=auth.uid() and owner and active);
$$;
revoke all on function public.caderno_is_owner() from public;
grant execute on function public.caderno_is_owner() to authenticated;
-- Email resolution is server-only, including before password verification.
create or replace function public.caderno_login_email(login text) returns text
language sql stable security definer set search_path='' as $$
 select u.email from caderno.administrators a join auth.users u on u.id=a.user_id
 where a.login=lower(trim($1)) and a.active;
$$;
revoke all on function public.caderno_login_email(text) from public,anon,authenticated;
grant execute on function public.caderno_login_email(text) to service_role;
create or replace function public.caderno_login_exists(login text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.caderno_is_admin() then raise exception 'Esta operação exige acesso de administrador.' using errcode='42501';end if;
 return exists(select 1 from caderno.administrators where administrators.login=lower(trim($1)));
end;$$;
revoke all on function public.caderno_login_exists(text) from public,anon;
grant execute on function public.caderno_login_exists(text) to authenticated;
do $$begin
 if to_regprocedure('caderno.before_private_accounts_api(text,jsonb)') is null then
  alter function public.caderno_api(text,jsonb) set schema caderno;
  alter function caderno.caderno_api(text,jsonb) rename to before_private_accounts_api;
 end if;
end;$$;
revoke all on function caderno.before_private_accounts_api(text,jsonb) from public,anon,authenticated;
create or replace function public.caderno_api(op text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare target text=lower(trim(payload->>'login')); supreme boolean=public.caderno_is_owner();
begin
 if op='accounts.list' then
  if not public.caderno_is_admin() then raise exception 'Esta operação exige acesso de administrador.' using errcode='42501';end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('login',a.login,'email',case when supreme or a.user_id=auth.uid() then u.email else null end,'owner',a.owner,'self',a.user_id=auth.uid(),'active',a.active,'canManage',supreme) order by a.owner desc,a.login),'[]') from caderno.administrators a join auth.users u on u.id=a.user_id where a.active or supreme);
 end if;
 if op in ('accounts.remove','accounts.restore') then
  if not supreme then raise exception 'Somente o administrador supremo pode gerenciar acessos.' using errcode='42501';end if;
  if not exists(select 1 from caderno.administrators where login=target and not owner and user_id<>auth.uid()) then raise exception 'Não é possível alterar este acesso.';end if;
  update caderno.administrators set active=(op='accounts.restore') where login=target and not owner;
  return '{"ok":true}';
 end if;
 return caderno.before_private_accounts_api(op,payload);
end;$$;
revoke all on function public.caderno_api(text,jsonb) from public;
grant execute on function public.caderno_api(text,jsonb) to anon,authenticated;
create or replace function public.caderno_bind_manager(actor uuid,username text,new_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from caderno.administrators where user_id=actor and active) then raise exception 'Administrador não autorizado.' using errcode='42501';end if;
 insert into caderno.administrators(login,user_id) values(lower(trim(username)),new_user);
end;$$;
notify pgrst,'reload schema';
commit;
