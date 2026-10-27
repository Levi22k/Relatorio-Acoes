export async function authenticateAccount(action:'login'|'recovery',login:string,password?:string){
 const url=(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
 const response=await fetch(url+'/functions/v1/account-auth',{method:'POST',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_ANON_KEY||''},body:JSON.stringify({action,login,...(password!==undefined?{password}:{})})});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível entrar. Tente novamente.');return data;
}
