// Camada local no navegador.
// Responde às mesmas rotas /api/* que o servidor respondia (actions, members, treasury, images),
// com as mesmas validações, mensagens e formatos de resposta, guardando tudo no IndexedDB deste
// navegador. Os componentes do app continuam chamando fetch('/api/...') sem nenhuma alteração.
import {locations} from '../app/locations';
import {nameKey} from '../app/member-match';
import {calculateTreasury,treasuryIdentity} from '../app/treasury-calculation';

/* ---------- IndexedDB ---------- */

const DB_NAME='caderno-de-acoes';
const STORES=['actions','members','payments','adjustments','events','images'] as const;
type StoreName=typeof STORES[number];
type Op={store:StoreName;put?:unknown;del?:string};

let dbPromise:Promise<IDBDatabase>|undefined;
function openDb():Promise<IDBDatabase>{
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{const db=req.result;for(const s of STORES)if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'id'});};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>{dbPromise=undefined;reject(req.error)};
 });
 return dbPromise;
}
async function all<T=any>(store:StoreName):Promise<T[]>{
 const db=await openDb();
 return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result as T[]);r.onerror=()=>reject(r.error)});
}
async function get<T=any>(store:StoreName,id:string):Promise<T|undefined>{
 const db=await openDb();
 return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result as T|undefined);r.onerror=()=>reject(r.error)});
}
// Todas as operações de uma chamada entram na mesma transação: ou salvam juntas ou não salvam.
async function write(ops:Op[]):Promise<void>{
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const t=db.transaction([...new Set(ops.map(o=>o.store))],'readwrite');
  for(const o of ops){const s=t.objectStore(o.store);if(o.del!==undefined)s.delete(o.del);else s.put(o.put)}
  t.oncomplete=()=>resolve();
  t.onerror=()=>reject(t.error);
  t.onabort=()=>reject(t.error);
 });
}
// Evita que duas abas do mesmo navegador gravem ao mesmo tempo.
function locked<T>(fn:()=>Promise<T>):Promise<T>{
 const locks=(navigator as any).locks;
 return locks&&typeof locks.request==='function'?locks.request('caderno-de-acoes',fn):fn();
}

/* ---------- utilidades ---------- */

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
 ?crypto.randomUUID()
 :'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3)|8).toString(16)});
const byId=(a:{id:string},b:{id:string})=>a.id<b.id?-1:a.id>b.id?1:0;
// Mesma ordenação do banco original (COLLATE NOCASE só ignora maiúsculas de A a Z).
const fold=(s:string)=>s.replace(/[A-Z]/g,c=>c.toLowerCase());
const nocase=(a:string,b:string)=>{const x=fold(a),y=fold(b);return x<y?-1:x>y?1:0};

// A tela exibe as prints com <img src>, que não passa pelo fetch. Por isso a "URL da print"
// é uma URL de blob criada a partir da imagem guardada no navegador.
const urlCache=new Map<string,{key:string;url:string}>();
async function imageUrlFor(action:any):Promise<string>{
 const hit=urlCache.get(action.id);
 if(hit&&hit.key===action.imageKey)return hit.url;
 if(hit)URL.revokeObjectURL(hit.url);
 const img=await get('images',action.imageKey);
 if(!img)return '';
 const url=URL.createObjectURL(new Blob([img.data],{type:img.type}));
 urlCache.set(action.id,{key:action.imageKey,url});
 return url;
}
function forgetUrl(actionId:string){
 const hit=urlCache.get(actionId);
 if(hit){URL.revokeObjectURL(hit.url);urlCache.delete(actionId)}
}

/* ---------- /api/actions ---------- */

async function actionsGet(){
 const rows=await all('actions');
 rows.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:a.created<b.created?1:a.created>b.created?-1:0);
 const out=[];
 for(const r of rows)out.push({id:r.id,title:r.title,date:r.date,category:r.category,result:r.result,participants:r.participants,created:r.created,imageUrl:await imageUrlFor(r)});
 return json(out);
}

async function actionsPost(body:any){
 let form:FormData;let data:any;
 try{if(!(body instanceof FormData))throw new Error();form=body;data=JSON.parse(String(form.get('data')))}catch{return json({error:'Registro inválido.'},400)}
 if(!data||typeof data.title!=='string'||!data.title.trim()||data.title.length>100||!['victory','defeat','cancelled'].includes(data.result)||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||!Array.isArray(data.participants)||data.participants.length<1||data.participants.length>50||data.participants.some((p:any)=>typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!Number.isInteger(p.kills)||p.kills<0||p.kills>999||(p.dead!==undefined&&p.dead!==null&&typeof p.dead!=='boolean')))return json({error:'Confira título, data, resultado, nomes e abates (0 a 999).'},400);
 if(!locations[data.category])return json({error:'Selecione uma seção válida.'},400);
 if(new Set(data.participants.map((p:any)=>p.name.trim().toLocaleLowerCase('pt-BR'))).size!==data.participants.length)return json({error:'Há nomes repetidos na mesma ação.'},400);
 const existing=data.id?await get('actions',data.id):undefined;
 if(data.id&&!existing)return json({error:'Ação não encontrada.'},404);
 const file=form.get('image');const isFile=file instanceof File&&file.size>0;
 if(!existing&&!isFile)return json({error:'Adicione uma print.'},400);
 if(isFile&&(file.size>10*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)))return json({error:'Use PNG, JPG ou WebP de até 10 MB.'},400);
 const id=existing?.id||uuid();
 const imageKey=isFile?'local/'+uuid():existing.imageKey;
 const ops:Op[]=[];
 if(isFile)ops.push({store:'images',put:{id:imageKey,type:file.type,data:await file.arrayBuffer()}});
 ops.push({store:'actions',put:{id,title:data.title.trim(),date:data.date,category:data.category,result:data.result,participants:data.participants.map((p:any)=>({name:p.name.trim(),kills:p.kills,dead:typeof p.dead==='boolean'?p.dead:null})),imageKey,created:existing?.created||new Date().toISOString()}});
 if(existing&&isFile)ops.push({store:'images',del:existing.imageKey});
 await write(ops);
 return json({id});
}

async function actionsDelete(url:URL){
 const id=url.searchParams.get('id');
 const row=id?await get('actions',id):undefined;
 if(!row)return json({error:'Ação não encontrada.'},404);
 await write([{store:'actions',del:row.id},{store:'images',del:row.imageKey}]);
 forgetUrl(row.id);
 return json({ok:true});
}

/* ---------- /api/images/:id (mantida por compatibilidade) ---------- */

async function imageGet(id:string){
 const row=await get('actions',id);
 if(!row)return new Response('Não encontrado',{status:404});
 const img=await get('images',row.imageKey);
 if(!img)return new Response('Não encontrado',{status:404});
 return new Response(new Blob([img.data],{type:img.type}),{headers:{'Content-Type':img.type||'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}

/* ---------- /api/members ---------- */

async function membersGet(){
 const rows=await all('members');
 rows.sort((a,b)=>nocase(a.name,b.name));
 return json(rows.map(r=>({id:r.id,name:r.name,aliases:r.aliases})));
}

async function membersPost(body:any){
 let data:any;try{data=JSON.parse(String(body))}catch{return json({error:'Cadastro inválido.'},400)}
 if(!data||typeof data.name!=='string'||!nameKey(data.name)||data.name.trim().length>80||!Array.isArray(data.aliases)||data.aliases.length>20||data.aliases.some((a:any)=>typeof a!=='string'||!nameKey(a)||a.trim().length>80)||(data.id!==undefined&&typeof data.id!=='string'))return json({error:'Informe um nome de até 80 caracteres e até 20 apelidos válidos.'},400);
 const name=data.name.trim().replace(/\s+/g,' '),key=nameKey(name);
 const aliases=[...new Map(data.aliases.map((a:string)=>[nameKey(a),a.trim().replace(/\s+/g,' ')])).entries()].filter(([k])=>k!==key).map(([,v])=>v);
 const members=await all('members');
 const existing=data.id?members.find(m=>m.id===data.id):undefined;
 if(data.id&&!existing)return json({error:'Membro não encontrado.'},404);
 if(members.some(m=>m.nameKey===key&&m.id!==(data.id||'')))return json({error:'Esse nome já está cadastrado em Membros.'},409);
 const id=data.id||uuid();
 await write([{store:'members',put:{id,name,nameKey:key,aliases,created:existing?.created||new Date().toISOString()}}]);
 return json({id,name,aliases});
}

async function membersDelete(url:URL){
 const id=url.searchParams.get('id');if(!id)return json({error:'Membro inválido.'},400);
 const row=await get('members',id);
 if(!row)return json({error:'Membro não encontrado.'},404);
 await write([{store:'members',del:id}]);
 return json({ok:true});
}

/* ---------- /api/treasury ---------- */

async function readTreasury(){
 const [actions,members,payments,adjustments]=await Promise.all([all('actions'),all('members'),all('payments'),all('adjustments')]);
 const data={
  actions:actions.sort(byId).map(a=>({id:a.id,title:a.title,category:a.category,date:a.date,result:a.result,participants:a.participants})),
  members:members.sort(byId).map(m=>({id:m.id,name:m.name,aliases:m.aliases})),
  payments:payments.sort(byId).map(p=>({id:p.id,name:p.name,amount:p.amount,created:p.created})),
  adjustments:adjustments.sort(byId).map(a=>({id:a.id,name:a.name,amount:a.amount,reason:a.reason,created:a.created})),
 };
 return {data,totals:calculateTreasury(data.actions,data.payments,data.members,data.adjustments)};
}

async function treasuryGet(){
 const state=await readTreasury();
 const [events,adjustments]=await Promise.all([all('events'),all('adjustments')]);
 const hasCreated=new Set(events.filter(e=>e.event==='created').map(e=>e.adjustmentId));
 const history=[
  ...events.map(e=>({id:e.id,adjustmentId:e.adjustmentId,name:e.name,amount:e.amount,reason:e.reason,event:e.event,created:e.created})),
  ...adjustments.filter(a=>!hasCreated.has(a.id)).map(a=>({id:a.id+':created',adjustmentId:a.id,name:a.name,amount:a.amount,reason:a.reason,event:'created',created:a.created})),
 ].sort((a,b)=>a.created<b.created?1:a.created>b.created?-1:a.id<b.id?1:a.id>b.id?-1:0);
 return json({...state.totals,history});
}

async function treasuryPost(body:any){
 let input:any;try{input=JSON.parse(String(body))}catch{return json({error:'Pagamento inválido.'},400)}
 const adjustment=input?.kind==='adjustment';
 if(!input||typeof input.id!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(input.id)||typeof input.key!=='string'||!Number.isSafeInteger(input.amount)||Math.abs(input.amount)>100000000000||input.amount===0||(!adjustment&&input.amount<0)||(input.kind!==undefined&&!['payment','adjustment'].includes(input.kind)))return json({error:'Informe um valor válido e diferente de zero.'},400);
 if(adjustment&&(typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>200))return json({error:'Informe um motivo de até 200 caracteres.'},400);
 const state=await readTreasury(),account=state.totals.accounts.find(a=>a.key===input.key);
 if(adjustment){
  const reason=input.reason.trim();
  const previous=await get('adjustments',input.id);
  if(previous)return previous.amount===input.amount&&previous.reason===reason&&treasuryIdentity(previous.name,state.data.members).key===input.key?json({ok:true}):json({error:'Identificador já utilizado. Atualize a página.'},409);
  const reversed=(await all('events')).some(e=>e.adjustmentId===input.id&&e.event==='reversed');
  if(reversed)return json({error:'Este ajuste já foi desfeito. Abra um novo ajuste.'},409);
  if(!account)return json({error:'Membro não encontrado. Cadastre-o em Membros ou atualize a página.'},404);
  const created=new Date().toISOString();
  await write([
   {store:'adjustments',put:{id:input.id,name:account.name,amount:input.amount,reason,created}},
   {store:'events',put:{id:input.id+':created',adjustmentId:input.id,name:account.name,amount:input.amount,reason,event:'created',created}},
  ]);
  return json({ok:true});
 }
 const previous=await get('payments',input.id);
 if(previous)return previous.amount===input.amount&&treasuryIdentity(previous.name,state.data.members).key===input.key?json({ok:true}):json({error:'Identificador já utilizado. Atualize a página.'},409);
 if(!account||input.amount>account.balance)return json({error:'O valor ultrapassa o saldo disponível. Atualize a tesouraria.'},409);
 await write([{store:'payments',put:{id:input.id,name:account.name,amount:input.amount,created:new Date().toISOString()}}]);
 return json({ok:true});
}

async function treasuryDelete(url:URL){
 const id=url.searchParams.get('id');if(!id)return json({error:'Pagamento inválido.'},400);
 if(url.searchParams.get('kind')==='adjustment'){
  const row=await get('adjustments',id);
  if(!row)return json({error:'Ajuste não encontrado.'},404);
  const events=await all('events');
  const ops:Op[]=[];
  if(!events.some(e=>e.id===id+':created'))ops.push({store:'events',put:{id:id+':created',adjustmentId:id,name:row.name,amount:row.amount,reason:row.reason,event:'created',created:row.created}});
  if(!events.some(e=>e.id===id+':reversed'))ops.push({store:'events',put:{id:id+':reversed',adjustmentId:id,name:row.name,amount:-row.amount,reason:row.reason,event:'reversed',created:new Date().toISOString()}});
  ops.push({store:'adjustments',del:id});
  await write(ops);
  return json({ok:true});
 }
 const row=await get('payments',id);
 if(!row)return json({error:'Pagamento não encontrado.'},404);
 await write([{store:'payments',del:id}]);
 return json({ok:true});
}

/* ---------- roteador ---------- */

async function route(method:string,url:URL,body:any):Promise<Response>{
 const path=url.pathname.replace(/\/+$/,'');
 const image=path.match(/^\/api\/images\/([^/]+)$/);
 if(image&&method==='GET')return imageGet(decodeURIComponent(image[1]));
 if(path==='/api/actions'){
  if(method==='GET')return actionsGet();
  if(method==='POST')return locked(()=>actionsPost(body));
  if(method==='DELETE')return locked(()=>actionsDelete(url));
 }
 if(path==='/api/members'){
  if(method==='GET')return membersGet();
  if(method==='POST')return locked(()=>membersPost(body));
  if(method==='DELETE')return locked(()=>membersDelete(url));
 }
 if(path==='/api/treasury'){
  if(method==='GET')return treasuryGet();
  if(method==='POST')return locked(()=>treasuryPost(body));
  if(method==='DELETE')return locked(()=>treasuryDelete(url));
 }
 return json({error:'Não encontrado.'},404);
}

/* ---------- instala o fetch local ---------- */

export function installLocalApi(){
 const realFetch=window.fetch.bind(window);
 window.fetch=async(input:RequestInfo|URL,init?:RequestInit):Promise<Response>=>{
  const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  let url:URL;
  try{url=new URL(raw,window.location.href)}catch{return realFetch(input,init)}
  if(url.origin!==window.location.origin||!url.pathname.startsWith('/api/'))return realFetch(input,init);
  const method=(init?.method||(typeof input==='object'&&'method' in input?input.method:'GET')).toUpperCase();
  try{return await route(method,url,init?.body)}
  catch{return json({error:'Não foi possível concluir a operação neste navegador.'},500)}
 };
 // Pede ao navegador para não apagar os dados do site quando faltar espaço.
 try{void navigator.storage?.persist?.()}catch{/* sem suporte */}
}

