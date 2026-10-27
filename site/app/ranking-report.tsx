import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {t,getLocale,useLanguage} from './i18n';
import {participantActions,type RankingPeriod} from './ranking-filters';
type ReportAction={id:string;title:string;date:string;created:string;participants:{name:string;kills:number}[]};
export default function RankingReport({name,actions,period,place,onClose}:{name:string;actions:ReportAction[];period:RankingPeriod;place:string;onClose:()=>void}){
 useLanguage();const panel=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>previous?.focus()},[]);
 const rows=participantActions(actions,name);
 const periodLabel={all:'Geral',today:'Hoje','3':'Últimos 3 dias','7':'Últimos 7 dias'}[period];
 return <div className="overlay"><section ref={panel} className="modal ranking-report" role="dialog" aria-modal="true" aria-labelledby="ranking-report-title" onKeyDown={e=>{if(e.key==='Tab'){e.preventDefault();close.current?.focus()}}}>
 <div className="modal-head"><div><div className="eyebrow">{t('RELATÓRIO DE ABATES')}</div><h2 id="ranking-report-title">{name}</h2><p>{t(periodLabel)} · {t(place||'Todos os locais')}</p></div><button ref={close} className="icon-button" aria-label={t('Fechar relatório')} onClick={onClose}><X/></button></div>
 <div className="ranking-report-body"><div className="ranking-overview"><span>{t('AÇÕES')}: <b>{rows.length}</b></span><span>{t('ABATES')}: <b>{rows.reduce((sum,row)=>sum+row.kills,0)}</b></span></div><p className="member-footnote">{t('Ações do participante nos filtros selecionados. Horários de registro em Brasília.')}</p>
 {!rows.length?<p>{t('Nenhuma ação encontrada')}</p>:<ul className="ranking-report-list">{rows.map(({action,kills})=>{const time=action.created&&Number.isFinite(Date.parse(action.created))?new Date(action.created).toLocaleTimeString(getLocale(),{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}):null;return <li key={action.id}><div><strong>{t(action.title)}</strong><small>{new Date(action.date+'T12:00:00').toLocaleDateString(getLocale())} · {time?<>{t('Registrado às ')}{time}</>:t('Horário não disponível')}</small></div><b className="ranking-report-kills">{kills} {t('abates')}</b></li>})}</ul>}</div>
 </section></div>;
}
