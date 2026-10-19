import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import { readCredential, runSmoke } from "../scripts/qloo-smoke.mjs";

// Every credential and response below is a synthetic local test fixture.
// The injected harness substitutes never launch a process or make API requests.
const fixtureCredential = "afterhours-test-fixture-only";

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
      invoke: async () => { calls += 1; return "[]"; },
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
      return JSON.stringify(candidates);
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
    invoke: async () => { calls += 1; return "[]"; },
    ...output,
  });
  assert.equal(code, 1);
  assert.equal(calls, 0);
  assert.deepEqual(output.messages, []);
  assert.match(output.errors.join("\n"), /configuration could not be read.*No request was made/);
});

for (const scenario of [
  { name: "timeout", failure: { timedOut: true, message: fixtureCredential }, expected: /timed out after 30 seconds/ },
  { name: "excessive output", failure: { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", timedOut: true, message: fixtureCredential }, expected: /exceeded the 1 MiB output limit/ },
  { name: "missing harness", failure: { code: "ENOENT", message: fixtureCredential }, expected: /could not launch the local harness/ },
  { name: "upstream failure", failure: new Error(`Raw upstream fixture: ${fixtureCredential}`), expected: /raw details withheld/ },
]) {
  test(`Qloo smoke sanitizes ${scenario.name} and makes no automatic retries`, async () => {
    const output = captureOutput();
    let calls = 0;
    const code = await runSmoke({
      environment: { QLOO_API_KEY: fixtureCredential },
      invoke: async () => { calls += 1; throw scenario.failure; },
      ...output,
    });
    assert.equal(code, 1);
    assert.equal(calls, 1);
    assert.deepEqual(output.messages, []);
    const diagnostic = output.errors.join("\n");
    assert.match(diagnostic, scenario.expected);
    if (scenario.name === "excessive output") assert(!diagnostic.includes("timed out"));
    assert.match(diagnostic, /No retries were attempted\. Connectivity is not verified/);
    assert(!diagnostic.includes(fixtureCredential));
    assert(!diagnostic.includes("Raw upstream fixture"));
  });
}

for (const scenario of [
  { name: "invalid JSON", response: `not-json ${fixtureCredential}`, expected: /invalid JSON/ },
  { name: "a nonarray response", response: JSON.stringify({ fixtureOnly: true }), expected: /unexpected result shape/ },
  { name: "more than three candidates", response: JSON.stringify(Array.from({ length: 4 }, () => ({ fixtureOnly: true }))), expected: /three-candidate limit/ },
]) {
  test(`Qloo smoke rejects ${scenario.name} without displaying the response`, async () => {
    const output = captureOutput();
    const code = await runSmoke({
      environment: { QLOO_API_KEY: fixtureCredential },
      invoke: async () => scenario.response,
      ...output,
    });
    assert.equal(code, 1);
    assert.deepEqual(output.messages, []);
    assert.match(output.errors.join("\n"), scenario.expected);
    assert(!output.errors.join("\n").includes(fixtureCredential));
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
    invoke: async () => JSON.stringify(candidates),
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
    invoke: async () => JSON.stringify([{ fixtureOnly: true, description: `Fixture ${credential}`, [credential]: "fixture-only value" }]),
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
    invoke: async () => "[]",
    ...output,
  });
  assert.equal(code, 0);
  assert.match(output.messages.join("\n"), /0 candidate\(s\).*No entity match has been accepted/);
  assert.match(output.messages.join("\n"), /empty array does not confirm a book match/);
  assert.deepEqual(output.errors, []);
});
