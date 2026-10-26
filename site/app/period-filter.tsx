import {t,useLanguage,getLocale} from './i18n';
import type {Scope} from './quality';
export default function PeriodFilter({value,onChange,places}:{value:Scope;onChange:(s:Scope)=>void;places:string[]}){useLanguage();
 return <div className="filters period-filter"><label>{t("De")}<input aria-label={t("Data inicial")} type="date" value={value.from} onChange={e=>onChange({...value,from:e.target.value})}/></label><label>{t("Até")}<input aria-label={t("Data final")} type="date" min={value.from} value={value.to} onChange={e=>onChange({...value,to:e.target.value})}/></label><label>{t("Local")}<select aria-label={t("Filtrar local")} value={value.place} onChange={e=>onChange({...value,place:e.target.value})}><option value="">{t("Todos os locais")}</option>{t(places.map(p=><option key={p} value={p}>{t(p)}</option>))}</select></label><button className="text-button" onClick={()=>onChange({from:'',to:'',place:''})}>{t("Limpar filtros")}</button></div>
}
