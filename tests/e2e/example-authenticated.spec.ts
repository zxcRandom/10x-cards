/**
 * Example E2E Test - Authenticated User
 *
 * This test demonstrates using the authenticated fixture.
 * User is automatically logged in before the test runs.
 */

import { test, expect } from "./fixtures";
import { DecksPage } from "./page-objects";

test.describe("Authenticated User Tests", () => {
  test("can access decks page when authenticated", async ({ authenticatedPage }) => {
    const decksPage = new DecksPage(authenticatedPage);

    // User is already logged in via fixture
    await decksPage.goto();

    // Verify we're on the decks page
    await expect(decksPage.pageTitle).toBeVisible();
    await expect(authenticatedPage).toHaveURL("/decks");
  });

  test("can see create deck button", async ({ authenticatedPage }) => {
    const decksPage = new DecksPage(authenticatedPage);

    await decksPage.goto();

    // Verify create button is available
    await expect(decksPage.createDeckButton).toBeVisible();
    await expect(decksPage.createDeckButton).toBeEnabled();
  });
});
