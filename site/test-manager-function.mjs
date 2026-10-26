import fs from 'node:fs/promises';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const source=(await fs.readFile(new URL('./supabase/functions/create-manager/index.ts',import.meta.url),'utf8')).replace(/^import .*\n/,'');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
let handler,state,calls;
const service={auth:{getUser:async()=>state.auth?{data:{user:{id:'actor'}}}:{data:{user:null},error:{}},admin:{createUser:async(data)=>{calls.push(['create',data]);return state.createError?{error:{}}:{data:{user:{id:'new-user'}}}},deleteUser:async(id)=>{calls.push(['delete',id]);return {}}}},rpc:async(name,data)=>{calls.push([name,data]);return {error:state.bindError?{}:null}}};
const caller={rpc:async(name)=>name==='caderno_is_admin'?{data:state.allowed}: {data:state.exists,error:state.lookupError?{}:null}};
vm.runInNewContext(js,{Request,Response,JSON,Deno:{env:{get:(name)=>name==='SUPABASE_SERVICE_ROLE_KEY'?'service':'public'},serve:fn=>handler=fn},createClient:(url,key)=>key==='service'?service:caller});
const valid={login:'Gerente',email:'gerente@example.test',password:'test-only-password'};
async function run(overrides={},body=valid,token='token',method='POST'){state={auth:true,allowed:true,...overrides};calls=[];return handler(new Request('https://example.test',{method,headers:token?{Authorization:'Bearer '+token}:{},body:method==='POST'?JSON.stringify(body):undefined}));}
assert.equal((await run({},valid,'')).status,401);assert.equal(calls.length,0);
assert.equal((await run({auth:false})).status,401);assert.equal(calls.length,0);
assert.equal((await run({allowed:false})).status,403);assert.equal(calls.length,0);
assert.equal((await run({}, {...valid,password:'short'})).status,400);
assert.equal((await run({exists:'already@example.test'})).status,409);assert.equal(calls.length,0);
assert.equal((await run({createError:true})).status,400);assert.equal(calls.length,1);
assert.equal((await run({bindError:true})).status,409);assert.deepEqual(calls.at(-1),['delete','new-user']);
assert.equal((await run()).status,201);assert.equal(calls[0][1].email_confirm,true);assert.equal(calls[1][1].actor,'actor');assert.equal(calls[1][1].username,'gerente');
assert.equal((await run({},valid,'token','OPTIONS')).status,204);assert.equal(calls.length,0);
console.log('PASS: function rejects missing/invalid/guest sessions, malformed inputs, duplicates; creates Auth account and binds verified actor; compensates failed binding.');
