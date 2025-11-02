/**
 * Decks Management E2E Tests
 */

import { test, expect } from "./fixtures";
import { DecksPage } from "./page-objects";

test.describe("Decks Management", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/decks");
  });

  test("displays decks page", async ({ authenticatedPage }) => {
    const decksPage = new DecksPage(authenticatedPage);

    await expect(decksPage.pageTitle).toBeVisible();
    await expect(decksPage.createDeckButton).toBeVisible();
  });
});
