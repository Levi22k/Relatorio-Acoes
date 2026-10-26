import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL||'';
const key=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
const storageKey='caderno-auth-v1',rememberKey='caderno-remember-access';
const storage={
 getItem:(key:string)=>(localStorage.getItem(rememberKey)==='1'?localStorage:sessionStorage).getItem(key),
 setItem:(key:string,value:string)=>(localStorage.getItem(rememberKey)==='1'?localStorage:sessionStorage).setItem(key,value),
 removeItem:(key:string)=>{localStorage.removeItem(key);sessionStorage.removeItem(key)},
};
export const authClient=url&&key?createClient(url,key,{auth:{storage,storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export function rememberAccess(remember:boolean){
 localStorage.removeItem(storageKey);sessionStorage.removeItem(storageKey);
 if(remember)localStorage.setItem(rememberKey,'1');else localStorage.removeItem(rememberKey);
}
export async function accessToken(){
 const {data,error}=await authClient!.auth.getSession();
 if(error)throw new Error('Sua sessão expirou. Entre novamente.');
 return data.session?.access_token;
}
