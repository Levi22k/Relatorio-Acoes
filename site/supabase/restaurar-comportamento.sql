-- Restore member deletion to the original behavior without changing stored data.
-- Backup, recovery snapshots, audit records and grants remain intact.
begin;
do $migration$
declare definition text; before_state jsonb; after_state jsonb;
begin
 perform pg_advisory_xact_lock(73921381);
 before_state := public.caderno_api('backup.list','{}'::jsonb) - 'exportedAt';
 select pg_get_functiondef('public.caderno_api(text,jsonb)'::regprocedure) into definition;
 if position('elsif op=''members.archive'' or op=''members.delete'' then' in definition)>0 then
  execute replace(definition,'elsif op=''members.archive'' or op=''members.delete'' then','elsif op=''members.archive'' then');
 elsif position('elsif op=''members.archive'' then' in definition)=0 then
  raise exception 'Versão da função inesperada; nenhuma alteração aplicada.';
 end if;
 after_state := public.caderno_api('backup.list','{}'::jsonb) - 'exportedAt';
 if before_state is distinct from after_state then
  raise exception 'Os registros diferem; atualização cancelada.';
 end if;
end $migration$;
commit;
select 'Comportamento restaurado. Todos os registros preservados.' as resultado;
