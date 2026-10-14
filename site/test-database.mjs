import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text);`);
await db.exec(await fs.readFile(new URL('./supabase/instalar.sql',import.meta.url),'utf8'));
async function rpc(op,payload={}){return (await db.query('select public.caderno_api($1,$2::jsonb) result',[op,JSON.stringify(payload)])).rows[0].result;}
const a=await rpc('members.save',{name:'Levi Modric',aliases:['Levi']});
const b=await rpc('members.save',{name:'Rafis Lazúli',aliases:[]});
const win=await rpc('actions.save',{title:'Banco de Rhodes',date:'2026-10-14',category:'banks',result:'victory',participants:[{name:'Levi',kills:0,dead:false},{name:b.name,kills:3,dead:true}],image_key:'11111111-1111-1111-1111-111111111111.png'});
async function balance(key){return Number((await db.query('select balance from caderno.balances() where key=$1',[key])).rows[0].balance);}
assert.equal(await balance('levimodric'),478125);
assert.equal(await balance('rafislazuli'),478125);
const adjustment={id:crypto.randomUUID(),kind:'adjustment',key:'levimodric',amount:500000,reason:'Serviço por fora'};
await rpc('treasury.save',adjustment);await rpc('treasury.save',adjustment);
assert.equal(await balance('levimodric'),978125);assert.equal((await rpc('treasury.list')).history.length,1);
await rpc('treasury.delete',{id:adjustment.id,kind:'adjustment'});
assert.equal(await balance('levimodric'),478125);assert.equal((await rpc('treasury.list')).history.length,2);
await assert.rejects(rpc('treasury.save',adjustment));
await assert.rejects(db.exec('delete from caderno.adjustment_events'));
const payment={id:crypto.randomUUID(),key:'levimodric',amount:478125};
await rpc('treasury.save',payment);await rpc('treasury.save',payment);
assert.equal(await balance('levimodric'),0);
await assert.rejects(rpc('treasury.save',{...payment,id:crypto.randomUUID(),amount:1}));
await rpc('treasury.delete',{id:payment.id});await assert.rejects(rpc('treasury.save',payment));
const defeat=await rpc('actions.save',{title:'Lojinha',date:'2026-10-14',category:'stores',result:'defeat',participants:[{name:a.name,kills:0,dead:false}],image_key:'22222222-2222-2222-2222-222222222222.png'});
assert.equal((await rpc('actions.list')).find(x=>x.id===defeat.id).participants[0].dead,true);
assert.equal(await balance('levimodric'),478125);
await rpc('actions.delete',{id:win.id});assert.equal(await balance('levimodric'),0);
const third=await rpc('members.save',{name:'Bandana',aliases:[]});
const city=await rpc('actions.save',{title:'Cidade Queimada',date:'2026-10-14',category:'other',result:'victory',participants:[{name:a.name,kills:0},{name:b.name,kills:0},{name:third.name,kills:0}],image_key:'33333333-3333-3333-3333-333333333333.png'});
assert.equal(await balance('bandana'),120417);assert.equal(await balance('levimodric'),120417);assert.equal(await balance('rafislazuli'),120416);
const negative={id:crypto.randomUUID(),kind:'adjustment',key:'bandana',amount:-500000,reason:'Desconto individual'};
await rpc('treasury.save',negative);assert.equal(await balance('bandana'),-379583);
assert.equal(await balance('levimodric'),120417);
await rpc('members.delete',{id:third.id});assert.equal((await rpc('treasury.list')).history.length,3);
for(const [category,title,expected] of [['banks','Banco de Armadillo',1350000],['stations','Estação de Armadillo',900000],['stations','Estação de Rhodes',750000],['oil','Petrolífera',1350000],['stores','Lojinha',425000]]){
 assert.equal(Number((await db.query('select caderno.prize($1,$2) p',[category,title])).rows[0].p),expected);
}
// Anonymous visitors can use the application but cannot alter the audit directly.
await db.exec('set role anon');await rpc('members.list');
await assert.rejects(db.exec('delete from caderno.adjustment_events'));
await db.exec('reset role');
console.log('PASS: SQL, aliases, 15%, ajustes integrais, idempotência, estorno preservado, limite de pagamento, derrotas e permissões.');
await db.close();
