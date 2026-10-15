-- Atualização incremental: execute no SQL Editor do mesmo projeto do caderno.
-- Não execute instalar.sql novamente. Nenhum registro financeiro é alterado.
begin;
create table if not exists caderno.treasury_hidden (
 name_key text primary key,
 name text not null,
 hidden_at timestamptz not null default now()
);
alter table caderno.treasury_hidden enable row level security;
revoke all on caderno.treasury_hidden from public, anon, authenticated;

create or replace function public.caderno_treasury_visibility(op text,payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare person text; selected_key text;
begin
 if op='list' then
  return (select coalesce(jsonb_agg(distinct caderno.name_key(caderno.identity(h.name))),'[]') from caderno.treasury_hidden h);
 end if;
 if op not in ('hide','restore') then raise exception 'Operação inválida.'; end if;
 selected_key=payload->>'key';
 if selected_key is null or length(selected_key) not between 1 and 160 then raise exception 'Selecione um membro.'; end if;
 perform pg_advisory_xact_lock(73921381);
 if op='hide' then
  select b.name into person from caderno.balances() b where b.key=selected_key;
  if not found then raise exception 'Membro não encontrado. Atualize a tesouraria.'; end if;
  insert into caderno.treasury_hidden(name_key,name) values(selected_key,person)
   on conflict(name_key) do update set name=excluded.name;
 else
  delete from caderno.treasury_hidden h
   where caderno.name_key(caderno.identity(h.name))=selected_key;
 end if;
 return '{"ok":true}';
end;$$;
revoke all on function public.caderno_treasury_visibility(text,jsonb) from public;
grant execute on function public.caderno_treasury_visibility(text,jsonb) to anon, authenticated;
notify pgrst,'reload schema';
commit;
