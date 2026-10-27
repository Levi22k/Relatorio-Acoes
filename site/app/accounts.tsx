import {t,useLanguage} from './i18n';
import {useEffect,useState} from 'react';
import {rpc,createLogin} from './api';
type Account={login:string;email:string|null;owner:boolean;self:boolean;active:boolean;canManage:boolean};
export default function Accounts(){
 useLanguage();
 const [accounts,setAccounts]=useState<Account[]>([]),[login,setLogin]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[selected,setSelected]=useState<Account|null>(null);
 const supreme=accounts.some(a=>a.canManage),[showRemoved,setShowRemoved]=useState(false);
 async function refresh(){try{setAccounts(await rpc('accounts.list'))}catch(e:any){setError(e.message)}}
 useEffect(()=>{void refresh()},[]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{await createLogin({login:login.trim(),email:email.trim(),password});setLogin('');setEmail('');setPassword('');setMessage('Login criado. A pessoa já pode entrar com a senha definida.');await refresh()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function changeAccess(){if(!selected)return;setBusy(true);setError('');setMessage('');try{await rpc(selected.active?'accounts.remove':'accounts.restore',{login:selected.login});setMessage(selected.active?'Acesso administrativo removido. Os registros do bando foram preservados.':'Acesso administrativo restaurado.');setSelected(null);await refresh()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <section className="members accounts-panel">
  <div className="treasury-rule"><div><h2>{t('Um acesso para cada administrador.')}</h2><p>{t('Os novos administradores podem gerenciar o caderno e criar logins. Somente o administrador supremo pode remover acessos e visualizar os e-mails de outras contas.')}</p></div></div>
  <form className="account-create-form" onSubmit={save}>
   <h2>{t('Criar login')}</h2>
   <label htmlFor="account-login">{t('Login')}</label><input id="account-login" aria-describedby="account-login-help" required pattern="[a-zA-Z0-9_.-]{3,32}" minLength={3} maxLength={32} autoComplete="off" value={login} onChange={e=>setLogin(e.target.value)} placeholder={t('Ex.: gerente')}/>
   <small id="account-login-help">{t('De 3 a 32 letras, números, ponto, traço ou sublinhado.')}</small>
   <label htmlFor="account-email">{t('E-mail para recuperação')}</label><input id="account-email" required type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)}/>
   <label htmlFor="account-password">{t('Senha inicial')}</label><input id="account-password" aria-describedby="account-password-help" required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/>
   <small id="account-password-help">{t('Mínimo de 8 caracteres. A senha não aparece na lista nem é salva no código do site.')}</small>
   <button className="primary" disabled={busy}>{t(busy?'Criando…':'Criar administrador')}</button>
  </form>
  {error&&<p className="error" role="alert">{t(error)}</p>}{message&&<p className="account-feedback" role="status">{t(message)}</p>}
  <div className="section-heading"><h2>{t('Logins administrativos')}</h2>{supreme&&<label className="account-removed-filter"><input type="checkbox" checked={showRemoved} onChange={e=>setShowRemoved(e.target.checked)}/>{t('Mostrar acessos removidos')}</label>}</div>
  <p className="member-footnote">{t('Seu e-mail fica visível somente para você e para o administrador supremo.')}</p>
  <div className="table-scroll"><table><thead><tr><th>{t('LOGIN')}</th><th>{t('E-MAIL')}</th><th>{t('ACESSO')}</th>{supreme&&<th>{t('CONTROLE')}</th>}</tr></thead><tbody>{accounts.filter(a=>a.active||showRemoved).map(a=><tr key={a.login}><td>{a.login}{a.self&&<small className="account-self">{t('Sua conta')}</small>}</td><td>{a.email||t('Privado')}</td><td>{t(!a.active?'Acesso removido':a.owner?'Administrador supremo':'Administrador')}</td>{supreme&&<td>{!a.owner&&!a.self&&<button className="secondary" disabled={busy} onClick={()=>{setError('');setSelected(a)}}>{t(a.active?'Remover acesso':'Restaurar acesso')}</button>}</td>}</tr>)}</tbody></table></div>
  {selected&&<div className="overlay"><section className="modal account-confirm" role="dialog" aria-modal="true" aria-labelledby="account-confirm-title"><div className="modal-head"><h2 id="account-confirm-title">{t(selected.active?'Remover acesso administrativo?':'Restaurar acesso administrativo?')}</h2></div><div className="account-confirm-body"><strong>{selected.login}</strong><p>{t(selected.active?'Este usuário perderá as permissões administrativas. Ações, membros e saldos serão preservados. Você poderá restaurar o acesso nesta aba.':'Este usuário voltará a ter permissões administrativas.')}</p>{error&&<p role="alert" className="error">{t(error)}</p>}</div><div className="modal-footer"><button className="secondary" disabled={busy} onClick={()=>setSelected(null)}>{t('Cancelar')}</button><button className={selected.active?'danger':'primary'} disabled={busy} onClick={changeAccess}>{t(busy?'Aguarde…':selected.active?'Confirmar remoção':'Restaurar acesso')}</button></div></section></div>}
 </section>;
}
