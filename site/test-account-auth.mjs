import fs from 'node:fs/promises';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const source=(await fs.readFile(new URL('./supabase/functions/account-auth/index.ts',import.meta.url),'utf8')).replace(/^import .*\n/,'');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;let handler,state,calls;
const service={rpc:async()=>({data:state.exists?'private@example.test':null,error:state.lookupError?{}:null})};
const client={auth:{signInWithPassword:async(data)=>{calls.push(['login',data]);return state.badPassword?{error:{},data:{}}:{data:{session:{access_token:'test-access',refresh_token:'test-refresh',user:{email:'must-not-return@example.test'}}}}},resetPasswordForEmail:async(email,options)=>{calls.push(['recovery',email,options]);return {}}}};
vm.runInNewContext(js,{Request,Response,JSON,Deno:{env:{get:n=>n==='SUPABASE_SERVICE_ROLE_KEY'?'service':'public'},serve:f=>handler=f},createClient:(url,key)=>key==='service'?service:client});
async function run(overrides={},body={action:'login',login:'manager',password:'test-only'}){state={exists:true,...overrides};calls=[];return handler(new Request('https://example.test',{method:'POST',body:JSON.stringify(body)}));}
let response=await run();assert.equal(response.status,200);assert.deepEqual(await response.json(),{access_token:'test-access',refresh_token:'test-refresh'});assert.equal(calls[0][1].email,'private@example.test');
assert.equal((await run({badPassword:true})).status,401);assert.equal((await run({exists:false})).status,401);assert.equal((await run({lookupError:true})).status,503);
assert.equal((await run({}, {action:'login',login:'manager',password:''})).status,400);assert.equal(calls.length,0);
for(const exists of [true,false]){const response=await run({exists},{action:'recovery',login:'manager',redirectTo:'https://attacker.invalid'});assert.deepEqual(await response.json(),{ok:true});if(exists)assert.equal(calls[0][2].redirectTo,'https://levi22k.github.io/Relatorio-Acoes/');else assert.equal(calls.length,0)}
console.log('PASS: username sign-in returns tokens only, invalid credentials denied, generic recovery result and fixed recovery destination.');
