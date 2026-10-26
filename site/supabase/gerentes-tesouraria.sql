begin;
alter table caderno.administrators drop constraint if exists administrators_login_check;
alter table caderno.administrators add constraint administrators_login_check check(login=lower(login) and login ~ '^[a-z0-9_.-]{3,32}$');
create or replace function public.caderno_login_email(login text) returns text
language sql stable security definer set search_path='' as $$
 select u.email from caderno.administrators a join auth.users u on u.id=a.user_id
 where a.login=lower(trim($1));
$$;
do $$begin
 if to_regprocedure('caderno.before_managers_api(text,jsonb)') is null then
  alter function public.caderno_api(text,jsonb) set schema caderno;
  alter function caderno.caderno_api(text,jsonb) rename to before_managers_api;
 end if;
end;$$;
revoke all on function caderno.before_managers_api(text,jsonb) from public,anon,authenticated;
create or replace function public.caderno_api(op text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if op='treasury.list' then return caderno.before_access_api(op,payload);end if;
 if op='accounts.list' then
  if not public.caderno_is_admin() then raise exception 'Esta operação exige acesso de administrador.' using errcode='42501';end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('login',a.login,'email',u.email,'owner',a.login='levi') order by a.login),'[]') from caderno.administrators a join auth.users u on u.id=a.user_id);
 end if;
 return caderno.before_managers_api(op,payload);
end;$$;
revoke all on function public.caderno_api(text,jsonb) from public;
grant execute on function public.caderno_api(text,jsonb) to anon,authenticated;
create or replace function public.caderno_treasury_visibility(op text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if op<>'list' and not public.caderno_is_admin() then raise exception 'Esta operação exige acesso de administrador.' using errcode='42501';end if;
 return caderno.before_access_visibility(op,payload);
end;$$;
-- Only the server may bind a newly created Auth user; recheck its requesting admin.
create or replace function public.caderno_bind_manager(actor uuid,username text,new_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from caderno.administrators where user_id=actor) then raise exception 'Administrador não autorizado.' using errcode='42501';end if;
 insert into caderno.administrators(login,user_id) values(lower(trim(username)),new_user);
end;$$;
revoke all on function public.caderno_bind_manager(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.caderno_bind_manager(uuid,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
