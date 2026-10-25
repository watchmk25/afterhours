import { test as base } from "@playwright/test";
import { installProtectedPreviewTransport, protectedPreview } from "./support/protected-preview";

export { expect } from "@playwright/test";
export type { Locator, Page, Route } from "@playwright/test";

export const test = base.extend({
  context: async ({ context }, runWithContext) => {
    await installProtectedPreviewTransport(context, protectedPreview());
    await runWithContext(context);
  },
});
