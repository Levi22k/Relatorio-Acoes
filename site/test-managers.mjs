export async function testManagers(db,rpc,assert,fs){
 const admin='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',manager='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
 await db.exec('create role service_role');
 const before=await rpc('backup.list');delete before.exportedAt;
 const sql=await fs.readFile(new URL('./supabase/gerentes-tesouraria.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const after=await rpc('backup.list');delete after.exportedAt;assert.deepEqual(after,before);
 await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');
 await rpc('treasury.list');await db.query("select public.caderno_treasury_visibility('list')");
 for(const op of ['treasury.save','treasury.delete','accounts.list','members.delete','actions.delete','backup.restore'])await assert.rejects(rpc(op,{}),/administrador/);
 for(const op of ['hide','restore'])await assert.rejects(db.query('select public.caderno_treasury_visibility($1)',[op]),/administrador/);
 await assert.rejects(db.query('select public.caderno_bind_manager($1,$2,$3)',[admin,'gerente',manager]),/permission denied/);
 await assert.rejects(db.query("select caderno.before_managers_api('accounts.list','{}')"));
 await db.exec('reset role');await db.exec('set role service_role');
 await assert.rejects(db.query('select public.caderno_bind_manager($1,$2,$3)',[manager,'gerente',manager]),/não autorizado/);
 await db.query('select public.caderno_bind_manager($1,$2,$3)',[admin,'gerente',manager]);
 await assert.rejects(db.query('select public.caderno_bind_manager($1,$2,$3)',[admin,'levi',manager]));
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[manager]);await db.exec('set role authenticated');
 assert.equal((await db.query('select public.caderno_is_admin() ok')).rows[0].ok,true);
 assert.equal((await db.query("select public.caderno_login_email('Gerente') email")).rows[0].email,'guest@example.test');
 assert.equal((await rpc('accounts.list')).length,2);await rpc('backup.list');await rpc('treasury.list');
 await rpc('ranking.hide',{name:'Test manager'});await rpc('ranking.restore',{name:'Test manager'});
 await assert.rejects(db.query('select public.caderno_bind_manager($1,$2,$3)',[admin,'outro',manager]),/permission denied/);
 await db.exec('reset role');console.log('PASS: guest treasury read only, private bindings protected, manager login and equal administrative rights, repeatable migration with records preserved.');
}
