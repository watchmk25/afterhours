import assert from "node:assert/strict";
import { execFile, type ChildProcess, type ExecFileException } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import test, { type TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import { invokeHarness, readCredential, runSmoke } from "../scripts/qloo-smoke.mjs";

// Every credential and response below is a synthetic local test fixture.
// No tests contact Qloo. The real child probe executes only synthetic Node code.
const fixtureCredential = "afterhours-test-fixture-only";
const rawMarker = "RAW_SYNTHETIC_DETAILS_MUST_NOT_BE_DISPLAYED";

type HarnessResult = {
  stdout: string;
  stderr: string;
  launched: boolean;
  exitCode: number | null;
  processCode: string | null;
  signal: string | null;
  timedOut: boolean;
};

function harnessResult(overrides: Partial<HarnessResult> = {}): HarnessResult {
  return {
    stdout: "[]", stderr: "", launched: true, exitCode: 0,
    processCode: null, signal: null, timedOut: false, ...overrides,
  };
}

function structuredFailure(code: string, message = `${rawMarker} ${fixtureCredential}`) {
  return JSON.stringify({ error: true, code, message });
}

function httpEvidence(status: number) {
  return "API request: GET https://api.qloo.com/search?query=The+Guide&take=3&types=urn%3Aentity%3Abook\n"
    + `Response: ${status} in 12.3ms\n`;
}

async function envFile(t: TestContext, contents?: string) {
  const directory = await mkdtemp(join(tmpdir(), "afterhours-qloo-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, ".env.local");
  if (contents !== undefined) await writeFile(file, contents, "utf8");
  return pathToFileURL(file);
}

function captureOutput() {
  const messages: string[] = [];
  const errors: string[] = [];
  return {
    messages,
    errors,
    out: (message: string) => { messages.push(message); },
    errorOut: (message: string) => { errors.push(message); },
  };
}

type Output = ReturnType<typeof captureOutput>;

function failureEvidence(output: Output) {
  assert.deepEqual(output.messages, [], "Failures must not display raw response content");
  assert.equal(output.errors.length, 2);
  assert.equal(output.errors[1], "No retries were attempted. Connectivity is not verified.");
  const prefix = "Qloo smoke failed: ";
  assert(output.errors[0].startsWith(prefix));
  const diagnostic = JSON.parse(output.errors[0].slice(prefix.length));
  assert.deepEqual(Object.keys(diagnostic).sort(), [
    "stage", "harnessLaunched", "processExitCode", "signal", "timedOut",
    "errorCode", "httpStatus", "requestReachedQloo", "explanation",
  ].sort());
  assert.equal(typeof diagnostic.explanation, "string");
  assert(diagnostic.explanation.length > 0);
  assert(["yes", "no", "unknown"].includes(diagnostic.requestReachedQloo));
  assert(!output.errors[0].includes(fixtureCredential));
  assert(!output.errors[0].includes(rawMarker));
  return diagnostic;
}

for (const scenario of [
  { name: "absent credentials", environment: {}, file: undefined },
  { name: "whitespace credentials", environment: { QLOO_API_KEY: " \t " }, file: undefined },
  { name: "an empty process value overriding a configured file", environment: { QLOO_API_KEY: "" }, file: `QLOO_API_KEY=${fixtureCredential}\n` },
]) {
  test(`Qloo smoke makes zero harness calls with ${scenario.name}`, async (t) => {
    const file = await envFile(t, scenario.file);
    const output = captureOutput();
    let calls = 0;
    const code = await runSmoke({
      environment: scenario.environment,
      envFile: file,
      invoke: async () => { calls += 1; return harnessResult(); },
      ...output,
    });
    assert.equal(code, 0);
    assert.equal(calls, 0, "Missing credentials must not reach the request boundary");
    assert.deepEqual(output.messages, ["Qloo credentials not configured"]);
    assert.deepEqual(output.errors, []);
  });
}

test("Qloo credential loading honors quoted dotenv values and process precedence", async (t) => {
  const file = await envFile(t, [
    "# Synthetic test configuration, never a real API credential",
    "export QLOO_API_KEY = 'fixture # literal $value' # trailing comment",
    "UNRELATED_SETTING=ignored",
    "",
  ].join("\n"));
  assert.equal(await readCredential({}, file), "fixture # literal $value");
  assert.equal(await readCredential({ QLOO_API_KEY: ` ${fixtureCredential} ` }, file), fixtureCredential);
  assert.equal(await readCredential({ QLOO_API_KEY: "" }, file), "");
});

test("Qloo smoke uses the process credential once and never accepts an entity match", async (t) => {
  const file = await envFile(t, "QLOO_API_KEY=other-synthetic-file-fixture\n");
  const environment = { QLOO_API_KEY: ` ${fixtureCredential} ` };
  const output = captureOutput();
  const calls: Array<{ credential: string; environment: object }> = [];
  const candidates = [{ fixtureOnly: true, description: "Synthetic candidate for test only" }];
  const code = await runSmoke({
    environment,
    envFile: file,
    invoke: async (credential: string, passedEnvironment: object) => {
      calls.push({ credential, environment: passedEnvironment });
      return harnessResult({ stdout: JSON.stringify(candidates) });
    },
    ...output,
  });
  assert.equal(code, 0);
  assert.deepEqual(calls, [{ credential: fixtureCredential, environment }]);
  assert.deepEqual(output.errors, []);
  assert.match(output.messages.join("\n"), /1 candidate\(s\).*No entity match has been accepted/);
  assert.deepEqual(JSON.parse(output.messages.at(-1)!), candidates);
});

test("Qloo smoke reports unreadable configuration without exposing contents or calling the harness", async (t) => {
  const file = await envFile(t);
  const output = captureOutput();
  let calls = 0;
  const code = await runSmoke({
    environment: {},
    // Reading a directory as an env file fails without relying on OS permissions.
    envFile: new URL("./", file),
    invoke: async () => { calls += 1; return harnessResult(); },
    ...output,
  });
  assert.equal(code, 1);
  assert.equal(calls, 0);
  const diagnostic = failureEvidence(output);
  assert.equal(diagnostic.stage, "configuration");
  assert.equal(diagnostic.harnessLaunched, false);
  assert.equal(diagnostic.processExitCode, null);
  assert.equal(diagnostic.httpStatus, null);
  assert.equal(diagnostic.requestReachedQloo, "no");
});

for (const processCode of ["EPERM", "EACCES", "ENOENT"]) {
  test(`Qloo smoke identifies pre-spawn ${processCode} as a local launch failure`, async () => {
    const output = captureOutput();
    let calls = 0;
    const code = await runSmoke({
      environment: { QLOO_API_KEY: fixtureCredential },
      invoke: async () => {
        calls += 1;
        return harnessResult({
          launched: false, exitCode: null, processCode,
          stdout: rawMarker, stderr: fixtureCredential,
        });
      },
      ...output,
    });
    assert.equal(code, 1);
    assert.equal(calls, 1);
    const diagnostic = failureEvidence(output);
    assert.equal(diagnostic.stage, "process launch");
    assert.equal(diagnostic.harnessLaunched, false);
    assert.equal(diagnostic.processExitCode, null);
    assert.equal(diagnostic.errorCode, processCode);
    assert.equal(diagnostic.httpStatus, null);
    assert.equal(diagnostic.requestReachedQloo, "no");
  });
}

test("Qloo smoke distinguishes a launched harness failure from inability to launch", async () => {
  const output = captureOutput();
  const code = await runSmoke({
    environment: { QLOO_API_KEY: fixtureCredential },
    invoke: async () => harnessResult({
      exitCode: 1, stdout: rawMarker,
      stderr: `qloo: unexpected failure: Cannot find module ${fixtureCredential}`,
    }),
    ...output,
  });
  assert.equal(code, 1);
  const diagnostic = failureEvidence(output);
  assert.equal(diagnostic.stage, "harness execution");
  assert.equal(diagnostic.harnessLaunched, true);
  assert.equal(diagnostic.processExitCode, 1);
  assert.equal(diagnostic.errorCode, null);
  assert.equal(diagnostic.requestReachedQloo, "unknown");
});

for (const scenario of [
  { name: "timeout", result: harnessResult({ exitCode: null, signal: "SIGKILL", timedOut: true }), explanation: /tim(?:e|ed)\s*out|timeout/i },
  { name: "output limit before timeout", result: harnessResult({ exitCode: null, signal: "SIGKILL", processCode: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", timedOut: true }), explanation: /output|1 MiB/i },
  { name: "signal termination", result: harnessResult({ exitCode: null, signal: "SIGTERM" }), explanation: /signal|terminat/i },
]) {
  test(`Qloo smoke reports ${scenario.name} without retries or invented HTTP status`, async () => {
    const output = captureOutput();
    let calls = 0;
    const code = await runSmoke({
      environment: { QLOO_API_KEY: fixtureCredential },
      invoke: async () => { calls += 1; return scenario.result; },
      ...output,
    });
    assert.equal(code, 1);
    assert.equal(calls, 1);
    const diagnostic = failureEvidence(output);
    assert.equal(diagnostic.stage, "harness execution");
    assert.equal(diagnostic.harnessLaunched, true);
    assert.equal(diagnostic.processExitCode, null);
    assert.equal(diagnostic.signal, scenario.result.signal);
    assert.equal(diagnostic.httpStatus, null);
    assert.equal(diagnostic.requestReachedQloo, "unknown");
    assert.match(diagnostic.explanation, scenario.explanation);
    if (scenario.name === "timeout") assert.equal(diagnostic.timedOut, true);
    if (scenario.result.processCode) assert.equal(diagnostic.errorCode, scenario.result.processCode);
  });
}

for (const [exitCode, errorCode] of [
  [1, "GENERAL_ERROR"], [2, "BAD_USAGE"], [3, "AUTH_FAILED"],
  [4, "NOT_FOUND"], [5, "API_ERROR"], [6, "CONFIG_ERROR"],
] as const) {
  test(`Qloo smoke recognizes matched harness ${errorCode} without exposing its message`, async () => {
    const output = captureOutput();
    const code = await runSmoke({
      environment: { QLOO_API_KEY: fixtureCredential },
      invoke: async () => harnessResult({ exitCode, stdout: structuredFailure(errorCode), stderr: rawMarker }),
      ...output,
    });
    assert.equal(code, 1);
    const diagnostic = failureEvidence(output);
    const configurationFailure = errorCode === "AUTH_FAILED" || errorCode === "CONFIG_ERROR";
    assert.equal(diagnostic.stage, configurationFailure ? "configuration" : "harness execution");
    assert.equal(diagnostic.processExitCode, exitCode);
    assert.equal(diagnostic.errorCode, errorCode);
    assert.equal(diagnostic.httpStatus, null);
    assert.equal(diagnostic.requestReachedQloo, configurationFailure ? "no" : "unknown");
  });
}

test("Qloo smoke recognizes the harness's exact fetch failure without claiming Qloo received it", async () => {
  const output = captureOutput();
  const code = await runSmoke({
    environment: { QLOO_API_KEY: fixtureCredential },
    invoke: async () => harnessResult({ exitCode: 5, stdout: structuredFailure("API_ERROR", "fetch failed") }),
    ...output,
  });
  assert.equal(code, 1);
  const diagnostic = failureEvidence(output);
  assert.equal(diagnostic.stage, "network");
  assert.equal(diagnostic.errorCode, "API_ERROR");
  assert.equal(diagnostic.httpStatus, null);
  assert.equal(diagnostic.requestReachedQloo, "unknown");
});

for (const httpStatus of [401, 403, 429]) {
  test(`Qloo smoke reports observed HTTP ${httpStatus} separately from harness exit 5`, async () => {
    const output = captureOutput();
    const code = await runSmoke({
      environment: { QLOO_API_KEY: fixtureCredential },
      invoke: async () => harnessResult({
        exitCode: 5, stdout: structuredFailure("API_ERROR"),
        stderr: httpEvidence(httpStatus) + `${rawMarker} ${fixtureCredential}\n`,
      }),
      ...output,
    });
    assert.equal(code, 1);
    const diagnostic = failureEvidence(output);
    assert.equal(diagnostic.stage, "HTTP response");
    assert.equal(diagnostic.harnessLaunched, true);
    assert.equal(diagnostic.processExitCode, 5);
    assert.equal(diagnostic.errorCode, "API_ERROR");
    assert.equal(diagnostic.httpStatus, httpStatus);
    assert.equal(diagnostic.requestReachedQloo, "yes");
  });
}

for (const scenario of [
  { name: "a code mismatched with exit status", stdout: structuredFailure("AUTH_FAILED"), expectedCode: null },
  { name: "an unrecognized code", stdout: structuredFailure(fixtureCredential), expectedCode: null },
  { name: "an absent message", stdout: JSON.stringify({ error: true, code: "GENERAL_ERROR" }), expectedCode: null },
  { name: "a false error flag", stdout: JSON.stringify({ error: false, code: "GENERAL_ERROR", message: rawMarker }), expectedCode: null },
  { name: "a nonstring message", stdout: JSON.stringify({ error: true, code: "GENERAL_ERROR", message: { secret: fixtureCredential } }), expectedCode: null },
  { name: "non-JSON content", stdout: `HTTP 401 ${rawMarker} ${fixtureCredential}`, expectedCode: null },
]) {
  test(`Qloo smoke exposes only a verified code with ${scenario.name}`, async () => {
    const output = captureOutput();
    const code = await runSmoke({
      environment: { QLOO_API_KEY: fixtureCredential },
      invoke: async () => harnessResult({
        exitCode: 1, stdout: scenario.stdout,
        stderr: `Error: upstream HTTP 401 ${rawMarker} ${fixtureCredential}`,
      }),
      ...output,
    });
    assert.equal(code, 1);
    const diagnostic = failureEvidence(output);
    assert.equal(diagnostic.stage, "harness execution");
    assert.equal(diagnostic.errorCode, scenario.expectedCode);
    assert.equal(diagnostic.httpStatus, null);
    assert.equal(diagnostic.requestReachedQloo, "unknown");
  });
}

test("Qloo smoke sanitizes thrown exception fields and does not retry", async () => {
  const output = captureOutput();
  let calls = 0;
  const code = await runSmoke({
    environment: { QLOO_API_KEY: fixtureCredential },
    invoke: async () => {
      calls += 1;
      throw Object.assign(new Error(`${rawMarker} ${fixtureCredential}`), {
        code: fixtureCredential, signal: rawMarker, stdout: rawMarker,
        stderr: fixtureCredential, command: `${rawMarker} ${fixtureCredential}`,
        stack: fixtureCredential, httpStatus: 401,
      });
    },
    ...output,
  });
  assert.equal(code, 1);
  assert.equal(calls, 1);
  const diagnostic = failureEvidence(output);
  assert.equal(diagnostic.stage, "harness execution");
  assert.equal(diagnostic.errorCode, null);
  assert.equal(diagnostic.httpStatus, null);
  assert.equal(diagnostic.requestReachedQloo, "unknown");
});

for (const scenario of [
  { name: "invalid JSON", response: `not-json ${fixtureCredential}`, expected: /invalid JSON/ },
  { name: "a nonarray response", response: JSON.stringify({ fixtureOnly: true }), expected: /unexpected result shape/ },
  { name: "more than three candidates", response: JSON.stringify(Array.from({ length: 4 }, () => ({ fixtureOnly: true }))), expected: /three-candidate limit/ },
]) {
  test(`Qloo smoke rejects ${scenario.name} without displaying the response`, async () => {
    const output = captureOutput();
    const code = await runSmoke({
      environment: { QLOO_API_KEY: fixtureCredential },
      invoke: async () => harnessResult({ stdout: scenario.response }),
      ...output,
    });
    assert.equal(code, 1);
    const diagnostic = failureEvidence(output);
    assert.equal(diagnostic.stage, "response parsing");
    assert.equal(diagnostic.processExitCode, 0);
    assert.equal(diagnostic.httpStatus, null);
    assert.equal(diagnostic.requestReachedQloo, "unknown");
    assert.match(diagnostic.explanation, scenario.expected);
  });
}

test("Qloo candidate output redacts secret fields and strips terminal styling", async () => {
  const output = captureOutput();
  const candidates = [{
    fixtureOnly: true,
    description: `Synthetic fixture ${fixtureCredential}`,
    display: "\u001b[31mSynthetic candidate\u001b[0m",
    api_key: "fixture-api-key",
    Authorization: "fixture-authorization",
    nested: { accessToken: "fixture-token", secret: "fixture-secret", credential: "fixture-credential" },
  }];
  const code = await runSmoke({
    environment: { QLOO_API_KEY: fixtureCredential },
    invoke: async () => harnessResult({ stdout: JSON.stringify(candidates) }),
    ...output,
  });
  assert.equal(code, 0);
  const displayed = JSON.parse(output.messages.at(-1)!);
  assert.equal(displayed[0].description, "Synthetic fixture [redacted]");
  assert.equal(displayed[0].display, "Synthetic candidate");
  assert.equal(displayed[0].api_key, "[redacted]");
  assert.equal(displayed[0].Authorization, "[redacted]");
  assert.deepEqual(displayed[0].nested, { accessToken: "[redacted]", secret: "[redacted]", credential: "[redacted]" });
  assert(!output.messages.join("\n").includes(fixtureCredential));
});

test("Qloo candidate output redacts credentials containing JSON-escaped characters in values and keys", async () => {
  const credential = 'synthetic-fixture-"quote"-\\slash-\nline';
  const output = captureOutput();
  const code = await runSmoke({
    environment: { QLOO_API_KEY: credential },
    invoke: async () => harnessResult({ stdout: JSON.stringify([{ fixtureOnly: true, description: `Fixture ${credential}`, [credential]: "fixture-only value" }]) }),
    ...output,
  });
  assert.equal(code, 0);
  const displayed = JSON.parse(output.messages.at(-1)!);
  assert.equal(displayed[0].description, "Fixture [redacted]");
  assert.equal(displayed[0]["[redacted]"], "fixture-only value");
  assert(!Object.keys(displayed[0]).some((key) => key.includes(credential)));
});

test("Qloo smoke does not interpret an empty result as a confirmed book match", async () => {
  const output = captureOutput();
  const code = await runSmoke({
    environment: { QLOO_API_KEY: fixtureCredential },
    invoke: async () => harnessResult(),
    ...output,
  });
  assert.equal(code, 0);
  assert.match(output.messages.join("\n"), /0 candidate\(s\).*No entity match has been accepted/);
  assert.match(output.messages.join("\n"), /empty array does not confirm a book match/);
  assert.deepEqual(output.errors, []);
});

test("Qloo successful evidence reports only the HTTP status actually observed", async () => {
  const output = captureOutput();
  const code = await runSmoke({
    environment: { QLOO_API_KEY: fixtureCredential },
    invoke: async () => harnessResult({ stderr: httpEvidence(200) }),
    ...output,
  });
  assert.equal(code, 0);
  assert.deepEqual(output.errors, []);
  const evidenceLine = output.messages.find((message) => message.startsWith("Qloo smoke evidence: "));
  assert(evidenceLine);
  const evidence = JSON.parse(evidenceLine.slice("Qloo smoke evidence: ".length));
  assert.equal(evidence.httpStatus, 200);
  assert.equal(evidence.requestReachedQloo, "yes");
  assert.equal(evidence.harnessLaunched, true);
  assert.equal(evidence.processExitCode, 0);
});

test("Qloo successful candidate JSON does not invent an HTTP status when verbose evidence is absent", async () => {
  const output = captureOutput();
  const code = await runSmoke({
    environment: { QLOO_API_KEY: fixtureCredential },
    invoke: async () => harnessResult(),
    ...output,
  });
  assert.equal(code, 0);
  const evidenceLine = output.messages.find((message) => message.startsWith("Qloo smoke evidence: "));
  assert(evidenceLine);
  const evidence = JSON.parse(evidenceLine.slice("Qloo smoke evidence: ".length));
  assert.equal(evidence.httpStatus, null);
  assert.equal(evidence.requestReachedQloo, "unknown");
});

test("Qloo smoke never treats an HTTP-looking upstream message as observed response metadata", async () => {
  const output = captureOutput();
  const code = await runSmoke({
    environment: { QLOO_API_KEY: fixtureCredential },
    invoke: async () => harnessResult({
      exitCode: 5,
      stdout: structuredFailure("API_ERROR", "Response: 401 in 12.3ms"),
      stderr: `${rawMarker} ${fixtureCredential}`,
    }),
    ...output,
  });
  assert.equal(code, 1);
  const diagnostic = failureEvidence(output);
  assert.equal(diagnostic.stage, "harness execution");
  assert.equal(diagnostic.httpStatus, null);
  assert.equal(diagnostic.requestReachedQloo, "unknown");
});

type ExecutionCallback = (error: ExecFileException | null, stdout: string, stderr: string) => void;

function fakeExecute({
  launch = true, error = null, stdout = "[]", stderr = "", waitForKill = false,
}: {
  launch?: boolean;
  error?: ExecFileException | null;
  stdout?: string;
  stderr?: string;
  waitForKill?: boolean;
} = {}) {
  const calls: Array<{ executable: string; args: string[]; options: Record<string, unknown> }> = [];
  let killCalls = 0;
  const execute = ((executable: string, args: string[], options: Record<string, unknown>, callback: ExecutionCallback) => {
    calls.push({ executable, args, options });
    const child = new EventEmitter() as EventEmitter & { kill: (signal: string) => boolean };
    child.kill = (signal) => {
      killCalls += 1;
      queueMicrotask(() => callback(Object.assign(new Error(rawMarker), { killed: true, code: null, signal }) as ExecFileException, stdout, stderr));
      return true;
    };
    queueMicrotask(() => {
      if (launch) child.emit("spawn");
      if (!waitForKill) callback(error, stdout, stderr);
    });
    return child as unknown as ChildProcess;
  }) as unknown as typeof execFile;
  return { execute, calls, killCalls: () => killCalls };
}

test("Qloo invocation launches Node directly with credentials only in the child environment", async () => {
  const fake = fakeExecute();
  const result = await invokeHarness(fixtureCredential, {
    QLOO_API_KEY: fixtureCredential,
    QLOO_BASE_URL: "https://untrusted-synthetic.invalid",
  }, { execute: fake.execute });
  assert.equal(fake.calls.length, 1);
  const call = fake.calls[0];
  assert.equal(call.executable, process.execPath);
  assert.equal(call.args[0], "--import");
  assert.match(call.args[1], /^file:\/\//);
  assert.match(new URL(call.args[1]).pathname, /\/scripts\/qloo-smoke-fetch\.mjs$/);
  assert(isAbsolute(call.args[2]));
  assert.match(call.args[2].replaceAll("\\", "/"), /node_modules\/@qloo\/qloo-harness\/dist\/bin\.js$/);
  assert.deepEqual(call.args.slice(3), ["api", "--verbose", "search", "--query", "The Guide", "--type", "book", "--take", "3", "--json"]);
  assert(!call.args.join(" ").includes(fixtureCredential));
  assert.equal(call.options.shell, false);
  assert.equal(call.options.windowsHide, true);
  assert.equal(call.options.maxBuffer, 1024 * 1024);
  const childEnvironment = call.options.env as Record<string, string>;
  assert.equal(childEnvironment.QLOO_API_KEY, fixtureCredential);
  assert.equal(childEnvironment.QLOO_BASE_URL, "https://api.qloo.com");
  assert.deepEqual(result, harnessResult());
});

test("Qloo invocation preserves local launch failure separately from child exit metadata", async () => {
  const fake = fakeExecute({
    launch: false,
    error: Object.assign(new Error(`${rawMarker} ${fixtureCredential}`), { code: "EPERM" }),
    stdout: "", stderr: "",
  });
  const result = await invokeHarness(fixtureCredential, {}, { execute: fake.execute });
  assert.equal(result.launched, false);
  assert.equal(result.processCode, "EPERM");
  assert.equal(result.exitCode, null);
  assert.equal(result.signal, null);
  assert.equal(result.timedOut, false);
  assert.equal(fake.calls.length, 1);
});

test("Qloo invocation preserves numeric child exit, signal, stdout, and stderr", async () => {
  const stdout = structuredFailure("API_ERROR");
  const stderr = httpEvidence(403);
  const fake = fakeExecute({ error: Object.assign(new Error(rawMarker), { code: 5, signal: "SIGTERM" as const }), stdout, stderr });
  const result = await invokeHarness(fixtureCredential, {}, { execute: fake.execute });
  assert.equal(result.launched, true);
  assert.equal(result.exitCode, 5);
  assert.equal(result.processCode, null);
  assert.equal(result.signal, "SIGTERM");
  assert.equal(result.stdout, stdout);
  assert.equal(result.stderr, stderr);
  assert.equal(result.timedOut, false);
});

test("Qloo invocation does not confuse a maximum-output kill with its own timeout", async () => {
  const fake = fakeExecute({
    error: Object.assign(new Error(rawMarker), {
      code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", killed: true, signal: "SIGKILL" as const,
    }),
  });
  const result = await invokeHarness(fixtureCredential, {}, { execute: fake.execute });
  assert.equal(result.launched, true);
  assert.equal(result.processCode, "ERR_CHILD_PROCESS_STDIO_MAXBUFFER");
  assert.equal(result.timedOut, false);
  assert.equal(fake.killCalls(), 0);
});

test("Qloo invocation's own deadline kills the fake child once and records an actual timeout", async () => {
  const fake = fakeExecute({ waitForKill: true, stdout: "", stderr: "" });
  const result = await invokeHarness(fixtureCredential, {}, { execute: fake.execute, limitMs: 5 });
  assert.equal(result.launched, true);
  assert.equal(result.timedOut, true);
  assert.equal(result.signal, "SIGKILL");
  assert.equal(result.exitCode, null);
  assert.equal(fake.killCalls(), 1);
  assert.equal(fake.calls.length, 1);
});

test("Qloo invocation carries a synthetic credential through a real Node child environment without a network call", async () => {
  let executions = 0;
  const execute = ((executable: string, _args: string[], options: Record<string, unknown>, callback: ExecutionCallback) => {
    executions += 1;
    // Replace the harness entry point completely. This child imports no Qloo
    // code, reads no files, and only compares synthetic environment fixtures.
    const probe = "process.stdout.write(JSON.stringify({fixtureReceived:process.env.QLOO_API_KEY===process.env.AFTERHOURS_EXPECTED_FIXTURE,officialEndpoint:process.env.QLOO_BASE_URL==='https://api.qloo.com'}))";
    return execFile(executable, ["-e", probe], options, callback);
  }) as unknown as typeof execFile;
  const result = await invokeHarness(fixtureCredential, {
    AFTERHOURS_EXPECTED_FIXTURE: fixtureCredential,
  }, { execute });
  assert.equal(executions, 1);
  assert.equal(result.launched, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.processCode, null);
  assert.equal(result.timedOut, false);
  assert.deepEqual(JSON.parse(result.stdout), { fixtureReceived: true, officialEndpoint: true });
  assert.equal(result.stderr, "");
});
