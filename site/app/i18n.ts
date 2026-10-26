import {useSyncExternalStore} from 'react';
import translations from './translations.json';
export type Language='pt-BR'|'en-US';
const key='caderno-language';
let language:Language='pt-BR';
try{if(typeof localStorage!=='undefined'&&localStorage.getItem(key)==='en-US')language='en-US'}catch{}
const listeners=new Set<()=>void>();
export const getLocale=()=>language;
export function setLanguage(next:Language){language=next;try{localStorage.setItem(key,next)}catch{};if(typeof document!=='undefined'){document.documentElement.lang=next;document.title=next==='en-US'?'Gang Action Log':'Caderno de Ações'}listeners.forEach(f=>f());}
export function useLanguage(){return useSyncExternalStore(f=>{listeners.add(f);return()=>{listeners.delete(f)}},getLocale,()=> 'pt-BR' as Language)}
if(typeof window!=='undefined'){window.addEventListener('storage',e=>{if(e.key===key)setLanguage(e.newValue==='en-US'?'en-US':'pt-BR')});document.documentElement.lang=language;document.title=language==='en-US'?'Gang Action Log':'Caderno de Ações';}
const dictionary:Record<string,string>=translations;
const patterns=Object.entries(dictionary).filter(([k])=>k.includes('{0}')).sort(([a],[b])=>b.replace(/\{\d+\}/g,'').length-a.replace(/\{\d+\}/g,'').length).map(([key,value])=>({regex:new RegExp('^'+key.split(/(\{\d+\})/).map(p=>/^\{\d+\}$/.test(p)?'(.+?)':p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('')+'$'),value}));
export function t<T>(value:T):T{
 if(language!=='en-US'||typeof value!=='string')return value;
 const text=value.trim();let result=dictionary[text];
 if(result===undefined){for(const p of patterns){const match=text.match(p.regex);if(match){result=p.value.replace(/\{(\d+)\}/g,(_,n)=>match[Number(n)+1]);break}}}
 return (result===undefined?value:value.replace(text,()=>result!)) as T;
}
