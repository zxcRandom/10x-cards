/**
 * Global Setup for E2E Tests
 *
 * Runs before all tests to prepare the test environment.
 * Authenticates once and saves session to .auth/user.json for reuse.
 */

import { test as setup } from "@playwright/test";
import { LoginPage } from "./e2e/page-objects/LoginPage";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, "../.auth/user.json");

setup("authenticate", async ({ page }) => {
  console.log("� Authenticating test user...");

  const email = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_USERNAME and E2E_PASSWORD must be set in .env.test");
  }

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);
  await loginPage.waitForRedirect("/");

  // Save authentication state
  await page.context().storageState({ path: authFile });

  console.log("✅ Authentication successful, saved to", authFile);
});
