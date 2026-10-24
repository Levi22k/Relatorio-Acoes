export type Scope={from:string;to:string;place:string};
export const inScope=(a:{date:string;title:string},s:Scope)=>(!s.from||a.date>=s.from)&&(!s.to||a.date<=s.to)&&(!s.place||a.title===s.place);
export function readTeamTotal(text:string):number|undefined{
 const matches=[...text.matchAll(/\b(\d{1,3})\s+abates\b/gi)].map(m=>Number(m[1]));
 return matches.length===1?matches[0]:undefined;
}
export function reviewSummary(players:{name:string;kills:number;killsUncertain?:boolean}[],expected?:number){
 const actual=players.reduce((s,p)=>s+(Number.isFinite(p.kills)?p.kills:0),0);
 return {actual,mismatch:expected!==undefined&&expected!==actual,uncertain:players.filter(p=>p.killsUncertain).length};
}
export async function imageHash(file:Blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function thumbnail(file:Blob){
 const bitmap=await createImageBitmap(file);try{
 const scale=Math.min(1,480/bitmap.width),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
 return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha ao criar miniatura.')),'image/webp',.78));
 }finally{bitmap.close()}
}
