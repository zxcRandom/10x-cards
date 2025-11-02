/**
 * Authentication E2E Tests
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "./page-objects";

// Reset storage state to test login flow without pre-authenticated session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication", () => {
  test("user can login with valid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);

    const username = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;

    if (!username || !password) {
      throw new Error("E2E credentials not found in environment variables");
    }

    await loginPage.goto();
    await loginPage.login(username, password);

    await loginPage.waitForRedirect("/");
    await expect(page).toHaveURL("/");
  });
});
