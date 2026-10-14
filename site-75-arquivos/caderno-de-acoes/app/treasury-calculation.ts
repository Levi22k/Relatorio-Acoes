import {nameKey,type Member} from './member-match';

export const prizeRules=[
 {label:'Banco normal',amount:1125000}, {label:'Banco de Armadillo',amount:1350000},
 {label:'Petrolífera',amount:1350000}, {label:'Estação normal',amount:750000},
 {label:'Estação de Armadillo',amount:900000}, {label:'Lojinha · inclui Cidade Queimada',amount:425000},
];
export const money=(cents:number)=>'$ '+(cents/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
export const reservePercent=15;
export const bandReserve=(prize:number)=>Math.round(prize*reservePercent/100);
export const memberPrize=(prize:number)=>prize-bandReserve(prize);
export type TreasuryAction={id:string;title:string;category:string;date:string;result:string;participants:{name:string;dead?:boolean|null}[]};
export type Payment={id:string;name:string;amount:number;created:string};
export type Adjustment=Payment&{reason:string};
export type AdjustmentEvent=Adjustment&{adjustmentId:string;event:'created'|'reversed'};
export type Credit={actionId:string;title:string;date:string;amount:number;gross:number;withheld:number;prize:number;participants:number};
export type Account={key:string;name:string;earned:number;grossEarned:number;withheld:number;paid:number;balance:number;adjusted:number;adjustments:Adjustment[];credits:Credit[];payments:Payment[]};
export type TreasuryData={accounts:Account[];unpriced:{id:string;title:string}[];earned:number;grossEarned:number;bandReserve:number;paid:number;balance:number;overpaid:number;victories:number;history?:AdjustmentEvent[]};

export function actionPrize(category:string,title:string):number|null {
 const t=title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const armadillo=/\barmadillo\b|\bam\b/.test(t);
 if(/cidade queimada/.test(t))return 425000;
 if(category==='banks')return armadillo?1350000:1125000;
 if(category==='stations')return armadillo?900000:750000;
 if(category==='oil')return 1350000;
 if(category==='stores')return 425000;
 return null;
}

// Financial attribution uses exact names/aliases only, never fuzzy OCR guesses.
export function treasuryIdentity(name:string,members:Member[]) {
 const key=nameKey(name);
 const full=members.filter(m=>nameKey(m.name)===key);
 const matches=full.length?full:members.filter(m=>m.aliases.some(a=>nameKey(a)===key));
 const canonical=matches.length===1?matches[0].name:name.trim();
 return {key:nameKey(canonical),name:canonical};
}

export function calculateTreasury(actions:TreasuryAction[],payments:Payment[],members:Member[],adjustments:Adjustment[]=[]):TreasuryData {
 const accounts=new Map<string,Account>();
 function account(name:string){const identity=treasuryIdentity(name,members);let a=accounts.get(identity.key);if(!a){a={...identity,earned:0,grossEarned:0,withheld:0,paid:0,balance:0,adjusted:0,adjustments:[],credits:[],payments:[]};accounts.set(identity.key,a)}return a;}
 for(const member of members)account(member.name);
 const unpriced:{id:string;title:string}[]=[];let victories=0;
 for(const action of actions){
  if(action.result!=='victory')continue;
  const prize=actionPrize(action.category,action.title);
  if(prize===null||!action.participants.length){unpriced.push({id:action.id,title:action.title});continue;}
  victories++;
  // Split gross and net pools in the same stable order, preserving every cent.
  const participants=action.participants.map(p=>({name:p.name,key:treasuryIdentity(p.name,members).key})).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
  const net=memberPrize(prize),base=Math.floor(net/participants.length),remainder=net%participants.length;
  const grossBase=Math.floor(prize/participants.length),grossRemainder=prize%participants.length;
  participants.forEach((p,i)=>{const a=account(p.name),amount=base+(i<remainder?1:0),gross=grossBase+(i<grossRemainder?1:0),withheld=gross-amount;a.earned+=amount;a.grossEarned+=gross;a.withheld+=withheld;a.credits.push({actionId:action.id,title:action.title,date:action.date,amount,gross,withheld,prize,participants:participants.length});});
 }
 for(const payment of payments){const a=account(payment.name);a.paid+=payment.amount;a.payments.push(payment);}
 for(const adjustment of adjustments){const a=account(adjustment.name);a.adjusted+=adjustment.amount;a.adjustments.push(adjustment);}
 const list=[...accounts.values()].map(a=>({...a,balance:a.earned+a.adjusted-a.paid,adjustments:a.adjustments.sort((a,b)=>b.created.localeCompare(a.created)),credits:a.credits.sort((a,b)=>b.date.localeCompare(a.date)),payments:a.payments.sort((a,b)=>b.created.localeCompare(a.created))})).sort((a,b)=>b.balance-a.balance||a.name.localeCompare(b.name,'pt-BR'));
 return {accounts:list,unpriced,victories,earned:list.reduce((s,a)=>s+a.earned,0),grossEarned:list.reduce((s,a)=>s+a.grossEarned,0),bandReserve:list.reduce((s,a)=>s+a.withheld,0),paid:list.reduce((s,a)=>s+a.paid,0),balance:list.reduce((s,a)=>s+Math.max(0,a.balance),0),overpaid:list.reduce((s,a)=>s+Math.max(0,-a.balance),0)};
}
