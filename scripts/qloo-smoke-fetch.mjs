// The official harness uses the issuer-assigned origin and X-Api-Key authentication.
// This diagnostic-only preload enforces one request, including redirects.
export function createSingleSearchFetch(fetchImplementation) {
  let used = false;
  return async (input, init = {}) => {
    const target = new URL(input);
    if (
      used || target.origin !== "https://hackathon.api.qloo.com" ||
      target.pathname !== "/search" || target.username || target.password || target.hash ||
      init.method !== "GET" || [...target.searchParams].length !== 3 ||
      target.searchParams.get("query") !== "The Guide" ||
      target.searchParams.get("take") !== "3" ||
      target.searchParams.get("types") !== "urn:entity:book"
    ) {
      throw new Error("AfterHours diagnostic blocked an unexpected or additional request.");
    }
    used = true;
    return fetchImplementation(input, { ...init, redirect: "manual" });
  };
}

if (process.env.AFTERHOURS_QLOO_SMOKE_GUARD === "1") {
  globalThis.fetch = createSingleSearchFetch(globalThis.fetch);
}
