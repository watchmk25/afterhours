import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

async function scenario(mode: string) {
  const path = new URL("../lib/club-server.ts", import.meta.url).href;
  const source = `
    import assert from 'node:assert/strict'; import {registerHooks} from 'node:module';
    registerHooks({resolve(s,c,n){return s==='server-only'?{url:'data:text/javascript,export{}',shortCircuit:true}:n(s,c)}});
    const mode=${JSON.stringify(mode)}; let stores=[],qloo=0,gemini=0,pacing=0,controller; const secret='synthetic-private-secret';
    if(mode==='extended-continuation'){
      const {mock}=await import('node:test');mock.timers.enable({apis:['Date','setTimeout'],now:1000000});mock.method(performance,'now',()=>Date.now());
    }
    console.error=()=>{}; console.info=()=>{};
    globalThis.fetch=async(input,init)=>{
      const request=new Request(input,init),url=new URL(request.url);
      if(url.origin==='https://synthetic-usage.upstash.io'){
        const command=JSON.parse(await request.text()),release=command[1].includes("redis.call('ZREM',"),pace=String(command[3]).endsWith(':gemini-rpm'); stores.push({release,pace});
        if(mode==='store-failure')throw Error(secret);
        if(release)return Response.json({result:1});
        if(pace){pacing++;return Response.json({result:mode==='pacing-continuation'&&pacing===2?[0,17]:[1]});}
        if(mode==='extended-continuation')await import('node:test').then(({mock})=>mock.timers.tick(500));
        if(mode==='limited')return Response.json({result:[0,'visitor',61]});
        return Response.json({result:[1]});
      }
      if(url.origin==='https://hackathon.api.qloo.com'){
        qloo++;
        if(mode==='pacing-continuation'||mode==='extended-continuation')return Response.json({results:{entities:[{entity_id:'DF4272D0-A6BA-445B-88DC-172A56B5D183',name:'The Guide',types:['urn:entity:book'],query:{affinity:0.6}}]}});
        return Response.json({error:secret},{status:503});
      }
      if(url.origin==='https://generativelanguage.googleapis.com'){
        gemini++;
        if(mode==='extended-continuation'){
          const {mock}=await import('node:test');mock.timers.tick(gemini===1?2500:21000);
          if(gemini>1){const text=JSON.stringify({status:'proposal',proposal:{selectedEntityId:'DF4272D0-A6BA-445B-88DC-172A56B5D183',eventTitle:'Shared reflections',formatDescription:'Offer paired conversation.',evidenceRefs:['affinity:DF4272D0-A6BA-445B-88DC-172A56B5D183'],agenda:[{title:'Conversation',minutes:45,activity:'Invite open discussion.'}],materials:['Paper'],invitation:'Join a shared conversation.'}});return Response.json({id:'controlled-final',status:'completed',steps:[{type:'model_output',content:[{type:'text',text}]}]});}
        }
        if(mode==='pacing-continuation'||mode==='extended-continuation')return Response.json({id:'controlled-call',status:'requires_action',steps:[{type:'function_call',id:'call-1',name:'discover_cultural_focus',arguments:{}}]});
        if(mode==='cancel'){
          const pending=new Promise((_r,reject)=>request.signal.addEventListener('abort',()=>reject(Error(secret)),{once:true}));queueMicrotask(()=>controller.abort());return pending;
        }
        return Response.json({error:{code:503,status:'UNAVAILABLE',message:secret}},{status:503});
      }
      throw Error('Unexpected offline transport');
    };
    const {handleClubRequest}=await import(${JSON.stringify(path)});
    const input={club:'An independent student collective',goal:'Discuss a book together',duration:45,groupSize:12,location:'',budget:null,maxPages:null,languages:[],format:'book',source:'discovery',interests:[{preset:'a',index:0}],resources:[],selected:null,mode:'generate'};
    const outcomes=[];
    for(const operation of ['pacing-continuation','cancel','extended-continuation'].includes(mode)?['plan']:['search','discover','plan']){
      stores=[];qloo=0;gemini=0;pacing=0;controller=new AbortController();
      const value=mode==='invalid'?{}:operation==='search'?{query:'Guide'}:input;
      const request=new Request('https://afterhours.example/api/club/'+operation,{method:'POST',headers:{'content-type':'application/json',origin:'https://afterhours.example','x-vercel-forwarded-for':'192.0.2.8'},body:JSON.stringify(value),signal:controller.signal});
      const response=await handleClubRequest(request,operation),body=await response.json();
      assert(!JSON.stringify(body).includes(secret));
      outcomes.push({operation,status:response.status,code:body.error?.code,usage:body.usage,qloo,gemini,stores});
    }
    process.stdout.write(JSON.stringify(outcomes));
  `;
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", VERCEL: "1", AFTERHOURS_LIVE_ENABLED: mode === "disabled" ? "false" : "true",
    AFTERHOURS_USAGE_SECRET: "synthetic-private-secret-with-thirty-two-characters", UPSTASH_REDIS_REST_URL: "https://synthetic-usage.upstash.io", UPSTASH_REDIS_REST_TOKEN: "synthetic-private-secret",
    GEMINI_API_KEY: mode === "missing" ? "" : "synthetic-private-secret", GEMINI_MODEL: "gemini-3.5-flash-lite", QLOO_API_KEY: mode === "missing" ? "" : "synthetic-private-secret",
  };
  for (const key of ["PATH", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP"]) if (process.env[key]) env[key] = process.env[key];
  const { stdout } = await promisify(execFile)(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", source], { env, timeout: 15_000, maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout) as { operation: string; status: number; code: string; qloo: number; gemini: number; usage: unknown; stores: { release: boolean; pace: boolean }[] }[];
}
for (const mode of ["disabled", "missing", "invalid", "store-failure", "limited"]) test(`new cultural routes reject ${mode} before provider dispatch`, async () => {
  const results = await scenario(mode);
  assert.equal(results.length, 3);
  for (const result of results) {
    assert.equal(result.gemini, 0); assert.equal(result.qloo, 0); assert(result.status >= 400);
    if (["disabled", "missing", "invalid"].includes(mode)) assert.equal(result.stores.length, 0);
  }
});
test("new native continuation pacing denial accounts earlier calls and releases its event lease", async () => {
  const [result] = await scenario("pacing-continuation");
  assert.equal(result.status, 429); assert.equal(result.code, "GEMINI_PACING_LIMIT");
  assert.equal(result.gemini, 1); assert.equal(result.qloo, 1);
  assert.equal(result.stores.filter((entry) => entry.release).length, 1);
  assert.equal(result.stores.filter((entry) => entry.pace).length, 2);
});
test("new plan request cancellation releases the lease and does not dispatch Qloo", async () => {
  const [result] = await scenario("cancel"); assert.equal(result.status, 499); assert.equal(result.qloo, 0); assert.equal(result.gemini, 1);
  assert.equal(result.stores.filter((entry) => entry.release).length, 1);
});

test("adaptive route explicitly enables the extended continuation after admission and releases its lease", async () => {
  const [result] = await scenario("extended-continuation");
  assert.equal(result.status, 200); assert.equal(result.gemini, 2); assert.equal(result.qloo, 1);
  assert.deepEqual(result.usage, { geminiRequests: 2, qlooRequests: 1 });
  assert.equal(result.stores.filter((entry) => entry.release).length, 1);
  assert.equal(result.stores.filter((entry) => entry.pace).length, 2);
});
