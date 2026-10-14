import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {nameKey} from '../../member-match';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta.'},401);
 const rows=await env.DB!.prepare('SELECT id,name,aliases FROM members WHERE owner=? ORDER BY name COLLATE NOCASE').bind(user.userId).all();
 return json(rows.results.map((r:any)=>({...r,aliases:JSON.parse(r.aliases)})));
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta.'},401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 let data:any;try{data=await request.json()}catch{return json({error:'Cadastro inválido.'},400)}
 if(!data||typeof data.name!=='string'||!nameKey(data.name)||data.name.trim().length>80||!Array.isArray(data.aliases)||data.aliases.length>20||data.aliases.some((a:any)=>typeof a!=='string'||!nameKey(a)||a.trim().length>80)||(data.id!==undefined&&typeof data.id!=='string'))return json({error:'Informe um nome de até 80 caracteres e até 20 apelidos válidos.'},400);
 const name=data.name.trim().replace(/\s+/g,' '),key=nameKey(name);
 const aliases=[...new Map(data.aliases.map((a:string)=>[nameKey(a),a.trim().replace(/\s+/g,' ')])).entries()].filter(([k])=>k!==key).map(([,v])=>v);
 const existing=data.id?await env.DB!.prepare('SELECT id FROM members WHERE id=? AND owner=?').bind(data.id,user.userId).first():null;
 if(data.id&&!existing)return json({error:'Membro não encontrado.'},404);
 const duplicate=await env.DB!.prepare('SELECT id FROM members WHERE owner=? AND name_key=? AND id<>?').bind(user.userId,key,data.id||'').first();
 if(duplicate)return json({error:'Esse nome já está cadastrado em Membros.'},409);
 const id=data.id||crypto.randomUUID();
 try{await env.DB!.prepare('INSERT INTO members (id,owner,name,name_key,aliases,created) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_key=excluded.name_key,aliases=excluded.aliases').bind(id,user.userId,name,key,JSON.stringify(aliases),new Date().toISOString()).run();}
 catch(e){if(String(e).includes('UNIQUE'))return json({error:'Esse nome já está cadastrado.'},409);throw e}
 return json({id,name,aliases});
}
export async function DELETE(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Entre na sua conta.'},401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 const id=new URL(request.url).searchParams.get('id');if(!id)return json({error:'Membro inválido.'},400);
 const result=await env.DB!.prepare('DELETE FROM members WHERE id=? AND owner=?').bind(id,user.userId).run();
 return result.meta.changes?json({ok:true}):json({error:'Membro não encontrado.'},404);
}
