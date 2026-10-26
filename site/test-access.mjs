// Invoked by test-database.mjs after baseline migrations and regression tests.
export async function testAccess(db,rpc,assert,fs){
 await db.exec(`create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 const before=await rpc('backup.list');delete before.exportedAt;
 const sql=await fs.readFile(new URL('./supabase/acesso-administrador.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql);
 const adminId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',otherId='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[adminId,'admin@example.test',otherId,'guest@example.test']);
 await db.query("insert into caderno.administrators(login,user_id) values('levi',$1)",[adminId]);
 await db.exec('set role anon');
 assert.equal((await db.query('select public.caderno_is_admin() ok')).rows[0].ok,false);
 assert.equal((await db.query("select public.caderno_login_email('Levi') email")).rows[0].email,'admin@example.test');
 await rpc('actions.list');await rpc('members.list');await rpc('ranking.hidden.list');
 const member=await rpc('members.save',{name:'Guest Addition',aliases:[]});
 const action=await rpc('actions.save',{title:'Banco',category:'banks',date:'2026-10-25',result:'victory',participants:[{name:'Guest Addition',kills:1}],image_key:'88888888-8888-4888-8888-888888888888.png'});
 for(const id of [member.id,null,''])await assert.rejects(rpc('members.save',{id,name:'Hijack',aliases:[]}),/administrador/);
 await assert.rejects(rpc('actions.save',{id:action.id,title:'Hijack'}),/administrador/);
 for(const op of ['members.delete','members.archive','actions.delete','treasury.list','treasury.save','treasury.delete','backup.list','backup.restore','events.list','ranking.hide','ranking.restore'])await assert.rejects(rpc(op,{id:action.id,name:'Guest Addition',admin:true,role:'admin'}),/administrador/);
 await assert.rejects(db.query("select public.caderno_treasury_visibility('hide','{}')"),/administrador/);
 for(const fn of ['base_api','before_access_api','before_access_visibility'])await assert.rejects(db.query(`select caderno.${fn}('members.delete','{}')`));
 await assert.rejects(db.query('select * from caderno.administrators'));
 await assert.rejects(db.query('insert into caderno.ranking_hidden(name_key,name) values($1,$2)',['x','x']));
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[otherId]);await db.exec('set role authenticated');
 assert.equal((await db.query('select public.caderno_is_admin() ok')).rows[0].ok,false);
 await assert.rejects(rpc('treasury.save',{}),/administrador/);
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[adminId]);await db.exec('set role authenticated');
 assert.equal((await db.query('select public.caderno_is_admin() ok')).rows[0].ok,true);
 await rpc('treasury.list');await rpc('backup.list');await rpc('events.list');
 await rpc('ranking.hide',{name:'Guest Addition'});assert.deepEqual(await rpc('ranking.hidden.list'),['guestaddition']);
 await rpc('ranking.restore',{name:'Guest Addition'});assert.deepEqual(await rpc('ranking.hidden.list'),[]);
 await rpc('members.save',{id:member.id,name:'Admin Edited',aliases:[]});await rpc('actions.delete',{id:action.id});await rpc('members.delete',{id:member.id});
 // All original business records survive deployment and ranking operations.
 const after=await rpc('backup.list');for(const key of ['actions','payments','adjustments','history','payment_ids','hidden'])assert.deepEqual(after[key],before[key]);
 const policies=await db.query("select roles,qual from pg_policies where policyname='caderno_image_delete'");assert.ok(policies.rows[0].qual.includes('caderno_is_admin'));assert.ok(String(policies.rows[0].roles).includes('authenticated'));
 await db.exec('reset role');
 console.log('PASS: guest creation only; forged roles, update/delete, finance, backups and private RPC bypasses blocked; authorized admin, reversible ranking and records preserved.');
}
