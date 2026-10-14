import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {calculateTreasury,treasuryIdentity} from '../../treasury-calculation';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
// One snapshot is also the optimistic guard for a payment. Any concurrent edit
// or payment forces a refresh instead of paying a stale balance twice.
const snapshotSQL=`SELECT json_object(
 'actions',json((SELECT json_group_array(json_object('id',id,'title',title,'category',category,'date',date,'result',result,'participants',json(participants))) FROM (SELECT * FROM actions WHERE owner=? ORDER BY id))),
 'members',json((SELECT json_group_array(json_object('id',id,'name',name,'aliases',json(aliases))) FROM (SELECT * FROM members WHERE owner=? ORDER BY id))),
 'payments',json((SELECT json_group_array(json_object('id',id,'name',name,'amount',amount,'created',created)) FROM (SELECT * FROM treasury_payments WHERE owner=? ORDER BY id))),
 'adjustments',json((SELECT json_group_array(json_object('id',id,'name',name,'amount',amount,'reason',reason,'created',created)) FROM (SELECT * FROM treasury_adjustments WHERE owner=? ORDER BY id)))
) AS snapshot`;
async function read(owner:string){const row=await env.DB!.prepare(snapshotSQL).bind(owner,owner,owner,owner).first<{snapshot:string}>();const raw=row!.snapshot;const data=JSON.parse(raw);return {raw,data,totals:calculateTreasury(data.actions,data.payments,data.members,data.adjustments)}}
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta.'},401);
 const state=await read(user.userId);
 const history=await env.DB!.prepare(`SELECT id,adjustment_id AS adjustmentId,name,amount,reason,event,created FROM treasury_adjustment_events WHERE owner=?
 UNION ALL SELECT id||':created',id,name,amount,reason,'created',created FROM treasury_adjustments a WHERE owner=? AND NOT EXISTS (SELECT 1 FROM treasury_adjustment_events e WHERE e.adjustment_id=a.id AND e.owner=a.owner AND e.event='created')
 ORDER BY created DESC,id DESC`).bind(user.userId,user.userId).all();
 return json({...state.totals,history:history.results});
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta.'},401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 let input:any;try{input=await request.json()}catch{return json({error:'Pagamento inválido.'},400)}
 const adjustment=input?.kind==='adjustment';
 if(!input||typeof input.id!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(input.id)||typeof input.key!=='string'||!Number.isSafeInteger(input.amount)||Math.abs(input.amount)>100000000000||input.amount===0||(!adjustment&&input.amount<0)||(input.kind!==undefined&&!['payment','adjustment'].includes(input.kind)))return json({error:'Informe um valor válido e diferente de zero.'},400);
 if(adjustment&&(typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>200))return json({error:'Informe um motivo de até 200 caracteres.'},400);
 const state=await read(user.userId),account=state.totals.accounts.find(a=>a.key===input.key);
 if(adjustment){
  const reason=input.reason.trim();
  const previous=await env.DB!.prepare('SELECT owner,name,amount,reason FROM treasury_adjustments WHERE id=?').bind(input.id).first<any>();
  if(previous)return previous.owner===user.userId&&previous.amount===input.amount&&previous.reason===reason&&treasuryIdentity(previous.name,state.data.members).key===input.key?json({ok:true}):json({error:'Identificador já utilizado. Atualize a página.'},409);
  const reversed=await env.DB!.prepare("SELECT id FROM treasury_adjustment_events WHERE adjustment_id=? AND event='reversed'").bind(input.id).first();
  if(reversed)return json({error:'Este ajuste já foi desfeito. Abra um novo ajuste.'},409);
  if(!account)return json({error:'Membro não encontrado. Cadastre-o em Membros ou atualize a página.'},404);
  const result=await env.DB!.batch([
   env.DB!.prepare(`INSERT OR IGNORE INTO treasury_adjustments (id,owner,name,amount,reason,created) SELECT ?,?,?,?,?,? WHERE (${snapshotSQL})=? AND NOT EXISTS (SELECT 1 FROM treasury_adjustment_events WHERE adjustment_id=? AND event='reversed')`).bind(input.id,user.userId,account.name,input.amount,reason,new Date().toISOString(),user.userId,user.userId,user.userId,user.userId,state.raw,input.id),
   env.DB!.prepare("INSERT OR IGNORE INTO treasury_adjustment_events (id,owner,adjustment_id,name,amount,reason,event,created) SELECT id||':created',owner,id,name,amount,reason,'created',created FROM treasury_adjustments WHERE id=? AND owner=?").bind(input.id,user.userId)
  ]);
  return result[0].meta.changes?json({ok:true}):json({error:'Os registros mudaram. Atualize e tente novamente.'},409);
 }
 const previous=await env.DB!.prepare('SELECT id,owner,name,amount FROM treasury_payments WHERE id=?').bind(input.id).first<any>();
 if(previous)return previous.owner===user.userId&&previous.amount===input.amount&&treasuryIdentity(previous.name,state.data.members).key===input.key?json({ok:true}):json({error:'Identificador já utilizado. Atualize a página.'},409);
 if(!account||input.amount>account.balance)return json({error:'O valor ultrapassa o saldo disponível. Atualize a tesouraria.'},409);
 const result=await env.DB!.prepare(`INSERT OR IGNORE INTO treasury_payments (id,owner,name,amount,created) SELECT ?,?,?,?,? WHERE (${snapshotSQL})=?`).bind(input.id,user.userId,account.name,input.amount,new Date().toISOString(),user.userId,user.userId,user.userId,user.userId,state.raw).run();
 if(!result.meta.changes)return json({error:'Os registros mudaram durante o pagamento. Atualize e tente novamente.'},409);
 return json({ok:true});
}
export async function DELETE(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta.'},401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 const id=new URL(request.url).searchParams.get('id');if(!id)return json({error:'Pagamento inválido.'},400);
 if(new URL(request.url).searchParams.get('kind')==='adjustment'){
  const result=await env.DB!.batch([
   env.DB!.prepare("INSERT OR IGNORE INTO treasury_adjustment_events (id,owner,adjustment_id,name,amount,reason,event,created) SELECT id||':created',owner,id,name,amount,reason,'created',created FROM treasury_adjustments WHERE id=? AND owner=?").bind(id,user.userId),
   env.DB!.prepare("INSERT OR IGNORE INTO treasury_adjustment_events (id,owner,adjustment_id,name,amount,reason,event,created) SELECT id||':reversed',owner,id,name,-amount,reason,'reversed',? FROM treasury_adjustments WHERE id=? AND owner=?").bind(new Date().toISOString(),id,user.userId),
   env.DB!.prepare('DELETE FROM treasury_adjustments WHERE id=? AND owner=?').bind(id,user.userId)
  ]);
  return result[2].meta.changes?json({ok:true}):json({error:'Ajuste não encontrado.'},404);
 }
 const result=await env.DB!.prepare('DELETE FROM treasury_payments WHERE id=? AND owner=?').bind(id,user.userId).run();
 return result.meta.changes?json({ok:true}):json({error:'Pagamento não encontrado.'},404);
}
