import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const headers={'Access-Control-Allow-Origin':'https://levi22k.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Método inválido.'});
 try{
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)return reply(401,{error:'Entre como administrador.'});
  const {data:user,error:authError}=await admin.auth.getUser(token);
  if(authError||!user.user)return reply(401,{error:'Sessão inválida. Entre novamente.'});
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:allowed,error:roleError}=await caller.rpc('caderno_is_admin');
  if(roleError||allowed!==true)return reply(403,{error:'Somente administradores podem criar logins.'});
  const raw=await req.text();if(raw.length>4096)return reply(400,{error:'Dados inválidos.'});
  const body=JSON.parse(raw),login=String(body.login||'').trim().toLowerCase(),email=String(body.email||'').trim().toLowerCase(),password=body.password;
  if(!/^[a-z0-9_.-]{3,32}$/.test(login)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<8||password.length>128)return reply(400,{error:'Confira o login, o e-mail e a senha (mínimo de 8 caracteres).'});
  const {data:existing,error:lookupError}=await caller.rpc('caderno_login_email',{login});
  if(lookupError)return reply(503,{error:'Não foi possível conferir o login. Tente novamente.'});
  if(existing)return reply(409,{error:'Este login já existe. Escolha outro.'});
  const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(createError||!created.user)return reply(400,{error:'Não foi possível criar a conta. Confira se o e-mail já está cadastrado e se a senha atende às regras.'});
  const {error:bindError}=await admin.rpc('caderno_bind_manager',{actor:user.user.id,username:login,new_user:created.user.id});
  if(bindError){
   await admin.auth.admin.deleteUser(created.user.id);
   return reply(409,{error:'Não foi possível vincular o login. Atualize a lista e tente novamente.'});
  }
  return reply(201,{ok:true});
 }catch{return reply(400,{error:'Não foi possível criar o login. Confira os dados e tente novamente.'});}
});
