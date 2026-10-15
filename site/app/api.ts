import {calculateTreasury} from './treasury-calculation';
const url=(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
const key=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
export const configured=!!url&&!!key;
const headers:Record<string,string>={apikey:key};
// Publishable keys use apikey only; legacy anon JWTs also support Authorization.
if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
async function remote(path:string,options:RequestInit={}){
 if(!configured)throw new Error('Configure o Supabase antes de usar o caderno.');
 const r=await globalThis.fetch(url+path,{...options,headers:{...headers,...options.headers}});
 const body=await r.json();if(!r.ok)throw new Error(body.message||body.error_description||body.error||'Não foi possível acessar o banco.');return body;
}
async function rpc(op:string,payload:unknown={}){return remote('/rest/v1/rpc/caderno_api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,payload})});}
export async function treasuryVisibility(op:'list'|'hide'|'restore',key?:string):Promise<string[]|{ok:boolean}>{
 return remote('/rest/v1/rpc/caderno_treasury_visibility',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,payload:key?{key}:{}})});
}
const imageUrl=(path:string)=>url+'/storage/v1/object/public/action-prints/'+path;
async function removeImage(path:string){if(!path)return;await remote('/storage/v1/object/action-prints',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});}
export async function apiFetch(input:string,options:RequestInit={}):Promise<Response>{
 if(!input.startsWith('/api/'))return globalThis.fetch(input,options);
 try{
  const route=new URL(input,'https://local.invalid'),resource=route.pathname.slice(5),method=options.method||'GET';
  let data:any;
  if(resource==='actions'&&method==='POST'){
   const form=options.body as FormData,body=JSON.parse(String(form.get('data'))),file=form.get('image');let uploaded='';
   if(file instanceof File&&file.size){
    if(file.size>10*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Use PNG, JPG ou WebP de até 10 MB.');
    uploaded=crypto.randomUUID()+({ 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[file.type]||'');
    await remote('/storage/v1/object/action-prints/'+uploaded,{method:'POST',headers:{'Content-Type':file.type,'x-upsert':'false'},body:file});
   }
   try{data=await rpc('actions.save',{...body,image_key:uploaded||undefined});}catch(e){if(uploaded)await removeImage(uploaded).catch(()=>{});throw e;}
   if(data.oldImage)await removeImage(data.oldImage).catch(()=>{});
  }else if(method==='GET'){
   data=await rpc(resource+'.list');
   if(resource==='actions')data=data.map((a:any)=>({...a,imageUrl:imageUrl(a.image_key)}));
   if(resource==='treasury')data={...calculateTreasury(data.actions,data.payments,data.members,data.adjustments),history:data.history};
  }else if(method==='POST')data=await rpc(resource+'.save',JSON.parse(String(options.body)));
  else if(method==='DELETE'){
   data=await rpc(resource+'.delete',Object.fromEntries(route.searchParams));
   if(data.oldImage)await removeImage(data.oldImage).catch(()=>{});
  }else throw new Error('Operação inválida.');
  return Response.json(data);
 }catch(e:any){return Response.json({error:e.message||'Falha de conexão.'},{status:400});}
}
