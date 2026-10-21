import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

// Each child receives only synthetic configuration. Its global fetch is replaced
// before importing the actual server handlers; no real network path is available.
async function scenario(mode: string) {
  const qlooUrl = new URL("../lib/qloo-server.ts", import.meta.url).href;
  const eventUrl = new URL("../lib/event-server.ts", import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import {registerHooks} from 'node:module';
    registerHooks({resolve(specifier,context,nextResolve){
      if(specifier==='server-only')return {url:'data:text/javascript,export{}',shortCircuit:true};
      return nextResolve(specifier,context);
    }});
    const mode=${JSON.stringify(mode)};
    const logs=[];
    console.error=(...values)=>logs.push(values.join(' '));
    console.info=(...values)=>logs.push(values.join(' '));
    let storeCalls=[],qlooCalls=0,geminiCalls=0,unexpectedCalls=0,controller;
    globalThis.fetch=async(input,init)=>{
      const request=new Request(input,init);
      const url=new URL(request.url);
      if(url.origin==='https://synthetic-usage.upstash.io'){
        const command=JSON.parse(await request.text());
        assert.equal(command[0],'EVAL');
        const release=command[1].includes("redis.call('ZREM',");
        storeCalls.push({release,command});
        if(mode==='store-failure')throw new Error('synthetic-private-store-token must remain hidden');
        if(release)return Response.json({result:1});
        if(mode==='limited')return Response.json({result:[0,'visitor',61]});
        if(mode==='busy')return Response.json({result:[0,'busy',9]});
        return Response.json({result:[1]});
      }
      if(url.origin==='https://hackathon.api.qloo.com'){
        qlooCalls++;
        assert(['/search','/v2/insights'].includes(url.pathname));
        return Response.json({error:'synthetic-private-qloo-key must remain hidden'},{status:503});
      }
      if(url.origin==='https://generativelanguage.googleapis.com'){
        geminiCalls++;
        assert.equal(url.pathname,'/v1beta/interactions');
        if(mode==='cancel-event'){
          const pending=new Promise((_resolve,reject)=>{
            const stop=()=>reject(new DOMException('Synthetic cancellation','AbortError'));
            if(request.signal.aborted)stop();else request.signal.addEventListener('abort',stop,{once:true});
          });
          queueMicrotask(()=>controller.abort());
          return pending;
        }
        return Response.json({error:{code:503,status:'UNAVAILABLE',message:'Synthetic provider unavailable'}},{status:503});
      }
      unexpectedCalls++;
      throw new Error('Unexpected offline request');
    };
    const {handleQlooRequest}=await import(${JSON.stringify(qlooUrl)});
    const {handleEventRequest}=await import(${JSON.stringify(eventUrl)});
    const filters={maxPrice:'450',maxPages:'300',languages:['English']};
    const rank={catalogueSource:'sample',filters,interests:[{preset:'a',index:0},{preset:'a',index:1}]};
    const event={...rank,request:'Plan a welcoming interactive book event.',duration:45,mode:'generate'};
    const operations=mode==='cancel-event'?['event']:['search','rank','event'];
    const results=[];
    for(const operation of operations){
      storeCalls=[];qlooCalls=0;geminiCalls=0;unexpectedCalls=0;
      controller=new AbortController();
      let body=operation==='search'?{query:'Synthetic film',kind:'movie'}:operation==='rank'?rank:event;
      if(mode==='invalid')body={invalid:true};
      const request=new Request('https://afterhours.example/api/'+operation,{
        method:'POST',headers:{'content-type':'application/json','origin':'https://afterhours.example','x-vercel-forwarded-for':'192.0.2.7'},
        body:JSON.stringify(body),signal:controller.signal,
      });
      const response=operation==='event'?await handleEventRequest(request):await handleQlooRequest(request,operation);
      const result=await response.json();
      const safe={operation,status:response.status,retryAfter:response.headers.get('retry-after'),body:result,
        storeCalls:storeCalls.map(call=>({release:call.release,operation:call.release?null:call.command[6],
          qlooReservation:call.release?null:call.command.at(-2),geminiReservation:call.release?null:call.command.at(-1)})),qlooCalls,geminiCalls,unexpectedCalls};
      assert.equal(unexpectedCalls,0);
      const serialized=JSON.stringify({safe,logs});
      for(const secret of ['synthetic-private-qloo-key','synthetic-private-gemini-key','synthetic-private-store-token','synthetic-private-visitor-secret-with-more-than-32-characters'])assert(!serialized.includes(secret));
      results.push(safe);
    }
    process.stdout.write(JSON.stringify(results));
  `;
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test", VERCEL: "1", AFTERHOURS_LIVE_ENABLED: mode === "disabled" ? "false" : "true",
    AFTERHOURS_USAGE_SECRET: "synthetic-private-visitor-secret-with-more-than-32-characters",
    UPSTASH_REDIS_REST_URL: "https://synthetic-usage.upstash.io", UPSTASH_REDIS_REST_TOKEN: "synthetic-private-store-token",
    GEMINI_API_KEY: "synthetic-private-gemini-key", GEMINI_MODEL: "gemini-3.5-flash-lite", QLOO_API_KEY: "synthetic-private-qloo-key",
  };
  if (mode === "missing-store") delete env.UPSTASH_REDIS_REST_TOKEN;
  if (mode === "missing-provider") { delete env.QLOO_API_KEY; delete env.GEMINI_API_KEY; }
  const child = await promisify(execFile)(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
    env, timeout: 15_000, maxBuffer: 128 * 1024,
  });
  return JSON.parse(child.stdout) as {
    operation: "search" | "rank" | "event"; status: number; retryAfter: string | null;
    body: { ok: boolean; error?: { code: string; upstreamStatus?: number }; usage?: null | { geminiRequests: number; qlooRequests: number } };
    storeCalls: { release: boolean; operation: string | null; qlooReservation: number | null; geminiReservation: number | null }[];
    qlooCalls: number; geminiCalls: number; unexpectedCalls: number;
  }[];
}

for (const [mode, code, status, retry] of [
  ["disabled", "LIVE_DISABLED", 503, null], ["missing-store", "USAGE_UNAVAILABLE", 503, null],
  ["store-failure", "USAGE_UNAVAILABLE", 503, null], ["limited", "USAGE_LIMITED", 429, "61"],
  ["busy", "USAGE_BUSY", 429, "9"],
] as const) {
  test(`actual search, ranking and event handlers reject ${mode} before provider dispatch`, async () => {
    const results = await scenario(mode);
    assert.equal(results.length, 3);
    for (const result of results) {
      assert.equal(result.status, status, result.operation);
      assert.equal(result.body.ok, false);
      assert.equal(result.body.error?.code, code);
      assert.equal(result.retryAfter, retry);
      assert.equal(result.geminiCalls + result.qlooCalls, 0);
      assert.equal(result.unexpectedCalls, 0);
      if (mode === "disabled" || mode === "missing-store") assert.equal(result.storeCalls.length, 0);
      else assert.equal(result.storeCalls.filter((call) => !call.release).length, 1);
      if (result.operation === "event") assert.deepEqual(result.body.usage, { geminiRequests: 0, qlooRequests: 0 });
    }
  });
}

test("actual handlers reject invalid inputs and missing provider configuration without Redis or providers", async () => {
  for (const mode of ["invalid", "missing-provider"]) {
    const results = await scenario(mode);
    for (const result of results) {
      assert.equal(result.status, mode === "invalid" ? 400 : 503);
      assert.equal(result.body.ok, false);
      assert.equal(result.storeCalls.length, 0);
      assert.equal(result.qlooCalls + result.geminiCalls, 0);
    }
  }
});

test("actual admitted handlers dispatch once and failed event generation cleans its reserved lease", async () => {
  const results = await scenario("accepted");
  for (const result of results) {
    assert.equal(result.body.ok, false, "controlled provider failure is not replaced by a success");
    const admissions = result.storeCalls.filter((call) => !call.release);
    assert.equal(admissions.length, 1);
    assert.equal(admissions[0].operation, result.operation);
    assert.equal(admissions[0].qlooReservation, 1);
    if (result.operation === "event") {
      assert.equal(result.status, 502);
      assert.equal(result.body.error?.upstreamStatus, 503);
      assert.equal(result.body.error?.code, "GEMINI_TRANSPORT");
      assert.equal(admissions[0].geminiReservation, 3);
      assert.equal(result.geminiCalls, 1);
      assert.equal(result.qlooCalls, 0);
      assert.equal(result.storeCalls.filter((call) => call.release).length, 1);
      assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 0 });
    } else {
      assert.equal(result.status, 502);
      assert.equal(result.body.error?.upstreamStatus, 503);
      assert.equal(admissions[0].geminiReservation, 0);
      assert.equal(result.qlooCalls, 1);
      assert.equal(result.geminiCalls, 0);
      assert.equal(result.storeCalls.filter((call) => call.release).length, 0);
    }
  }
});

test("actual in-flight cancelled event releases its lease without falsely reporting zero provider usage", async () => {
  const [result] = await scenario("cancel-event");
  assert.equal(result.status, 499);
  assert.equal(result.body.error?.code, "REQUEST_CANCELLED");
  assert.equal(result.body.usage, null);
  assert.equal(result.geminiCalls, 1);
  assert.equal(result.qlooCalls, 0);
  assert.equal(result.storeCalls.filter((call) => call.release).length, 1);
});
