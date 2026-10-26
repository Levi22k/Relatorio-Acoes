import LanguageSelector from './app/language-selector';
import {t,useLanguage} from './app/i18n';
import AccessGate from './app/access';
import React from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from './app/dashboard';
import {configured} from './app/api';
import './app/globals.css';import './app/visual.css';
function App(){useLanguage();return <><LanguageSelector/>{configured?<AccessGate><Dashboard/></AccessGate>:<div style={{maxWidth:650,margin:'80px auto',padding:24}}><h1>{t('Configure o banco do bando')}</h1><p style={{marginTop:20}}>{t('Cadastre VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis do repositório e publique novamente. O passo a passo está no arquivo LEIA-ME.md.')}</p></div>}</>}
createRoot(document.getElementById('root')!).render(<App/>);
