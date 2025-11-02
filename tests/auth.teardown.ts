/**
 * Global Teardown for E2E Tests
 *
 * Runs after all tests to clean up the test environment.
 */

import { test as teardown } from "@playwright/test";

teardown("cleanup test environment", async ({ request }) => {
  // eslint-disable-next-line no-console
  console.log("🧹 Cleaning up test environment...");

  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // eslint-disable-next-line no-console
    console.warn("⚠️  Supabase credentials not found, skipping cleanup");
    return;
  }

  try {
    // Clean up any test decks created during tests
    // Look for decks with test-related names
    const testDeckPatterns = [
      "Test Deck",
      "ML Deck",
      "History Deck",
      "Math Deck",
      "Science Deck",
      "Programming Deck",
      "Deck with Long Description",
    ];

    // eslint-disable-next-line no-console
    console.log("🔍 Searching for test decks to clean up...");

    // Get authentication token
    const email = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;

    if (!email || !password) {
      // eslint-disable-next-line no-console
      console.warn("⚠️  Test credentials not found, skipping cleanup");
      return;
    }

    // Login to get auth token
    const loginResponse = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json",
      },
      data: {
        email,
        password,
      },
    });

    if (!loginResponse.ok()) {
      // eslint-disable-next-line no-console
      console.warn("⚠️  Failed to authenticate for cleanup");
      return;
    }

    const authData = await loginResponse.json();
    const accessToken = authData.access_token;

    // Fetch user's decks
    const decksResponse = await request.get(`${supabaseUrl}/rest/v1/decks?select=id,name`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!decksResponse.ok()) {
      // eslint-disable-next-line no-console
      console.warn("⚠️  Failed to fetch decks for cleanup");
      return;
    }

    const decks = await decksResponse.json();
    let cleanedCount = 0;

    // Delete decks matching test patterns
    for (const deck of decks) {
      const isTestDeck = testDeckPatterns.some((pattern) => deck.name?.includes(pattern));

      if (isTestDeck) {
        const deleteResponse = await request.delete(`${supabaseUrl}/rest/v1/decks?id=eq.${deck.id}`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (deleteResponse.ok()) {
          // eslint-disable-next-line no-console
          console.log(`  ✓ Deleted test deck: ${deck.name} (${deck.id})`);
          cleanedCount++;
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(`✨ Cleanup complete! Removed ${cleanedCount} test deck(s)`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("❌ Error during cleanup:", error);
    // Don't fail the test run if cleanup fails
  }
});
