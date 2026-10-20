import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv, stripVTControlCharacters } from "node:util";

const projectRoot = new URL("../", import.meta.url);
const localEnvFile = new URL(".env.local", projectRoot);
const harnessBin = fileURLToPath(new URL("node_modules/@qloo/qloo-harness/dist/bin.js", projectRoot));
const fetchGuard = new URL("./qloo-smoke-fetch.mjs", import.meta.url).href;
const timeoutMs = 30_000;

/** @param {Record<string, string | undefined>} environment @param {URL} envFile */
export async function readCredential(environment, envFile) {
  // An explicitly set process value, including an empty value, takes precedence.
  if (Object.hasOwn(environment, "QLOO_API_KEY")) {
    return environment.QLOO_API_KEY?.trim() ?? "";
  }
  try {
    return parseEnv(await readFile(envFile, "utf8")).QLOO_API_KEY?.trim() ?? "";
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

/**
 * @typedef {{ stdout: string, stderr: string, launched: boolean, exitCode: number | null,
 * processCode: string | null, signal: string | null, timedOut: boolean }} HarnessResult
 */

/**
 * @param {string} credential
 * @param {Record<string, string | undefined>} environment
 * @returns {Promise<HarnessResult>}
 */
export function invokeHarness(credential, environment, { execute = execFile, limitMs = timeoutMs } = {}) {
  return new Promise((resolve) => {
    let launched = false;
    let timedOut = false;
    let settled = false;
    let timer;
    const finish = (error, stdout = "", stderr = "") => {
      settled = true;
      clearTimeout(timer);
      // Bounded streams stay internal; never log child errors/commands/headers.
      resolve({
        stdout, stderr, launched,
        exitCode: Number.isInteger(error?.code) ? error.code : error ? null : 0,
        processCode: typeof error?.code === "string" ? error.code : null,
        signal: error?.signal ?? null,
        timedOut,
      });
    };
    try {
      // Node + absolute bin.js avoids Windows .cmd lookup and shell quoting.
      // Supported verbose output supplies status evidence, never raw output.
      const child = execute(
        process.execPath,
        ["--import", fetchGuard, harnessBin, "api", "--verbose", "search", "--query", "The Guide", "--type", "book", "--take", "3", "--json"],
        {
          cwd: fileURLToPath(projectRoot),
          env: {
            ...environment,
            QLOO_API_KEY: credential,
            QLOO_BASE_URL: "https://hackathon.api.qloo.com",
            QLOO_TRUSTED_BASE_URL: "https://hackathon.api.qloo.com",
            AFTERHOURS_QLOO_SMOKE_GUARD: "1",
            NO_COLOR: "1",
          },
          maxBuffer: 1024 * 1024,
          encoding: "utf8",
          windowsHide: true,
          shell: false,
        },
        finish,
      );
      child.once("spawn", () => { launched = true; });
      if (!settled) {
        timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, limitMs);
      }
    } catch (error) {
      finish(error);
    }
  });
}

const launchCodes = new Set(["ENOENT", "EACCES", "EPERM", "ENOTDIR", "EINVAL", "E2BIG"]);
const processCodes = new Set([...launchCodes, "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", "ABORT_ERR"]);
const signals = new Set(["SIGKILL", "SIGTERM", "SIGINT", "SIGABRT", "SIGSEGV"]);
const harnessExitCodes = {
  GENERAL_ERROR: 1, BAD_USAGE: 2, AUTH_FAILED: 3,
  NOT_FOUND: 4, API_ERROR: 5, CONFIG_ERROR: 6,
};

function parseJson(text) {
  try { return JSON.parse(text); } catch { return undefined; }
}

function observedHttpStatus(stderr) {
  // Pinned --verbose writes these consecutive lines around fetch. A request
  // log alone does not prove delivery. Never display its URL or raw stderr.
  const lines = stripVTControlCharacters(stderr).split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].startsWith("API request: GET ")) continue;
    let target;
    try { target = new URL(lines[index].slice("API request: GET ".length)); } catch { continue; }
    if (
      target.origin !== "https://hackathon.api.qloo.com" || target.pathname !== "/search" ||
      target.username || target.password ||
      target.searchParams.get("query") !== "The Guide" ||
      target.searchParams.get("take") !== "3" ||
      target.searchParams.get("types") !== "urn:entity:book"
    ) continue;
    const match = /^Response: ([1-5]\d{2}) in \d+(?:\.\d+)?ms$/.exec(lines[index + 1]);
    if (match) return Number(match[1]);
  }
  return null;
}

function evidenceFor(result) {
  const httpStatus = observedHttpStatus(typeof result.stderr === "string" ? result.stderr : "");
  const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : null;
  const processCode = processCodes.has(result.processCode) ? result.processCode : null;
  const parsed = parseJson(result.stdout);
  const harnessCode = parsed?.error === true && typeof parsed.message === "string" &&
    Object.hasOwn(harnessExitCodes, parsed.code) &&
    harnessExitCodes[parsed.code] === exitCode ? parsed.code : null;
  const evidence = {
    stage: "harness execution",
    harnessLaunched: result.launched === true,
    processExitCode: exitCode,
    signal: signals.has(result.signal) ? result.signal : null,
    timedOut: result.timedOut === true,
    errorCode: processCode ?? harnessCode,
    httpStatus,
    requestReachedQloo: httpStatus !== null ? "yes" : result.launched === false ? "no" : "unknown",
    explanation: "The harness did not expose a recognized cause. Raw child output is withheld.",
  };
  if (!evidence.harnessLaunched && launchCodes.has(processCode)) {
    evidence.stage = "process launch";
    evidence.explanation = "Node could not start the harness process; inspect the executable and local permissions.";
  } else if (processCode === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
    evidence.explanation = "The child exceeded the 1 MiB per-stream output limit.";
  } else if (evidence.timedOut) {
    evidence.explanation = "The harness timed out after 30 seconds and was terminated.";
  } else if (evidence.signal) {
    evidence.explanation = "The harness was terminated by a signal; no timeout was observed.";
  } else if (httpStatus !== null) {
    evidence.stage = "HTTP response";
    evidence.explanation = httpStatus === 401
      ? "Qloo returned HTTP 401; authentication was not accepted. This does not establish why."
      : httpStatus === 403
        ? "Qloo returned HTTP 403; access to this request was forbidden."
        : httpStatus === 429
          ? "Qloo returned HTTP 429; the request was rate limited."
          : httpStatus >= 400
            ? "Qloo returned an unsuccessful HTTP response."
            : "An HTTP response was received; entity matching still requires candidate review.";
  } else if (harnessCode === "AUTH_FAILED" || harnessCode === "CONFIG_ERROR") {
    evidence.stage = "configuration";
    evidence.requestReachedQloo = "no";
    evidence.explanation = "The harness could not resolve its local credential or configuration; no search was sent.";
  } else if (harnessCode === "API_ERROR" && parsed.message === "fetch failed") {
    evidence.stage = "network";
    evidence.explanation = "The harness reported fetch failed; the underlying DNS, TLS, or socket cause was not exposed.";
  } else if (harnessCode === "API_ERROR") {
    evidence.explanation = "The harness reported API_ERROR without an observable HTTP status; network and server errors remain indistinguishable.";
  } else if (harnessCode === "BAD_USAGE") {
    evidence.explanation = "The harness rejected the command arguments.";
  } else if (exitCode === 0) {
    evidence.explanation = "The harness completed; an HTTP response was not independently exposed.";
  }
  return evidence;
}

function reportFailure(errorOut, evidence) {
  errorOut(`Qloo smoke failed: ${JSON.stringify(evidence)}`);
  errorOut("No retries were attempted. Connectivity is not verified.");
  return 1;
}

function safeCandidateJson(candidates, credential) {
  const json = JSON.stringify(candidates, (key, value) => {
    if (/api.?key|authorization|credential|token|secret/i.test(key)) return "[redacted]";
    return typeof value === "string"
      ? stripVTControlCharacters(value.split(credential).join("[redacted]"))
      : value;
  }, 2);
  return json.split(JSON.stringify(credential).slice(1, -1)).join("[redacted]");
}

/**
 * @param {{
 *   environment?: Record<string, string | undefined>,
 *   envFile?: URL,
 *   invoke?: (credential: string, environment: Record<string, string | undefined>) => Promise<Awaited<ReturnType<typeof invokeHarness>>>,
 *   out?: (message: string) => void,
 *   errorOut?: (message: string) => void,
 * }} [options]
 */
export async function runSmoke({
  environment = process.env,
  envFile = localEnvFile,
  invoke = invokeHarness,
  out = console.log,
  errorOut = console.error,
} = {}) {
  let credential;
  try {
    credential = await readCredential(environment, envFile);
  } catch {
    return reportFailure(errorOut, {
      stage: "configuration", harnessLaunched: false, processExitCode: null,
      signal: null, timedOut: false, errorCode: null, httpStatus: null,
      requestReachedQloo: "no",
      explanation: "Qloo configuration could not be read. Check access to .env.local. No request was made.",
    });
  }
  if (!credential) {
    out("Qloo credentials not configured");
    return 0;
  }

  let result;
  try {
    result = await invoke(credential, environment);
  } catch {
    // An unexpected wrapper error proves neither a failed spawn nor delivery.
    result = { launched: undefined, exitCode: null, stdout: "", stderr: "" };
  }
  const evidence = evidenceFor(result);
  if (result.exitCode !== 0 || result.processCode || result.signal || result.timedOut) {
    return reportFailure(errorOut, evidence);
  }
  const candidates = parseJson(result.stdout);
  if (!Array.isArray(candidates) || candidates.length > 3) {
    return reportFailure(errorOut, {
      ...evidence, stage: "response parsing",
      explanation: candidates === undefined
        ? "The harness returned invalid JSON. Response withheld."
        : "The harness returned an unexpected result shape or exceeded the three-candidate limit. Response withheld.",
    });
  }
  out(`Qloo smoke evidence: ${JSON.stringify(evidence)}`);
  out(`Qloo CLI search completed with ${candidates.length} candidate(s). No entity match has been accepted.`);
  if (candidates.length === 0) {
    out("An empty array does not confirm a book match; the harness also uses [] when upstream results are absent.");
  }
  out("Candidate JSON from the official harness (review before choosing a book):");
  out(safeCandidateJson(candidates, credential));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runSmoke();
}
