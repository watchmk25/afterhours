import { defineConfig } from "@playwright/test";

const suppliedBaseURL = process.env.PLAYWRIGHT_BASE_URL;

function getBaseURL() {
  if (suppliedBaseURL === undefined) return "http://localhost:3000";

  let target: URL;
  try {
    target = new URL(suppliedBaseURL);
  } catch {
    throw new Error("PLAYWRIGHT_BASE_URL must be an absolute HTTP(S) app origin.");
  }

  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
  if (
    (target.protocol !== "https:" && !(target.protocol === "http:" && isLoopback)) ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search ||
    target.hash
  ) {
    throw new Error(
      "PLAYWRIGHT_BASE_URL must be an HTTPS app origin without credentials, a path, query, or fragment. " +
        "HTTP is allowed only for a loopback host.",
    );
  }
  return target.origin;
}

const baseURL = getBaseURL();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: { mode: "only-on-failure", fullPage: true },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  // An explicitly supplied target is never replaced by a local server.
  webServer:
    suppliedBaseURL === undefined
      ? {
          command: "npm run dev -- --hostname localhost --port 3000",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
        }
      : undefined,
});
