export type Bundle={version:number;exportedAt:string;actions:any[];members:any[];payments:any[];adjustments:any[];history:any[];payment_ids:any[];hidden:any[];events:any[];images?:Record<string,string>;integrity?:string};
export function validateBackup(value:any):asserts value is Bundle{
 const tables=['actions','members','payments','adjustments','history','payment_ids','hidden','events'];
 if(!value||![1,2].includes(value.version)||!Number.isFinite(Date.parse(value.exportedAt))||!tables.every(k=>Array.isArray(value[k])&&value[k].length<=100000&&value[k].every((r:any)=>r&&typeof r==='object'&&!Array.isArray(r))))throw new Error('Escolha um backup completo gerado por este site.');
 for(const table of ['actions','members','payments','adjustments']){
  const ids=new Set();for(const row of value[table]){
   if(typeof row.id!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(row.id)||ids.has(row.id))throw new Error('O backup contém registros inválidos ou repetidos. Nenhum dado foi restaurado.');ids.add(row.id);
  }
 }
 if(value.images&&(typeof value.images!=='object'||Array.isArray(value.images)))throw new Error('Lista de imagens inválida.');
 let total=0;
 for(const [key,data] of Object.entries(value.images||{})){
  if(!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(key)||typeof data!=='string'||data.length>15*1024*1024||!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/]*={0,2}$/.test(data))throw new Error('O backup contém uma imagem inválida.');
  total+=(data as string).length;if(total>240*1024*1024)throw new Error('As imagens deste backup ultrapassam o limite de 240 MB.');
 }
}
const canonical=(value:any):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);
export async function backupDigest(bundle:Bundle){
 const {integrity,...payload}=bundle;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(payload)));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function verifyBackup(bundle:unknown):Promise<Bundle>{
 validateBackup(bundle);
 if(bundle.version===2&&(!bundle.integrity||await backupDigest(bundle)!==bundle.integrity))throw new Error('O arquivo está incompleto ou foi alterado após a exportação. Nenhum dado foi restaurado.');
 return bundle;
}
