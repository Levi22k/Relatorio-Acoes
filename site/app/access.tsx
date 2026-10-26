import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {Session} from '@supabase/supabase-js';
import {authClient,rememberAccess} from './auth-client';
import {LockKeyhole,LoaderCircle} from 'lucide-react';
const Access=createContext({admin:false,exit:async()=>{}});
export const useAccess=()=>useContext(Access);
export default function AccessGate({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null),[checking,setChecking]=useState(true),[admin,setAdmin]=useState(false),[guest,setGuest]=useState(false);
 const [login,setLogin]=useState(''),[password,setPassword]=useState(''),[remember,setRemember]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[recovery,setRecovery]=useState(false);
 useEffect(()=>{
  let alive=true;
  authClient!.auth.getSession().then(({data,error})=>{if(alive){setSession(data.session);if(error)setError('Entre novamente para continuar.');if(!data.session)setChecking(false)}});
  const {data}=authClient!.auth.onAuthStateChange((event,next)=>{setSession(next);if(event!=='TOKEN_REFRESHED'){setAdmin(false);setChecking(!!next)}if(event==='PASSWORD_RECOVERY')setRecovery(true)});
  return()=>{alive=false;data.subscription.unsubscribe()};
 },[]);
 useEffect(()=>{let alive=true;if(session){authClient!.rpc('caderno_is_admin').then(({data,error})=>{if(alive){setAdmin(!error&&data===true);setChecking(false);if(error||data!==true)setError('Esta conta não tem acesso de administrador.')}})}return()=>{alive=false}},[session]);
 async function emailForLogin(){
  const {data,error}=await authClient!.rpc('caderno_login_email',{login:login.trim()});
  if(error||!data)throw new Error('Login ou senha inválidos.');return String(data);
 }
 async function enter(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{
  const email=await emailForLogin();rememberAccess(remember);
  const {error}=await authClient!.auth.signInWithPassword({email,password});
  if(error)throw new Error('Login ou senha inválidos.');setPassword('');setGuest(false);
 }catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function exit(){await authClient!.auth.signOut({scope:'local'});rememberAccess(false);setSession(null);setAdmin(false);setGuest(false);setRecovery(false);setError('');setPassword('');setChecking(false)}
 async function enterGuest(){setBusy(true);try{await exit();setGuest(true)}finally{setBusy(false)}}
 async function reset(){setBusy(true);setError('');setMessage('');try{const email=await emailForLogin();const {error}=await authClient!.auth.resetPasswordForEmail(email,{redirectTo:location.origin+import.meta.env.BASE_URL});if(error)throw error;setMessage('Confira o e-mail de recuperação cadastrado.')}catch{setError('Não foi possível enviar a recuperação. Confira o login e tente novamente.')}finally{setBusy(false)}}
 async function changePassword(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const {error}=await authClient!.auth.updateUser({password});if(error)throw error;await exit();setMessage('Senha alterada. Entre novamente.')}catch{setError('Não foi possível alterar a senha. Use pelo menos 8 caracteres e tente novamente.')}finally{setBusy(false)}}
 if(checking)return <main className="login-page"><LoaderCircle className="spin"/><p>Conferindo acesso…</p></main>;
 if((admin||guest)&&!recovery)return <Access.Provider value={{admin,exit}}>{children}</Access.Provider>;
 return <main className="login-page"><section className="login-card"><LockKeyhole size={30}/><div className="eyebrow">CADERNO DE AÇÕES</div><h1>{recovery?'Nova senha':'Bem-vindo ao bando'}</h1><p>{recovery?'Defina sua nova senha de administrador.':'Entre como administrador ou registre ações como convidado.'}</p>
 <form onSubmit={recovery?changePassword:enter}>
 {!recovery&&<label>Login<input required autoComplete="username" value={login} onChange={e=>setLogin(e.target.value)} placeholder="Seu login"/></label>}
 <label>{recovery?'Nova senha':'Senha'}<input required type="password" minLength={recovery?8:undefined} autoComplete={recovery?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
 {!recovery&&<label className="login-remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Lembrar meu acesso</label>}
 {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 <button className="primary" disabled={busy}>{busy?'Aguarde…':recovery?'Salvar nova senha':'Entrar'}</button></form>
 {!recovery&&<><button className="text-button" disabled={busy||!login.trim()} onClick={reset}>Esqueci minha senha</button><div className="login-divider">ou</div><button className="secondary" disabled={busy} onClick={enterGuest}>Entrar como convidado</button><small>Convidados podem registrar ações e adicionar membros. Alterações e exclusões ficam com o administrador.</small></>}
 </section></main>;
}
