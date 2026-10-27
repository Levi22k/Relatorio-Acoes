export async function testPrivateAccounts(db,rpc,assert,fs){
 const owner='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',manager='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 const before=await rpc('backup.list');delete before.exportedAt;
 const sql=await fs.readFile(new URL('./supabase/privacidade-logins.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const after=await rpc('backup.list');delete after.exportedAt;assert.deepEqual(after,before);
 const actAs=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)};
 await actAs('','anon');await assert.rejects(rpc('accounts.list'),/administrador/);await assert.rejects(db.query("select public.caderno_login_email('levi')"),/permission denied/);await assert.rejects(rpc('accounts.remove',{login:'gerente',owner:true}),/supremo/);
 await actAs(manager);const list=await rpc('accounts.list');assert.equal(list.find(a=>a.login==='levi').email,null);assert.equal(list.find(a=>a.login==='gerente').email,'guest@example.test');assert.ok(list.every(a=>!a.canManage));
 await assert.rejects(db.query("select public.caderno_login_email('levi')"),/permission denied/);await assert.rejects(db.query("select caderno.before_private_accounts_api('accounts.list','{}')"),/permission denied/);
 for(const op of ['accounts.remove','accounts.restore'])await assert.rejects(rpc(op,{login:'levi',owner:true}),/supremo/);
 await actAs(owner);const all=await rpc('accounts.list');assert.ok(all.every(a=>a.email&&a.canManage));await assert.rejects(rpc('accounts.remove',{login:'levi'}),/Não é possível/);
 await rpc('accounts.remove',{login:'gerente'});await rpc('accounts.remove',{login:'gerente'});
 await actAs(manager);assert.equal((await db.query('select public.caderno_is_admin() ok')).rows[0].ok,false);for(const op of ['accounts.list','backup.list','treasury.save','actions.delete'])await assert.rejects(rpc(op),/administrador/);
 await actAs('','service_role');assert.equal((await db.query("select public.caderno_login_email('gerente') email")).rows[0].email,null);await assert.rejects(db.query('select public.caderno_bind_manager($1,$2,$3)',[manager,'forged',manager]),/não autorizado/);
 await actAs(owner);await rpc('accounts.restore',{login:'gerente'});const restored=await rpc('backup.list');delete restored.exportedAt;assert.deepEqual(restored,before);
 await actAs(manager);assert.equal((await db.query('select public.caderno_is_admin() ok')).rows[0].ok,true);
 await db.exec('reset role');console.log('PASS: owner/self email privacy, public lookup denied, owner-only reversible removal, forged roles denied, owner protected, revoked sessions lose access, business data unchanged.');
}
