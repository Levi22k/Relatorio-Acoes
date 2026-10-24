-- Atualização incremental, repetível. Não apaga nem recalcula registros existentes.
begin;
create table if not exists caderno.recovery_snapshots(name text primary key,data jsonb not null,created timestamptz not null default now());
alter table caderno.recovery_snapshots enable row level security;
revoke all on caderno.recovery_snapshots from public,anon,authenticated;
insert into caderno.recovery_snapshots(name,data) values('antes-otimizacoes-v1',jsonb_build_object('actions',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from caderno.actions a),'members',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from caderno.members m),'payments',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from caderno.payments p),'adjustments',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from caderno.adjustments a),'history',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from caderno.adjustment_events e),'payment_ids',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from caderno.payment_ids p),'hidden',(select coalesce(jsonb_agg(to_jsonb(h)),'[]') from caderno.treasury_hidden h))) on conflict(name) do nothing;
alter table caderno.members add column if not exists archived boolean not null default false;
alter table caderno.actions add column if not exists image_hash text;
alter table caderno.actions add column if not exists thumbnail_key text;
create unique index if not exists action_image_hash_unique on caderno.actions(image_hash) where image_hash is not null;
create table if not exists caderno.events(id text primary key default gen_random_uuid()::text, entity text not null, operation text not null, record_id text not null, before_data jsonb, after_data jsonb, created timestamptz not null default now());
alter table caderno.events enable row level security;
revoke all on caderno.events from public,anon,authenticated;
create or replace function caderno.audit_record() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and to_jsonb(old)=to_jsonb(new) then return new; end if;
 insert into caderno.events(entity,operation,record_id,before_data,after_data) values(tg_table_name,tg_op,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'name_key',to_jsonb(old)->>'name_key'),case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end;$$;
do $$declare t text;begin
 foreach t in array array['members','actions','payments','adjustments','treasury_hidden'] loop
 execute format('drop trigger if exists record_audit on caderno.%I',t);
 execute format('create trigger record_audit after insert or update or delete on caderno.%I for each row execute function caderno.audit_record()',t);
 end loop;
end;$$;
drop trigger if exists events_immutable on caderno.events;
create trigger events_immutable before update or delete on caderno.events for each row execute function caderno.immutable_history();
-- Preserve the original validation and payment locking in a private function.
do $$begin
 if to_regprocedure('caderno.base_api(text,jsonb)') is null then
 alter function public.caderno_api(text,jsonb) set schema caderno;
 alter function caderno.caderno_api(text,jsonb) rename to base_api;
 end if;
end;$$;
revoke all on function caderno.base_api(text,jsonb) from public,anon,authenticated;
create or replace function public.caderno_api(op text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare answer jsonb; ident text; hash text; item jsonb; source jsonb; inserted int=0; skipped int=0; table_name text;
begin
 if op not like '%.list' then perform pg_advisory_xact_lock(73921381); end if;
 if op='events.list' then
 return (select coalesce(jsonb_agg(to_jsonb(e) order by e.created desc,e.id desc),'[]') from (select * from caderno.events order by created desc,id desc limit 100 offset greatest(0,least(coalesce((payload->>'offset')::int,0),1000000))) e);
 elsif op='members.archive' or op='members.delete' then
 update caderno.members set archived=case when op='members.delete' then true else coalesce((payload->>'archived')::boolean,true) end where id=payload->>'id';
 if not found then raise exception 'Membro não encontrado.'; end if;
 return '{"ok":true}';
 elsif op='backup.list' then
 return jsonb_build_object('version',1,'exportedAt',now(),'actions',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from caderno.actions a),'members',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from caderno.members m),'payments',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from caderno.payments p),'adjustments',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from caderno.adjustments a),'history',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from caderno.adjustment_events e),'payment_ids',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from caderno.payment_ids p),'hidden',(select coalesce(jsonb_agg(to_jsonb(h)),'[]') from caderno.treasury_hidden h),'events',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from caderno.events e));
 elsif op='backup.restore' then
 -- Merge only absent records. Existing records, reversals and audit history always win.
 source=payload->'backup';
 if source->>'version' is distinct from '1' then raise exception 'Formato de backup inválido.'; end if;
 foreach table_name in array array['members','actions','payments','adjustments','history','payment_ids','hidden','events'] loop
 if jsonb_typeof(source->table_name) is distinct from 'array' or jsonb_array_length(source->table_name)>100000 then raise exception 'Backup incompleto ou muito grande.';end if;
 end loop;
 foreach table_name in array array['members','actions','payments','adjustments','payment_ids'] loop
 for item in select * from jsonb_array_elements(source->table_name) loop
 if coalesce(item->>'id','') !~ '^[a-zA-Z0-9_-]{16,80}$' then raise exception 'Identificador inválido no backup.';end if;
 end loop;
 end loop;
 for item in select * from jsonb_array_elements(source->'members') loop
 if exists(select 1 from caderno.members where id=item->>'id' or caderno.name_key(name)=caderno.name_key(item->>'name')) then skipped=skipped+1;continue;end if;
 answer=caderno.base_api('members.save',item-'id');
 update caderno.members set id=item->>'id',archived=coalesce((item->>'archived')::boolean,false),created=(item->>'created')::timestamptz where id=answer->>'id';inserted=inserted+1;
 end loop;
 for item in select * from jsonb_array_elements(source->'actions') loop
 if nullif(item->>'image_hash','') is not null and item->>'image_hash' !~ '^[a-f0-9]{64}$' then raise exception 'Identificação da imagem inválida no backup.';end if;
 if nullif(item->>'thumbnail_key','') is not null and item->>'thumbnail_key' !~ '^[a-f0-9-]+\.webp$' then raise exception 'Miniatura inválida no backup.';end if;
 if exists(select 1 from caderno.actions where id=item->>'id' or (image_hash is not null and image_hash=item->>'image_hash')) then skipped=skipped+1;continue;end if;
 answer=caderno.base_api('actions.save',item-'id');
 update caderno.actions set id=item->>'id',created=(item->>'created')::timestamptz,image_hash=item->>'image_hash',thumbnail_key=item->>'thumbnail_key' where id=answer->>'id';inserted=inserted+1;
 end loop;
 for item in select * from jsonb_array_elements(source->'payments') loop
 if exists(select 1 from caderno.payment_ids where id=item->>'id') or exists(select 1 from caderno.payments where id=item->>'id') then skipped=skipped+1;continue;end if;
 if length(coalesce(item->>'name','')) not between 1 and 80 or coalesce((item->>'amount')::bigint,0) not between 1 and 100000000000 then raise exception 'Pagamento inválido no backup.';end if;
 insert into caderno.payments select * from jsonb_populate_record(null::caderno.payments,item);
 insert into caderno.payment_ids values(item->>'id') on conflict do nothing;inserted=inserted+1;
 end loop;
 for item in select * from jsonb_array_elements(source->'adjustments') loop
 if exists(select 1 from caderno.adjustments where id=item->>'id') or exists(select 1 from caderno.adjustment_events where "adjustmentId"=item->>'id') then skipped=skipped+1;continue;end if;
 if length(coalesce(item->>'name','')) not between 1 and 80 or length(coalesce(item->>'reason','')) not between 1 and 200 or abs(coalesce((item->>'amount')::bigint,0)) not between 1 and 100000000000 then raise exception 'Ajuste inválido no backup.';end if;
 insert into caderno.adjustments select * from jsonb_populate_record(null::caderno.adjustments,item);inserted=inserted+1;
 end loop;
 insert into caderno.payment_ids select * from jsonb_populate_recordset(null::caderno.payment_ids,source->'payment_ids') on conflict do nothing;
 insert into caderno.adjustment_events select * from jsonb_populate_recordset(null::caderno.adjustment_events,source->'history') on conflict do nothing;
 insert into caderno.treasury_hidden select * from jsonb_populate_recordset(null::caderno.treasury_hidden,source->'hidden') on conflict do nothing;
 -- Imported audit records are explicitly labelled rather than impersonating live events.
 insert into caderno.events(id,entity,operation,record_id,before_data,after_data,created)
 select 'backup:'||e.id,e.entity,'IMPORTED',e.record_id,e.before_data,e.after_data,e.created from jsonb_populate_recordset(null::caderno.events,source->'events') e where e.operation<>'IMPORTED' and not exists(select 1 from caderno.events live where live.id=e.id) on conflict do nothing;
 insert into caderno.events(entity,operation,record_id,after_data) values('backup','RESTORE',gen_random_uuid()::text,jsonb_build_object('inserted',inserted,'skipped',skipped));
 return jsonb_build_object('inserted',inserted,'skipped',skipped);
 elsif op='actions.save' then
 hash=nullif(payload->>'image_hash','');
 if hash is not null and hash !~ '^[a-f0-9]{64}$' then raise exception 'Identificação da print inválida.';end if;
 if hash is not null and exists(select 1 from caderno.actions where image_hash=hash and id<>coalesce(payload->>'id','')) then raise exception 'Esta print já foi registrada. Abra a ação existente para editar.';end if;
 if nullif(payload->>'thumbnail_key','') is not null and payload->>'thumbnail_key' !~ '^[a-f0-9-]+\.webp$' then raise exception 'Miniatura inválida.';end if;
 answer=caderno.base_api(op,payload);
 update caderno.actions set image_hash=coalesce(hash,image_hash),thumbnail_key=case when payload ? 'thumbnail_key' then payload->>'thumbnail_key' else thumbnail_key end where id=answer->>'id';
 return answer;
 end if;
 return caderno.base_api(op,payload);
end;$$;
revoke all on all functions in schema caderno from public,anon,authenticated;
revoke all on function public.caderno_api(text,jsonb) from public;
grant execute on function public.caderno_api(text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
commit;
