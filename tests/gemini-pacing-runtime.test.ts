import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

async function runtimeScenario(mode: "invalid" | "deadlines") {
  const moduleUrl = new URL("../lib/usage-runtime.ts", import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import {registerHooks} from 'node:module';
    registerHooks({resolve(specifier,context,nextResolve){
      if(specifier==='server-only')return {url:'data:text/javascript,export{}',shortCircuit:true};
      return nextResolve(specifier,context);
    }});
    let dispatches=0;
    globalThis.fetch=async()=>{dispatches++;return new Promise(()=>{});};
    const {admitGeminiRequest}=await import(${JSON.stringify(moduleUrl)});
    const results=[];
    if(${JSON.stringify(mode)}==='invalid'){
      for(const remaining of [0,0.5,-1,NaN,Infinity]){
        const result=await admitGeminiRequest(new AbortController().signal,remaining);
        assert(!result.ok&&result.error.code==='USAGE_UNAVAILABLE');results.push(result);
      }
      const cancelled=new AbortController();cancelled.abort();
      const result=await admitGeminiRequest(cancelled.signal,1000);
      assert(!result.ok&&result.error.code==='REQUEST_CANCELLED');results.push(result);
      assert.equal(dispatches,0);
    }else{
      const originalTimeout=globalThis.setTimeout;
      const deadlines=[];
      globalThis.setTimeout=(callback,delay,...args)=>{deadlines.push(delay);return originalTimeout(callback,Math.min(delay,5),...args);};
      for(const remaining of [15.9,100000]){
        const result=await admitGeminiRequest(new AbortController().signal,remaining);
        assert(!result.ok&&result.error.code==='USAGE_UNAVAILABLE');results.push(result);
      }
      globalThis.setTimeout=originalTimeout;
      assert.deepEqual(deadlines,[15,1000]);
      assert.equal(dispatches,2);
    }
    const serialized=JSON.stringify({dispatches,results});
    assert(!serialized.includes('synthetic-private-store-token'));
    process.stdout.write(serialized);
  `;
  const { stdout } = await promisify(execFile)(process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", script], {
      env: { NODE_ENV: "test", UPSTASH_REDIS_REST_URL: "https://synthetic-usage.upstash.io", UPSTASH_REDIS_REST_TOKEN: "synthetic-private-store-token" },
      timeout: 10_000, maxBuffer: 32 * 1024,
    });
  return JSON.parse(stdout) as { dispatches: number; results: { ok: false; error: { status: number; code: string } }[] };
}

test("runtime pacing skips Redis for invalid remaining budgets and pre-cancellation", async () => {
  const result = await runtimeScenario("invalid");
  assert.equal(result.dispatches, 0);
  assert.equal(result.results.length, 6);
  assert.equal(result.results.at(-1)?.error.status, 499);
});

test("runtime pacing store operations use the smaller of one second and the remaining run budget", async () => {
  const result = await runtimeScenario("deadlines");
  assert.equal(result.dispatches, 2);
  assert(result.results.every(row => row.error.status === 503 && row.error.code === "USAGE_UNAVAILABLE"));
});
