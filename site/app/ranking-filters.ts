export type RankingPeriod='all'|'today'|'3'|'7';
export function rankingDay(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return part('year')+'-'+part('month')+'-'+part('day');
}
export const locationKey=(title:string)=>title.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
export function filterRankingActions<T extends {date:string;title:string}>(actions:T[],period:RankingPeriod,place:string,now=new Date()):T[]{
 const today=rankingDay(now),start=new Date(today+'T12:00:00Z');
 start.setUTCDate(start.getUTCDate()-(period==='3'?2:period==='7'?6:0));
 const first=start.toISOString().slice(0,10);
 return actions.filter(a=>(!place||locationKey(a.title)===place)&&(period==='all'||(a.date>=first&&a.date<=today)));
}

export const rankingNameKey=(name:string)=>name.trim().toLocaleLowerCase('pt-BR');
export function participantActions<T extends {date:string;created:string;participants:{name:string;kills:number}[]}>(actions:T[],name:string){
 return actions.flatMap(action=>{const participants=action.participants.filter(p=>rankingNameKey(p.name)===rankingNameKey(name));return participants.length?[{action,kills:participants.reduce((sum,p)=>sum+p.kills,0)}]:[];}).sort((a,b)=>b.action.date.localeCompare(a.action.date)||b.action.created.localeCompare(a.action.created));
}
