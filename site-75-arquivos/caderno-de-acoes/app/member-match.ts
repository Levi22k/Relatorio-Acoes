import {distance} from './ocr-image';
export type Member={id:string;name:string;aliases:string[]};
export const nameKey=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function matchMembers(candidates:string[],members:Member[]){
 const inputs=candidates.map(nameKey).filter(Boolean);
 const ranked=members.map(m=>({member:m,score:Math.max(0,...[m.name,...m.aliases].map(nameKey).filter(Boolean).flatMap(n=>inputs.map(c=>1-distance(c,n)/Math.max(c.length,n.length))))})).filter(m=>m.score>=.65).sort((a,b)=>b.score-a.score);
 const suggestions=ranked.slice(0,5).map(r=>r.member.name);
 const top=ranked[0],second=ranked[1];
 // Ambiguous aliases and similar full names must remain a human choice.
 const match=top&&(top.score===1||(top.score>=.80&&inputs.some(c=>c.length>=5)))&&(!second||top.score-second.score>=.08)?top.member:undefined;
 return {match,suggestions,ambiguous:!match&&ranked.length>1};
}
