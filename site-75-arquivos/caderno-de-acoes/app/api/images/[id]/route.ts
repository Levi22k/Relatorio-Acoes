import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
 const user=await getChatGPTUser();if(!user)return new Response('Não autorizado',{status:401});
 const {id}=await context.params;
 const row=await env.DB!.prepare('SELECT image_key FROM actions WHERE id=? AND owner=?').bind(id,user.userId).first<any>();
 if(!row)return new Response('Não encontrado',{status:404});
 const obj=await env.BUCKET!.get(row.image_key);if(!obj)return new Response('Não encontrado',{status:404});
 return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
