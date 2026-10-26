import {accessToken} from './auth-client';
import {calculateTreasury} from './treasury-calculation';
import {imageHash,thumbnail} from './quality';
const url=(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
const key=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
export const configured=!!url&&!!key;
const headers:Record<string,string>={apikey:key};
// Publishable keys use apikey only; legacy anon JWTs also support Authorization.
if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
async function remote(path:string,options:RequestInit={}){
 if(!configured)throw new Error('Configure o Supabase antes de usar o caderno.');
 const token=await accessToken();
 const r=await globalThis.fetch(url+path,{...options,headers:{...headers,...options.headers,...(token?{Authorization:'Bearer '+token}:{})}});
 const text=await r.text();let body:any;try{body=text?JSON.parse(text):{};}catch{throw new Error('O servidor retornou uma resposta inválida. Confira a conexão e tente novamente.');}if(!r.ok)throw new Error(body.message||body.error_description||body.error||'Não foi possível acessar o banco.');return body;
}
export async function rpc(op:string,payload:unknown={}){return remote('/rest/v1/rpc/caderno_api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,payload})});}
export async function treasuryVisibility(op:'list'|'hide'|'restore',key?:string):Promise<string[]|{ok:boolean}>{
 return remote('/rest/v1/rpc/caderno_treasury_visibility',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,payload:key?{key}:{}})});
}
export const imageUrl=(path:string)=>url+'/storage/v1/object/public/action-prints/'+path;
export async function uploadBackupImage(path:string,file:Blob){
 if(!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(path)||file.size>10*1024*1024)throw new Error('Imagem inválida no backup.');
 const existing=await globalThis.fetch(imageUrl(path),{method:'HEAD'});if(existing.ok)return;
 if(existing.status!==400&&existing.status!==404)throw new Error('Não foi possível conferir a imagem no servidor.');
 await remote('/storage/v1/object/action-prints/'+path,{method:'POST',headers:{'Content-Type':file.type,'x-upsert':'false'},body:file});
}
async function removeImage(path:string){if(!path)return;await remote('/storage/v1/object/action-prints',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});}
export async function apiFetch(input:string,options:RequestInit={}):Promise<Response>{
 if(!input.startsWith('/api/'))return globalThis.fetch(input,options);
 try{
  const route=new URL(input,'https://local.invalid'),resource=route.pathname.slice(5),method=options.method||'GET';
  let data:any;
  if(resource==='actions'&&method==='POST'){
   const form=options.body as FormData,body=JSON.parse(String(form.get('data'))),file=form.get('image');let uploaded='',thumb='';
   if(file instanceof File&&file.size){
    if(file.size>10*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Use PNG, JPG ou WebP de até 10 MB.');
    uploaded=crypto.randomUUID()+({ 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[file.type]||'');
    await remote('/storage/v1/object/action-prints/'+uploaded,{method:'POST',headers:{'Content-Type':file.type,'x-upsert':'false'},body:file});
   }
   data=await rpc('actions.save',{...body,image_key:uploaded||undefined});
   // A lost response may follow a successful save; never delete its image on a network error.
   // Retain previous images so an exported backup can recover deleted/edited actions.
  }else if(method==='GET'){
   data=await rpc(resource+'.list');
   if(resource==='actions')data=data.map((a:any)=>({...a,imageUrl:imageUrl(a.image_key),thumbnailUrl:a.thumbnail_key?imageUrl(a.thumbnail_key):undefined}));
   if(resource==='treasury')data={...calculateTreasury(data.actions,data.payments,data.members,data.adjustments),history:data.history};
  }else if(method==='POST')data=await rpc(resource+'.save',JSON.parse(String(options.body)));
  else if(method==='DELETE'){
   data=await rpc(resource+'.delete',Object.fromEntries(route.searchParams));
  }else throw new Error('Operação inválida.');
  return Response.json(data);
 }catch(e:any){return Response.json({error:e.message||'Falha de conexão.'},{status:400});}
}

export async function createLogin(payload:unknown){return remote('/functions/v1/create-manager',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});}
