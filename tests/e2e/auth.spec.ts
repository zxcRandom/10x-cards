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

    await loginPage.goto();
    await loginPage.login(process.env.E2E_USERNAME!, process.env.E2E_PASSWORD!);

    await loginPage.waitForRedirect("/");
    await expect(page).toHaveURL("/");
  });
});
