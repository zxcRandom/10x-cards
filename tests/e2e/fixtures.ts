import { test as base, expect, type Page } from '@playwright/test';
import { LoginPage } from './page-objects';

/**
 * E2E test fixture with pre-authenticated user
 * Automatically logs in using credentials from .env.test before each test
 * 
 * Usage: 
 * - For authenticated tests: test('should do something', async ({ page }) => { ... })
 * - For public tests: test.use({ storageState: undefined }); test('public test', async ({ page }) => { ... })
 */

type TestFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Get credentials from environment
    const email = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'E2E_USERNAME and E2E_PASSWORD must be set in .env.test file'
      );
    }

    // Login before test
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, password);
    await loginPage.waitForRedirect('/'); // App redirects to dashboard after login

    // Use the authenticated page
    await use(page);

    // Cleanup after test (optional)
    // Could add logout logic here if needed
  },
});

export { expect };
