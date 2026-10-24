import {nameKey} from './member-match';
export function detectResult(readings:string[]):''|'victory'|'defeat'{
 const results=new Set<'victory'|'defeat'>();
 for(const text of readings){
  const key=nameKey(text);
  if(/(?:os)?assaltantesvenceram/.test(key))results.add('victory');
  // Sparse OCR can return the right half of the tilted banner first.
  if(/oficiais.{0,12}daleivenceram|daleivenceram.{0,12}oficiais/.test(key))results.add('defeat');
 }
 return results.size===1?[...results][0]:'';
}
// A registered name cannot occupy two rows in one report. Ask for both names
// instead of silently attributing the second participant's kills to the first.
export function uniquePlayers<T extends {name:string;matchedName?:boolean}>(players:T[]):T[]{
 const counts=new Map<string,number>();
 for(const p of players)if(p.name)counts.set(nameKey(p.name),(counts.get(nameKey(p.name))||0)+1);
 return players.map(p=>p.name&&(counts.get(nameKey(p.name))||0)>1?{...p,name:'',matchedName:false}:p);
}
