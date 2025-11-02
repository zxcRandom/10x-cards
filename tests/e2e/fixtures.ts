/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect, type Page } from "@playwright/test";

/**
 * E2E test fixture with pre-authenticated user
 * Uses storageState from global.setup.ts - no need to login for each test!
 *
 * Usage:
 * - For authenticated tests: test('should do something', async ({ authenticatedPage }) => { ... })
 * - For public tests: test.use({ storageState: undefined }); test('public test', async ({ page }) => { ... })
 */

interface TestFixtures {
  authenticatedPage: Page;
}

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Authentication already handled by global.setup.ts via storageState
    // No login needed here - just use the authenticated page!
    await use(page);
  },
});

export { expect };
