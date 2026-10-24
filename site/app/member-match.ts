import {distance} from './ocr-image';
export type Member={id:string;name:string;aliases:string[];archived?:boolean};
export const nameKey=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
// Account for glyphs that OCR often joins or splits, without treating every
// spelling difference as equivalent or guessing from a shared surname alone.
export function ocrNameScore(a:string,b:string){
 const plain=1-distance(a,b)/Math.max(a.length,b.length,1);
 if(plain===1||plain<.65||Math.min(a.length,b.length)<8)return plain;
 const d=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i?j?0:i:j));
 const pairs=[['rn','m'],['vv','w'],['cl','d'],['li','h']];
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  const x=a[i-1],y=b[j-1],similar=['il1','o0','s5'].some(group=>group.includes(x)&&group.includes(y));
  d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(x===y?0:similar?.35:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+.65);
  for(const pair of pairs)for(const [from,to] of [pair,[pair[1],pair[0]]])if(i>=from.length&&j>=to.length&&a.slice(i-from.length,i)===from&&b.slice(j-to.length,j)===to)d[i][j]=Math.min(d[i][j],d[i-from.length][j-to.length]+.45);
 }
 const visual=1-d[a.length][b.length]/Math.max(a.length,b.length);
 return visual>=.84?Math.max(plain,Math.min(.97,visual)):plain;
}
export function matchMembers(candidates:string[],members:Member[]){
 const inputs=candidates.map(nameKey).filter(Boolean);
 const ranked=members.map(m=>({member:m,score:Math.max(0,...[m.name,...m.aliases].map(nameKey).filter(Boolean).flatMap(n=>inputs.map(c=>ocrNameScore(c,n))))})).filter(m=>m.score>=.65).sort((a,b)=>b.score-a.score);
 const suggestions=ranked.slice(0,5).map(r=>r.member.name);
 const top=ranked[0],second=ranked[1];
 // Ambiguous aliases and similar full names must remain a human choice.
 const match=top&&(top.score===1||(top.score>=.80&&inputs.some(c=>c.length>=5)))&&(!second||top.score-second.score>=.08)?top.member:undefined;
 return {match,suggestions,ambiguous:!match&&ranked.length>1};
}
// Compare independent image treatments with the registry. OCR confidence is not
// name correctness: crossed-out letters can receive low confidence even when the
// full name strongly matches. Repeated treatments cannot multiply the evidence.
export function confirmMember(readings:{name:string;confidence:number;source:string}[],members:Member[]){
 const roster=members.filter(m=>!m.archived);
 const usable=readings.filter(r=>Number.isFinite(r.confidence)&&r.confidence>=30&&nameKey(r.name).length>=5);
 const exactIdentities=new Set<string>();
 for(const r of usable.filter(r=>r.confidence>=60)){
  const exact=roster.filter(m=>[m.name,...m.aliases].some(n=>nameKey(n)===nameKey(r.name)));
  if(exact.length>1)return undefined;
  if(exact.length)exactIdentities.add(exact[0].id);
 }
 if(exactIdentities.size>1)return undefined;
 const ranked=roster.map(member=>{
  const sources=new Map<string,number>();
  for(const r of usable){
   const key=nameKey(r.name),full=nameKey(member.name);
   // Short aliases are accepted exactly; fuzzy surname-only matches are not.
   let score=key.length>=8?ocrNameScore(key,full):key===full?1:0;
   if(member.aliases.some(a=>nameKey(a)===key))score=1;
   sources.set(r.source,Math.max(sources.get(r.source)||0,score));
  }
  const scores=[...sources.values()].sort((a,b)=>b-a);
  return {member,scores,score:((scores[0]||0)+(scores[1]||0))/2};
 }).sort((a,b)=>b.score-a.score);
 const top=ranked[0],second=ranked[1];if(!top)return undefined;
 if(exactIdentities.size&&!exactIdentities.has(top.member.id))return undefined;
 if(second&&top.score-second.score<.09)return undefined;
 return top.scores.length>=2&&top.scores[1]>=.84&&top.score>=.89?top.member:undefined;
}
