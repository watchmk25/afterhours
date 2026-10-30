import "server-only";

/** Fail closed; evaluate at request time rather than capturing a build-time value. */
export function liveWorkEnabled(): boolean {
  return process.env.AFTERHOURS_LIVE_ENABLED === "true";
}
