import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const headers={'Access-Control-Allow-Origin':'https://levi22k.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Método inválido.'});
 try{
  const raw=await req.text();if(raw.length>4096)return reply(400,{error:'Dados inválidos.'});
  const body=JSON.parse(raw),login=String(body.login||'').trim().toLowerCase();
  if(!['login','recovery'].includes(body.action)||!/^[-a-z0-9_.]{3,32}$/.test(login))return reply(400,{error:'Login ou senha inválidos.'});
  if(body.action==='login'&&(typeof body.password!=='string'||!body.password||body.password.length>128))return reply(400,{error:'Login ou senha inválidos.'});
  const url=Deno.env.get('SUPABASE_URL')!;
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:email,error:lookupError}=await admin.rpc('caderno_login_email',{login});
  if(lookupError)return reply(503,{error:'Não foi possível acessar o banco.'});
  if(body.action==='recovery'){
   if(email)await client.auth.resetPasswordForEmail(email,{redirectTo:'https://levi22k.github.io/Relatorio-Acoes/'});
   return reply(200,{ok:true});
  }
  // Auth applies password verification and rate limits; never return another account's email.
  const {data,error}=await client.auth.signInWithPassword({email:email||'unregistered@invalid.example',password:body.password});
  if(!email||error||!data.session)return reply(401,{error:'Login ou senha inválidos.'});
  return reply(200,{access_token:data.session.access_token,refresh_token:data.session.refresh_token});
 }catch{return reply(400,{error:'Não foi possível entrar. Tente novamente.'});}
});
