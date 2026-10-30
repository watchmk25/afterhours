import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

async function scenario(mode: "strict" | "visibility" | "dynamic") {
  const route = new URL("../app/api/preview/switch-status/route.ts", import.meta.url).href;
  const gate = new URL("../lib/usage-runtime.ts", import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import {registerHooks} from 'node:module';
    globalThis.connections=0;
    registerHooks({resolve(specifier,context,nextResolve){
      if(specifier==='server-only')return {url:'data:text/javascript,export{}',shortCircuit:true};
      if(specifier==='next/server')return {url:'data:text/javascript,export async function connection(){globalThis.connections++}',shortCircuit:true};
      return nextResolve(specifier,context);
    }});
    let requests=0;
    globalThis.fetch=async()=>{requests++;throw Error('Offline check prohibits all network dispatch.');};
    const {GET}=await import(${JSON.stringify(route)});
    const {admitRequestUsage}=await import(${JSON.stringify(gate)});
    const mode=${JSON.stringify(mode)};
    const source='1234567890abcdef1234567890abcdef12345678';
    const request=new Request('https://afterhours.example/api/club/plan');
    let checks=0;
    async function status(){
      const before=globalThis.connections;
      const response=await GET();
      assert.equal(globalThis.connections,before+1);
      for(const name of ['cache-control','cdn-cache-control','vercel-cdn-cache-control'])assert(response.headers.get(name).includes('no-store'));
      assert.equal(response.headers.get('x-content-type-options'),'nosniff');
      checks++;return response;
    }
    process.env.VERCEL_ENV='preview';process.env.VERCEL_GIT_COMMIT_SHA=source;
    if(mode==='strict'){
      for(const value of [undefined,'','false','TRUE','1','true ',' true','true\\n','"true"']){
        if(value===undefined)delete process.env.AFTERHOURS_LIVE_ENABLED;else process.env.AFTERHOURS_LIVE_ENABLED=value;
        const response=await status();assert.equal(response.status,200);
        assert.deepEqual(await response.json(),{liveEnabled:false,sourceCommit:source});
        const admission=await admitRequestUsage(request,'event');
        assert(!admission.ok);assert.equal(admission.error.code,'LIVE_DISABLED');
      }
      process.env.AFTERHOURS_LIVE_ENABLED='true';
      assert.deepEqual(await (await status()).json(),{liveEnabled:true,sourceCommit:source});
      // A true switch is not provider/store readiness: missing trusted runtime identity still rejects.
      const admission=await admitRequestUsage(request,'event');assert(!admission.ok);assert.equal(admission.error.code,'USAGE_UNAVAILABLE');
    }
    if(mode==='visibility'){
      process.env.AFTERHOURS_LIVE_ENABLED='true';
      for(const value of [undefined,'production','development','Preview']){
        if(value===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=value;
        const response=await status();assert.equal(response.status,404);assert.equal(await response.text(),'');
      }
      process.env.VERCEL_ENV='preview';
      for(const value of [undefined,'synthetic-private-source-not-a-sha','a'.repeat(41)]){
        if(value===undefined)delete process.env.VERCEL_GIT_COMMIT_SHA;else process.env.VERCEL_GIT_COMMIT_SHA=value;
        assert.deepEqual(await (await status()).json(),{liveEnabled:true});
      }
    }
    if(mode==='dynamic'){
      for(const value of ['false','true','false']){
        process.env.AFTERHOURS_LIVE_ENABLED=value;
        const body=await (await status()).json();assert.deepEqual(body,{liveEnabled:value==='true',sourceCommit:source});
        for(const key of ['GEMINI_API_KEY','QLOO_API_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','AFTERHOURS_USAGE_SECRET'])assert(!JSON.stringify(body).includes(process.env[key]));
      }
    }
    assert.equal(requests,0);console.log(JSON.stringify({checks,requests}));
  `;
  const { stdout } = await promisify(execFile)(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
    env: {
      NODE_ENV: "test", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
      GEMINI_API_KEY: "synthetic-private-gemini", QLOO_API_KEY: "synthetic-private-qloo",
      UPSTASH_REDIS_REST_URL: "https://synthetic-private-store.example", UPSTASH_REDIS_REST_TOKEN: "synthetic-private-store",
      AFTERHOURS_USAGE_SECRET: "synthetic-private-visitor-secret-32-bytes",
    }, timeout: 15_000, windowsHide: true,
  });
  return JSON.parse(stdout) as { checks: number; requests: number };
}

test("Preview status and actual admission gate share strict fail-closed evaluation without dispatch", async () => {
  assert.deepEqual(await scenario("strict"), { checks: 10, requests: 0 });
});

test("switch diagnostic is Preview-only and returns only boolean and valid public source SHA", async () => {
  assert.deepEqual(await scenario("visibility"), { checks: 7, requests: 0 });
});

test("uncached switch status evaluates every request and never exposes synthetic credentials", async () => {
  assert.deepEqual(await scenario("dynamic"), { checks: 3, requests: 0 });
});
