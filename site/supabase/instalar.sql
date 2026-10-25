-- Execute uma vez no SQL Editor de um projeto Supabase NOVO.
-- Caderno compartilhado SEM LOGIN: visitantes podem ler e alterar os registros.
-- O histórico de ajustes só pode ser criado pelas operações abaixo.
begin;
create schema if not exists caderno;
revoke all on schema caderno from public, anon, authenticated;
create function caderno.name_key(s text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(lower(regexp_replace(normalize(coalesce(s,''),NFD),'[̀-ͯ]','','g')),'[^[:alnum:]]','','g');
$$;
create table caderno.members(id text primary key, name text not null check(length(name) between 1 and 80), aliases jsonb not null default '[]', created timestamptz not null default now());
create unique index member_name_unique on caderno.members(caderno.name_key(name));
create table caderno.actions(id text primary key,title text not null check(length(title) between 1 and 100), date date not null, category text not null check(category in ('banks','stations','oil','stores','other','burned_city')),result text not null check(result in ('victory','defeat','cancelled')),participants jsonb not null,image_key text not null,created timestamptz not null default now());
create table caderno.payments(id text primary key,name text not null,amount bigint not null check(amount>0),created timestamptz not null default now());
create table caderno.adjustments(id text primary key,name text not null,amount bigint not null check(amount<>0),reason text not null,created timestamptz not null default now());
create table caderno.adjustment_events(id text primary key,"adjustmentId" text not null,name text not null,amount bigint not null,reason text not null,event text not null check(event in ('created','reversed')),created timestamptz not null default now());
create table caderno.payment_ids(id text primary key); -- prevents replay of a reversed payment
alter table caderno.members enable row level security;
alter table caderno.actions enable row level security;
alter table caderno.payments enable row level security;
alter table caderno.adjustments enable row level security;
alter table caderno.adjustment_events enable row level security;
alter table caderno.payment_ids enable row level security;
create function caderno.identity(n text) returns text language plpgsql stable set search_path='' as $$
declare matched text; matches integer;
begin
 select name into matched from caderno.members where caderno.name_key(name)=caderno.name_key(n);
 if found then return matched; end if;
 select min(m.name),count(*) into matched,matches from caderno.members m where exists(select 1 from jsonb_array_elements_text(m.aliases) a where caderno.name_key(a)=caderno.name_key(n));
 return case when matches=1 then matched else trim(n) end;
end;$$;
create function caderno.prize(category text,title text) returns bigint language sql immutable set search_path='' as $$
 select case when category='burned_city' or caderno.name_key(title) like '%cidadequeimada%' then 750000
 when category='banks' then case when lower(title) ~ '\m(armadillo|am)\M' then 1350000 else 1125000 end
 when category='stations' then case when lower(title) ~ '\m(armadillo|am)\M' then 900000 else 750000 end
 when category='oil' then 1350000 when category='stores' then 425000 else null end;
$$;
-- Same stable cent allocation as the interface: 85% divided by normalized name.
create function caderno.balances() returns table(key text,name text,balance bigint) language sql stable set search_path='' as $$
 with participants as (
  select a.id,caderno.identity(p->>'name') name,caderno.name_key(caderno.identity(p->>'name')) key,
   (caderno.prize(a.category,a.title)*85/100) net,
   count(*) over(partition by a.id) n,
   row_number() over(partition by a.id order by caderno.name_key(caderno.identity(p->>'name')) collate "C",ord) rn
  from caderno.actions a cross join lateral jsonb_array_elements(a.participants) with ordinality as items(p,ord)
  where a.result='victory' and caderno.prize(a.category,a.title) is not null
 ), amounts as (
  select key,name,net/n+case when rn<=net%n then 1 else 0 end amount from participants
  union all select caderno.name_key(name),name,0 from caderno.members
  union all select caderno.name_key(caderno.identity(name)),caderno.identity(name),amount from caderno.adjustments
  union all select caderno.name_key(caderno.identity(name)),caderno.identity(name),-amount from caderno.payments
 ) select key,min(name),sum(amount)::bigint from amounts group by key;
$$;
create function caderno.audit_adjustment() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into caderno.adjustment_events(id,"adjustmentId",name,amount,reason,event) values(new.id||':created',new.id,new.name,new.amount,new.reason,'created');return new;
 elsif tg_op='DELETE' then
  insert into caderno.adjustment_events(id,"adjustmentId",name,amount,reason,event) values(old.id||':reversed',old.id,old.name,-old.amount,old.reason,'reversed');return old;
 end if;
 raise exception 'Ajustes não podem ser editados. Desfaça e crie outro.';
end;$$;
create trigger adjustment_audit after insert or update or delete on caderno.adjustments for each row execute function caderno.audit_adjustment();
create function caderno.immutable_history() returns trigger language plpgsql set search_path='' as $$begin raise exception 'O histórico de ajustes é permanente.';end;$$;
create trigger history_immutable before update or delete on caderno.adjustment_events for each row execute function caderno.immutable_history();
create function public.caderno_api(op text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare ident text; person text; amount_value bigint; balance_value bigint; row_data record; item jsonb; clean jsonb='[]'; old_image text; result jsonb; reason_value text;
begin
 -- Serialize mutations so simultaneous payments cannot spend the same balance.
 if op not like '%.list' then perform pg_advisory_xact_lock(73921381); end if;
 if op='members.list' then return (select coalesce(jsonb_agg(to_jsonb(m) order by m.name),'[]') from caderno.members m); end if;
 if op='actions.list' then return (select coalesce(jsonb_agg(to_jsonb(a) order by a.date desc,a.created desc),'[]') from caderno.actions a); end if;
 if op='treasury.list' then return jsonb_build_object(
  'actions',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from caderno.actions a),
  'members',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from caderno.members m),
  'payments',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from caderno.payments p),
  'adjustments',(select coalesce(jsonb_agg(to_jsonb(j)),'[]') from caderno.adjustments j),
  'history',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created desc,e.id desc),'[]') from caderno.adjustment_events e)); end if;
 ident=coalesce(nullif(payload->>'id',''),gen_random_uuid()::text);
 if length(ident) not between 16 and 80 or ident !~ '^[a-zA-Z0-9_-]+$' then raise exception 'Identificador inválido.'; end if;
 if op='members.save' then
  person=trim(regexp_replace(payload->>'name','\s+',' ','g'));
  if person is null or length(person) not between 1 and 80 or caderno.name_key(person)='' then raise exception 'Confira o nome do membro.'; end if;
  if jsonb_typeof(payload->'aliases') is distinct from 'array' or jsonb_array_length(payload->'aliases')>20 then raise exception 'Use até 20 apelidos.'; end if;
  for item in select * from jsonb_array_elements(payload->'aliases') loop
   if jsonb_typeof(item)<>'string' or length(trim(item#>>'{}')) not between 1 and 80 then raise exception 'Apelido inválido.'; end if;
  end loop;
  if payload ? 'id' and not exists(select 1 from caderno.members where id=ident) then raise exception 'Membro não encontrado.'; end if;
  insert into caderno.members(id,name,aliases) values(ident,person,payload->'aliases') on conflict(id) do update set name=excluded.name,aliases=excluded.aliases;
  return jsonb_build_object('id',ident,'name',person,'aliases',payload->'aliases');
 elsif op='members.delete' then delete from caderno.members where id=ident;return '{"ok":true}';
 elsif op='actions.save' then
  if length(trim(payload->>'title')) not between 1 and 100 or payload->>'title' is null then raise exception 'Confira o título.'; end if;
  if jsonb_typeof(payload->'participants') is distinct from 'array' or jsonb_array_length(payload->'participants') not between 1 and 50 then raise exception 'Confira os participantes.'; end if;
  for item in select * from jsonb_array_elements(payload->'participants') loop
   if jsonb_typeof(item->'name') is distinct from 'string' or length(trim(item->>'name')) not between 1 and 80 or coalesce(item->>'kills','') !~ '^\d{1,3}$' then raise exception 'Confira nomes e abates de 0 a 999.'; end if;
   if item ? 'dead' and jsonb_typeof(item->'dead') not in ('null','boolean') then raise exception 'Situação inválida.'; end if;
   clean=clean||jsonb_build_array(jsonb_build_object('name',trim(item->>'name'),'kills',(item->>'kills')::int,'dead',case when payload->>'result'='defeat' then 'true'::jsonb else coalesce(item->'dead','null'::jsonb) end));
  end loop;
  if (select count(distinct lower(trim(p->>'name'))) from jsonb_array_elements(clean) p)<>jsonb_array_length(clean) then raise exception 'Há nomes repetidos na ação.'; end if;
  select image_key into old_image from caderno.actions where id=ident;
  if payload ? 'id' and not found then raise exception 'Ação não encontrada.'; end if;
  person=coalesce(nullif(payload->>'image_key',''),old_image);
  if person is null or person !~ '^[a-f0-9-]+\.(png|jpg|webp)$' then raise exception 'Adicione uma print.'; end if;
  insert into caderno.actions(id,title,date,category,result,participants,image_key) values(ident,trim(payload->>'title'),(payload->>'date')::date,payload->>'category',payload->>'result',clean,person)
   on conflict(id) do update set title=excluded.title,date=excluded.date,category=excluded.category,result=excluded.result,participants=excluded.participants,image_key=excluded.image_key;
  return jsonb_build_object('id',ident,'oldImage',case when person<>old_image then old_image end);
 elsif op='actions.delete' then delete from caderno.actions where id=ident returning image_key into old_image;return jsonb_build_object('ok',true,'oldImage',old_image);
 elsif op='treasury.save' then
  if coalesce(payload->>'amount','') !~ '^-?\d+$' or length(payload->>'amount')>13 then raise exception 'Valor inválido.'; end if;
  amount_value=(payload->>'amount')::bigint;
  if amount_value=0 or abs(amount_value)>100000000000 then raise exception 'Valor fora do limite.'; end if;
  select b.name,b.balance into person,balance_value from caderno.balances() b where b.key=payload->>'key';
  if not found then raise exception 'Membro não encontrado. Atualize a página.'; end if;
  if payload->>'kind'='adjustment' then
   reason_value=trim(payload->>'reason');if reason_value is null or length(reason_value) not between 1 and 200 then raise exception 'Informe o motivo (até 200 caracteres).';end if;
   select * into row_data from caderno.adjustments where id=ident;
   if found then
    if row_data.name=person and row_data.amount=amount_value and row_data.reason=reason_value then return '{"ok":true}';end if;
    raise exception 'Identificador já utilizado.';
   end if;
   if exists(select 1 from caderno.adjustment_events where "adjustmentId"=ident) then raise exception 'Este ajuste já foi desfeito. Crie um novo.';end if;
   insert into caderno.adjustments(id,name,amount,reason) values(ident,person,amount_value,reason_value);
  else
   select * into row_data from caderno.payments where id=ident;
   if found then
    if row_data.name=person and row_data.amount=amount_value then return '{"ok":true}';end if;
    raise exception 'Identificador já utilizado.';
   end if;
   if exists(select 1 from caderno.payment_ids where id=ident) then raise exception 'Pagamento já desfeito. Crie outro.';end if;
   if amount_value<1 or amount_value>balance_value then raise exception 'O pagamento ultrapassa o saldo atual. Atualize a tesouraria.';end if;
   insert into caderno.payments(id,name,amount) values(ident,person,amount_value);
   insert into caderno.payment_ids values(ident);
  end if;return '{"ok":true}';
 elsif op='treasury.delete' then
  if payload->>'kind'='adjustment' then delete from caderno.adjustments where id=ident;else delete from caderno.payments where id=ident;end if;
  return '{"ok":true}';
 end if;
 raise exception 'Operação inválida.';
end;$$;
revoke all on all functions in schema caderno from public,anon,authenticated;
revoke all on function public.caderno_api(text,jsonb) from public;
grant execute on function public.caderno_api(text,jsonb) to anon,authenticated;
-- Images are intentionally shared; no login is required in this application.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('action-prints','action-prints',true,10485760,array['image/png','image/jpeg','image/webp']);
create policy caderno_upload on storage.objects for insert to anon,authenticated with check(bucket_id='action-prints' and name ~ '^[a-f0-9-]+\.(png|jpg|webp)$');
create policy caderno_image_select on storage.objects for select to anon,authenticated using(bucket_id='action-prints');
create policy caderno_image_delete on storage.objects for delete to anon,authenticated using(bucket_id='action-prints');
commit;
