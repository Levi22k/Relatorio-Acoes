import {t,useLanguage,getLocale} from './i18n';
import {useEffect,useState} from 'react';
declare const __APP_VERSION__:string;
export default function UpdateNotice(){useLanguage();
 const [available,setAvailable]=useState(false);
 useEffect(()=>{let active=true;async function check(){try{const r=await fetch(import.meta.env.BASE_URL+'version.json',{cache:'no-store'});if(r.ok){const data=await r.json();if(active&&data.version!==__APP_VERSION__)setAvailable(true)}}catch{/* Stay usable offline. */}}
 const id=setInterval(check,60000);window.addEventListener('focus',check);check();return()=>{active=false;clearInterval(id);window.removeEventListener('focus',check)}},[]);
 return available?<div className="notice" role="status">{t("Uma atualização está disponível. Conclua ou cancele o formulário aberto antes de atualizar. ")}<button className="secondary" onClick={()=>{if(!document.querySelector('[role="dialog"]'))window.location.reload();else alert('Conclua ou cancele o formulário antes de atualizar.')}}>{t("Atualizar site")}</button></div>:null;
}
