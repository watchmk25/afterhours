import { request, type FullConfig } from "@playwright/test";
import { fetchProtectedPreview, protectedPreview } from "./support/protected-preview";

// Reject a different app or visitor protection before browser interactions.
// This context deliberately has no existing browser cookies or credentials.
export default async function verifyAfterHours(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  if (!baseURL) {
    throw new Error("AfterHours browser tests require a configured baseURL.");
  }

  const protection = protectedPreview();
  if (protection) {
    if (baseURL !== protection.origin) throw new Error("Protected Preview origin must match the explicit browser target.");
    const response = await fetchProtectedPreview(protection, baseURL, { timeoutMs: 15_000 });
    const html = response.body.toString("utf8");
    if (response.status !== 200 || !/<title>AfterHours\b[^<]*<\/title>/.test(html) ||
      !html.includes('id="workspace"') || !html.includes('id="eligible-books"') || !html.includes('id="event-outline"')) {
      throw new Error("Protected Preview preflight did not return the AfterHours workspace. Check authorized access and the exact deployment target; no redirect or local fallback was followed.");
    }
    console.log(`Verified authorized protected AfterHours Preview: ${protection.origin}`);
    return;
  }

  const isDefaultLocalTarget = process.env.PLAYWRIGHT_BASE_URL === undefined;
  const client = await request.newContext({
    storageState: { cookies: [], origins: [] },
    ignoreHTTPSErrors: false,
  });
  try {
    const response = await client
      .get(baseURL, { timeout: 15_000, maxRedirects: 0 })
      .catch(() => {
        throw new Error(
          `Cannot reach the AfterHours test target at ${baseURL} within the anonymous-access preflight. ` +
            (isDefaultLocalTarget
              ? "Inspect the existing server and any Next.js startup or lock errors before rerunning."
              : "Check availability, TLS, and visitor access. No local fallback was started."),
        );
      });
    if ([401, 403].includes(response.status())) {
      throw new Error(
        `Anonymous access blocked: ${baseURL} returned HTTP ${response.status()}. ` +
          "Disable visitor authentication for the intended sample deployment before testing.",
      );
    }
    if (response.status() >= 300 && response.status() < 400) {
      throw new Error(
        `Anonymous-access preflight blocked by HTTP ${response.status()} redirect at ${baseURL}. ` +
          "Use the final public app origin and check visitor authentication. Redirects were not followed.",
      );
    }
    const html = await response.text();
    const isAfterHours =
      response.ok() &&
      /<title>AfterHours\b[^<]*<\/title>/.test(html) &&
      html.includes('id="workspace"') &&
      html.includes('id="eligible-books"') &&
      html.includes('id="event-outline"');

    if (!isAfterHours) {
      throw new Error(
        `${isDefaultLocalTarget ? "Port conflict or wrong application" : "Wrong application or visitor protection"}: ` +
          `${baseURL} returned HTTP ${response.status()} without the AfterHours workspace. ` +
          (isDefaultLocalTarget
            ? "Inspect the existing server before running tests. No process was killed and no Next.js lock was deleted."
            : "Check the deployment and anonymous access before running tests. No local fallback was started."),
      );
    }

    console.log(`Verified AfterHours test target: ${baseURL}`);
  } finally {
    await client.dispose();
  }
}
