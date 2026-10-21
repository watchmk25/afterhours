import { createHmac } from "node:crypto";
import { isIP } from "node:net";

/** Only Vercel's server-confirmed runtime may trust its platform-owned IP header. */
export function usageVisitor(request: Request, environment: {
  VERCEL?: string;
  AFTERHOURS_USAGE_SECRET?: string;
}, now = Date.now()): string | null {
  const secret = environment.AFTERHOURS_USAGE_SECRET;
  if (environment.VERCEL !== "1" || !secret || secret.trim() !== secret || secret.length < 32 ||
    secret.length > 512 || /[\u0000-\u0020\u007f]/u.test(secret) || !Number.isFinite(now)) return null;
  const address = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (!address || address.length > 64 || !isIP(address)) return null;
  // Canonicalize equivalent IPv6 spelling without DNS or persisting the address.
  let normalized = address;
  if (isIP(address) === 6) {
    try { normalized = new URL(`http://[${address}]`).hostname.toLowerCase(); }
    catch { return null; }
  }
  const day = Math.floor(now / 86_400_000);
  return createHmac("sha256", secret).update(`afterhours-visitor-v1:${day}:${normalized}`).digest("hex");
}
