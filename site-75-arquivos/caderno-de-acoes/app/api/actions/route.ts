import { env } from 'cloudflare:workers';
import {locations} from '../../locations';
import { getChatGPTUser } from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET() {
 const user=await getChatGPTUser(); if(!user) return json({error:'Entre na sua conta para acessar o histórico.'},401);
 const data=await env.DB!.prepare('SELECT * FROM actions WHERE owner = ? ORDER BY date DESC, created DESC').bind(user.userId).all();
 return json(data.results.map((r:any)=>({...r,participants:JSON.parse(r.participants),imageUrl:'/api/images/'+r.id,image_key:undefined,owner:undefined})));
}
export async function POST(request:Request) {
 const user=await getChatGPTUser(); if(!user) return json({error:'Entre na sua conta para salvar.'},401);
 if (request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin) return json({error:'Origem inválida.'},403);
 let form:FormData; let data:any;
 try { form=await request.formData(); data=JSON.parse(String(form.get('data'))); } catch {return json({error:'Registro inválido.'},400);}
 if(!data || typeof data.title!=='string'|| !data.title.trim()||data.title.length>100||!['victory','defeat','cancelled'].includes(data.result)||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)|| !Array.isArray(data.participants)||data.participants.length<1||data.participants.length>50||data.participants.some((p:any)=>typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!Number.isInteger(p.kills)||p.kills<0||p.kills>999||(p.dead!==undefined&&p.dead!==null&&typeof p.dead!=="boolean"))) return json({error:'Confira título, data, resultado, nomes e abates (0 a 999).'},400);
 if(!locations[data.category])return json({error:'Selecione uma seção válida.'},400);
 if(new Set(data.participants.map((p:any)=>p.name.trim().toLocaleLowerCase('pt-BR'))).size!==data.participants.length) return json({error:'Há nomes repetidos na mesma ação.'},400);
 const existing=data.id?await env.DB!.prepare('SELECT * FROM actions WHERE id=? AND owner=?').bind(data.id,user.userId).first<any>():null;
 if(data.id&&!existing) return json({error:'Ação não encontrada.'},404);
 const file=form.get('image'); const isFile=file instanceof File && file.size>0;
 if(!existing&&!isFile) return json({error:'Adicione uma print.'},400);
 if(isFile && (file.size>10*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))) return json({error:'Use PNG, JPG ou WebP de até 10 MB.'},400);
 const id=existing?.id||crypto.randomUUID(); const imageKey=isFile?user.userId+'/'+crypto.randomUUID():existing.image_key;
 if(isFile) await env.BUCKET!.put(imageKey,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});
 try {
 await env.DB!.prepare('INSERT INTO actions (id,owner,title,date,result,participants,image_key,created,category) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,date=excluded.date,result=excluded.result,participants=excluded.participants,image_key=excluded.image_key,category=excluded.category').bind(id,user.userId,data.title.trim(),data.date,data.result,JSON.stringify(data.participants.map((p:any)=>({name:p.name.trim(),kills:p.kills,dead:typeof p.dead==="boolean"?p.dead:null}))),imageKey,existing?.created||new Date().toISOString(),data.category).run();
 } catch(e) {if(isFile) await env.BUCKET!.delete(imageKey); throw e;}
 if(existing&&isFile) await env.BUCKET!.delete(existing.image_key);
 return json({id});
}
export async function DELETE(request:Request) {
 const user=await getChatGPTUser(); if(!user) return json({error:'Entre na sua conta.'},401);
 if(request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin) return json({error:'Origem inválida.'},403);
 const id=new URL(request.url).searchParams.get('id');
 const row=await env.DB!.prepare('SELECT image_key FROM actions WHERE id=? AND owner=?').bind(id,user.userId).first<any>();
 if(!row)return json({error:'Ação não encontrada.'},404);
 await env.DB!.prepare('DELETE FROM actions WHERE id=? AND owner=?').bind(id,user.userId).run();
 await env.BUCKET!.delete(row.image_key);return json({ok:true});
}


