import type { UsageAdmission, UsageRejection } from "./usage-control.ts";

const cancelled = (): UsageRejection => ({ status: 499, code: "REQUEST_CANCELLED", message: "The live request was cancelled. Your current event edits are unchanged." });

/** Admission is mandatory; this wrapper never falls back to unguarded work. */
export async function runWithUsage<T>(admit: () => Promise<UsageAdmission>, signal: AbortSignal, work: () => Promise<T>): Promise<
  { ok: true; value: T } | { ok: false; error: UsageRejection; workStarted?: true }
> {
  if (signal.aborted) return { ok: false, error: cancelled() };
  let admission: UsageAdmission;
  try { admission = await admit(); }
  catch { return { ok: false, error: { status: 503, code: "USAGE_UNAVAILABLE", message: "Shared usage controls are unavailable. No live work was started. Try again later; local browsing and event edits remain available." } }; }
  if (!admission.ok) return admission;
  let workStarted = false;
  const interruptedResult = () => ({ ok: false as const, error: cancelled(), ...(workStarted ? { workStarted: true as const } : {}) });
  let onAbort: (() => void) | undefined;
  const interruption = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(cancelled());
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    if (signal.aborted) return interruptedResult();
    workStarted = true;
    const value = await Promise.race([work(), interruption]);
    return signal.aborted ? interruptedResult() : { ok: true, value };
  } catch (error) {
    if (signal.aborted) return interruptedResult();
    throw error;
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
    // A fresh store deadline in release is independent of this aborted request.
    await admission.release();
  }
}
