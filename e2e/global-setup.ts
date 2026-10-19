import { request, type FullConfig } from "@playwright/test";

// Playwright's webServer can reuse any responding process on the port.
// Reject a different app before sending browser interactions to that process.
export default async function verifyAfterHours(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  if (baseURL !== "http://localhost:3000") {
    throw new Error("AfterHours browser tests require http://localhost:3000.");
  }

  const client = await request.newContext();
  try {
    const response = await client.get(baseURL, {
      timeout: 15_000,
      maxRedirects: 0,
    });
    const html = await response.text();
    const isAfterHours =
      response.ok() &&
      /<title>AfterHours\b[^<]*<\/title>/.test(html) &&
      html.includes('id="workspace"') &&
      html.includes('id="eligible-books"') &&
      html.includes('id="event-outline"');

    if (!isAfterHours) {
      throw new Error(
        `Port conflict or wrong application: ${baseURL} returned HTTP ${response.status()} without the AfterHours workspace. ` +
          "Inspect the existing server before running tests. No process was killed and no Next.js lock was deleted.",
      );
    }

    console.log(`Verified AfterHours test target: ${baseURL}`);
  } finally {
    await client.dispose();
  }
}
