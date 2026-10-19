import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv, stripVTControlCharacters } from "node:util";

const projectRoot = new URL("../", import.meta.url);
const localEnvFile = new URL(".env.local", projectRoot);
const harnessBin = fileURLToPath(
  new URL("node_modules/@qloo/qloo-harness/dist/bin.js", projectRoot),
);
const timeoutMs = 30_000;

/**
 * @param {Record<string, string | undefined>} environment
 * @param {URL} envFile
 * @returns {Promise<string>}
 */
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
 * @param {string} credential
 * @param {Record<string, string | undefined>} environment
 * @returns {Promise<string>}
 */
function invokeHarness(credential, environment) {
  return new Promise((resolve, reject) => {
    // Direct `api search` in pinned harness 0.1.26 makes one fetch, with no
    // retry loop. Its client has no timeout; bound the entire child process.
    execFile(
      process.execPath,
      [harnessBin, "api", "search", "--query", "The Guide", "--type", "book", "--take", "3", "--json"],
      {
        cwd: fileURLToPath(projectRoot),
        env: {
          ...environment,
          QLOO_API_KEY: credential,
          // Do not let private harness configuration redirect this credential.
          QLOO_BASE_URL: "https://api.qloo.com",
          NO_COLOR: "1",
        },
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 1024 * 1024,
        encoding: "utf8",
        windowsHide: true,
        shell: false,
      },
      (error, stdout) => {
        // Never propagate raw child output or errors: upstream text could echo
        // credentials. Retain only the category needed for a safe diagnosis.
        if (error) {
          reject({ timedOut: error.killed && error.code !== "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", code: error.code });
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

function safeCandidateJson(candidates, credential) {
  const json = JSON.stringify(candidates, (key, value) => {
    if (/api.?key|authorization|credential|token|secret/i.test(key)) {
      return "[redacted]";
    }
    return typeof value === "string"
      ? stripVTControlCharacters(value.split(credential).join("[redacted]"))
      : value;
  }, 2);
  // Also cover a credential echoed as a JSON property name, including escapes.
  return json.split(JSON.stringify(credential).slice(1, -1)).join("[redacted]");
}

/**
 * @param {{
 *   environment?: Record<string, string | undefined>,
 *   envFile?: URL,
 *   invoke?: typeof invokeHarness,
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
    errorOut("Qloo configuration could not be read. Check access to .env.local. No request was made.");
    return 1;
  }
  if (!credential) {
    out("Qloo credentials not configured");
    return 0;
  }

  let stdout;
  try {
    stdout = await invoke(credential, environment);
  } catch (error) {
    const reason = error?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
      ? "exceeded the 1 MiB output limit"
      : error?.timedOut
        ? "timed out after 30 seconds"
        : error?.code === "ENOENT"
        ? "could not launch the local harness; run npm ci"
        : "failed (authentication, quota, network, or harness error; raw details withheld)";
    errorOut(`Qloo search ${reason}. No retries were attempted. Connectivity is not verified.`);
    return 1;
  }

  let candidates;
  try {
    candidates = JSON.parse(stdout);
  } catch {
    errorOut("Qloo harness returned invalid JSON. Response withheld; connectivity is not verified.");
    return 1;
  }
  // The inspected harness formatter emits response.results as JSON. Do not
  // assume candidate title/author/ID fields until a live response is reviewed.
  if (!Array.isArray(candidates) || candidates.length > 3) {
    errorOut("Qloo harness returned an unexpected result shape or exceeded the three-candidate limit. Response withheld.");
    return 1;
  }
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
