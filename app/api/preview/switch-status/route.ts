import { connection } from "next/server";
import { liveWorkEnabled } from "../../../../lib/live-switch.ts";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

/** Switch status only, never provider readiness or an admission/reservation. */
export async function GET() {
  await connection();
  if (process.env.VERCEL_ENV !== "preview") return new Response(null, { status: 404, headers });
  const source = process.env.VERCEL_GIT_COMMIT_SHA;
  return Response.json({
    liveEnabled: liveWorkEnabled(),
    ...(source && /^[a-f0-9]{40}$/iu.test(source) ? { sourceCommit: source } : {}),
  }, { headers });
}
