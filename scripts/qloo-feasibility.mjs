import { fork } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readCredential } from "./qloo-smoke.mjs";
import {
  BOOK_GUIDE_ID, buildSearchPlan, eligibleShortlist, rankingParams,
  reserveRequest, verifyMembership,
} from "./qloo-feasibility-model.ts";
import { createDefaultInputs } from "../lib/workspace.ts";

const root = new URL("../", import.meta.url);
const stateFile = new URL("../docs/qloo-feasibility-results.json", import.meta.url);
const resolutionFile = new URL("../docs/qloo-feasibility-resolutions.json", import.meta.url);
const origin = "https://hackathon.api.qloo.com";
const harness = fileURLToPath(new URL("node_modules/@qloo/qloo-harness/dist/bin.js", root));
const preload = new URL("./qloo-feasibility-fetch.mjs", import.meta.url).href;
const budget = 15;

function save(state) {
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function load() {
  return JSON.parse(readFileSync(stateFile, "utf8"));
}

function candidateSummary(candidate) {
  const summary = {};
  for (const key of ["name", "entity_id", "types", "disambiguation"]) {
    if (Object.hasOwn(candidate, key)) summary[key] = candidate[key];
  }
  const properties = {};
  for (const key of ["publication_year", "release_year", "author", "authors"]) {
    if (Object.hasOwn(candidate.properties ?? {}, key)) properties[key] = candidate.properties[key];
  }
  if (Object.keys(properties).length) summary.properties = properties;
  return summary;
}

function rankingSummary(entity) {
  const summary = {};
  for (const key of ["name", "entity_id", "types", "disambiguation"]) {
    if (Object.hasOwn(entity, key)) summary[key] = entity[key];
  }
  // Preserve actual numeric field names/values, never relabel as probabilities.
  for (const [key, value] of Object.entries(entity)) {
    if (typeof value === "number" && Number.isFinite(value)) summary[key] = value;
  }
  if (Object.hasOwn(entity, "query")) summary.query = entity.query;
  if (Object.hasOwn(entity, "explainability")) summary.explainability = entity.explainability;
  return summary;
}

async function request(state, key, kind, path, params, args, credential) {
  reserveRequest(state.requests.length, budget);
  if (state.stopped) throw new Error("Experiment previously stopped; no further calls allowed.");
  const entry = { key, kind, path, params, dispatched: false, httpStatus: null };
  state.requests.push(entry);
  save(state);
  const result = await new Promise((resolve) => {
    let response;
    let bytes = 0;
    let timedOut = false;
    let outputLimited = false;
    let launchError = false;
    const child = fork(harness, ["api", "--verbose", ...args, "--json"], {
      cwd: fileURLToPath(root),
      env: {
        ...process.env, QLOO_API_KEY: credential,
        QLOO_BASE_URL: origin, QLOO_TRUSTED_BASE_URL: origin,
        AFTERHOURS_QLOO_FEASIBILITY_PLAN: JSON.stringify({ path, params }),
        NO_COLOR: "1",
      },
      execArgv: ["--import", preload],
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
    });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, 30_000);
    const drain = (chunk) => {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) { outputLimited = true; child.kill("SIGKILL"); }
    };
    child.stdout.on("data", drain);
    child.stderr.on("data", drain);
    child.on("error", () => { launchError = true; });
    child.on("message", (event) => {
      if (event?.kind === "dispatch") {
        if (entry.dispatched) { state.stopped = true; child.kill("SIGKILL"); return; }
        entry.dispatched = true;
        save(state);
      } else if (event?.kind === "response") {
        response = event.body;
        entry.httpStatus = event.httpStatus;
      }
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut, outputLimited, launchError, response });
    });
  });
  entry.processExitCode = result.code;
  entry.timedOut = result.timedOut;
  entry.signal = result.signal;
  if (result.launchError || result.code !== 0 || result.timedOut || result.outputLimited ||
      !entry.dispatched || entry.httpStatus !== 200 || !result.response) {
    state.stopped = true;
    entry.outcome = "stopped";
    save(state);
    console.error(JSON.stringify({
      key, outcome: "stopped", dispatched: entry.dispatched, httpStatus: entry.httpStatus,
      processExitCode: result.code, timedOut: result.timedOut,
      outputLimited: result.outputLimited, launchError: result.launchError,
      signal: result.signal, requestsDispatched: state.requests.filter((item) => item.dispatched).length,
    }));
    throw new Error("Experiment stopped. No retry or further request will be made.");
  }
  entry.outcome = "success";
  save(state);
  return result.response;
}

async function search(credential) {
  if (existsSync(stateFile)) throw new Error("Experiment record already exists; searches will not be repeated.");
  const state = {
    schemaVersion: 1, origin, sourceCommit: "4628b329fcf8626a592dedad591cca8dbfc79ad5",
    conductedOn: "2026-10-20", budget, defaults: createDefaultInputs().filters,
    guideReuse: { key: "the-guide", entityId: BOOK_GUIDE_ID, evidence: "Previously verified live: The Guide; 1958, R.K. Narayan." },
    requests: [], searches: [], rankings: [], stopped: false,
  };
  save(state);
  for (const plan of buildSearchPlan()) {
    const params = { query: plan.query, types: "urn:entity:" + plan.type, take: 3 };
    const body = await request(state, plan.key, "search", "/search", params,
      ["search", "--query", plan.query, "--type", plan.type, "--take", "3"], credential);
    if (!Array.isArray(body.results) || body.results.length > 3) {
      state.stopped = true; save(state); throw new Error("Unexpected search schema or candidate limit; stopping.");
    }
    state.searches.push({ ...plan, candidates: body.results.map(candidateSummary) });
    save(state);
    console.log(plan.key + ": HTTP 200, " + body.results.length + " candidates; " +
      state.requests.filter((item) => item.dispatched).length + "/15 dispatched");
  }
}

function reviewedResolutions(state) {
  const resolutions = JSON.parse(readFileSync(resolutionFile, "utf8"));
  const plan = buildSearchPlan();
  for (const resolution of resolutions) {
    if (resolution.status !== "resolved") continue;
    if (!resolution.evidence?.trim()) throw new Error("Resolved entity needs reviewed evidence.");
    if (resolution.key === "the-guide" && resolution.entityId === BOOK_GUIDE_ID) continue;
    const search = state.searches.find((item) => item.key === resolution.key);
    const expected = plan.find((item) => item.key === resolution.key);
    if (!search || !expected || !search.candidates.some((item) =>
      item.entity_id?.toLowerCase() === resolution.entityId?.toLowerCase() &&
      item.types?.includes("urn:entity:" + expected.type))) {
      throw new Error("Resolution is not a reviewed candidate from the fixed search.");
    }
  }
  return resolutions;
}

async function rank(credential) {
  const state = load();
  if (state.stopped || state.requests.some((item) => item.kind === "ranking") ||
      state.searches.length !== 13 || state.requests.length !== 13) {
    throw new Error("Ranking requires exactly the completed fixed searches and no prior ranking attempts.");
  }
  const resolutions = reviewedResolutions(state);
  const shortlist = eligibleShortlist(resolutions);
  state.shortlist = shortlist;
  save(state);
  if (shortlist.length < 2) {
    state.rankingSkipped = "Insufficient resolved eligible coverage (fewer than two books).";
    save(state); console.log(state.rankingSkipped); return;
  }
  for (const audience of ["a", "b"]) {
    const selected = ["film", "artist"].map((role) =>
      resolutions.find((item) => item.key === "audience-" + audience + "-" + role && item.status === "resolved"));
    if (selected.some((item) => !item?.entityId)) {
      state.rankings.push({ audience: audience.toUpperCase(), skipped: "Audience seed unresolved." });
      save(state); continue;
    }
    const params = rankingParams(shortlist, selected.map((item) => item.entityId));
    const body = await request(state, "audience-" + audience, "ranking", "/v2/insights", params,
      ["insights", "--type", "book", "--signal-entities", params["signal.interests.entities"],
        "--take", String(params.take), "--params", JSON.stringify({
          "filter.results.entities": params["filter.results.entities"],
          "sort_by": params.sort_by, "feature.explainability": params["feature.explainability"],
        })], credential);
    const entities = body.results?.entities;
    if (!Array.isArray(entities)) {
      state.stopped = true; save(state); throw new Error("Unexpected ranking response schema.");
    }
    let membership;
    try {
      membership = verifyMembership(entities, shortlist);
    } catch {
      state.stopped = true;
      state.rankings.push({ audience: audience.toUpperCase(), params,
        entities: entities.map(rankingSummary), membershipViolation: true });
      save(state);
      throw new Error("Returned shortlist membership failed; no further ranking call.");
    }
    const ranking = {
      audience: audience.toUpperCase(), params, entities: entities.map(rankingSummary),
      missing: membership.missing,
    };
    // CLI stdout omits these envelope fields; capture them from the same response.
    if (Object.hasOwn(body, "query")) ranking.query = body.query;
    for (const key of ["warning", "warnings"]) {
      if (Object.hasOwn(body, key)) ranking[key] = body[key];
    }
    state.rankings.push(ranking);
    save(state);
    console.log("Audience " + audience.toUpperCase() + ": HTTP 200, " + entities.length +
      " shortlist members; " + state.requests.filter((item) => item.dispatched).length + "/15 dispatched");
  }
}

function verify() {
  const state = load();
  if (state.requests.length > budget) throw new Error("Request budget exceeded.");
  if (new Set(state.requests.map((entry) => entry.key)).size !== state.requests.length) {
    throw new Error("Repeated request key.");
  }
  const resolutions = reviewedResolutions(state);
  const shortlist = eligibleShortlist(resolutions);
  for (const ranking of state.rankings.filter((item) => !item.skipped)) {
    verifyMembership(ranking.entities, shortlist);
    if (ranking.params["filter.results.entities"] !== shortlist.map((item) => item.entityId).join(",")) {
      throw new Error("Ranking candidate set changed.");
    }
  }
  console.log(JSON.stringify({
    offlineInvariantVerification: "PASS", reservedRequests: state.requests.length,
    dispatchedRequests: state.requests.filter((item) => item.dispatched).length,
    eligibleResolvedBooks: shortlist.length, rankingAudiences: state.rankings.map((item) => item.audience),
    stopped: state.stopped,
  }));
}

export async function runFeasibility(command) {
  if (command === "verify") { verify(); return; }
  if (!["search", "rank"].includes(command)) {
    console.log("Manual experiment: npm run qloo:feasibility -- search | rank | verify");
    console.log("Search: fixed 13 calls. Review minimal candidates into docs/qloo-feasibility-resolutions.json.");
    console.log("Rank: at most two calls with the same eligible shortlist. Verify: zero network.");
    return;
  }
  const credential = await readCredential(process.env, new URL(".env.local", root));
  if (!credential) { console.log("Qloo credentials not configured; zero requests."); return; }
  if (command === "search") await search(credential);
  else await rank(credential);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runFeasibility(process.argv[2]); }
  catch {
    console.error("Feasibility experiment did not complete. Inspect the sanitized local record; no automatic retry.");
    process.exitCode = 1;
  }
}
