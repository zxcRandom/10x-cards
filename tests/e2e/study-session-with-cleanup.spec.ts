/**
 * Study Session E2E Tests with Cleanup
 *
 * Tests full study session flow:
 * 1. Generate AI deck with cards
 * 2. Navigate to study session
 * 3. Review cards with different grades
 * 4. Complete session
 * 5. Cleanup in afterEach
 */

import { test, expect } from "./fixtures";
import { AIGeneratorPage } from "./page-objects";

test.describe("Study Session with Cleanup", () => {
  // Increase timeout for AI generation + study session (can take 90s+)
  test.setTimeout(120000); // 2 minutes

  // Mark as slow test (3x timeout)
  test.slow();

  let createdDeckId: string | null = null;

  test.afterEach(async ({ authenticatedPage }) => {
    // Cleanup: Delete created deck if exists
    if (createdDeckId) {
      const response = await authenticatedPage.request.delete(`/api/v1/decks/${createdDeckId}`);
      expect(response.ok()).toBeTruthy();
      console.log(`Cleaned up deck: ${createdDeckId}`);
      createdDeckId = null;
    }
  });

  test("@slow can complete study session with various grades", async ({ authenticatedPage }) => {
    // STEP 1: Generate a small deck with AI
    const generatorPage = new AIGeneratorPage(authenticatedPage);
    await authenticatedPage.goto("/");

    const studyText = `
      Spaced repetition is a learning technique that incorporates increasing intervals of time 
      between subsequent review of previously learned material to exploit the psychological 
      spacing effect.
      
      The SM-2 algorithm is a popular spaced repetition algorithm used by many flashcard 
      applications. It uses grades from 0 to 5 to adjust review intervals.
      
      Active recall is a principle of efficient learning which involves actively stimulating 
      memory during the learning process.
    `.trim();

    await generatorPage.fillInputText(studyText);
    await generatorPage.fillDeckName("Study Test Deck");
    await generatorPage.fillMaxCards(3);

    // Small delay to ensure form is fully filled
    await authenticatedPage.waitForTimeout(500);

    // Generate and wait for review page
    await Promise.all([
      authenticatedPage.waitForURL(/\/generate\/review\?deckId=.+/, { timeout: 60000 }),
      generatorPage.clickGenerate(),
    ]);

    // Extract deck ID
    const reviewUrl = authenticatedPage.url();
    const match = reviewUrl.match(/deckId=([^&]+)/);
    expect(match).toBeTruthy();
    createdDeckId = match![1];
    console.log(`Created deck for study: ${createdDeckId}`);

    // STEP 2: Navigate to study session
    await authenticatedPage.goto(`/decks/${createdDeckId}/study`);

    // Wait for study page to load
    await authenticatedPage.waitForSelector("text=Sesja nauki", { timeout: 10000 });

    // STEP 3: Review cards with different grades
    // We'll review 3 cards with grades: 4 (good), 2 (hard), 5 (perfect)
    const grades = [4, 2, 5];

    for (let i = 0; i < grades.length; i++) {
      const grade = grades[i];

      // Wait for card question to be visible
      await authenticatedPage.waitForSelector("text=Pytanie", { timeout: 5000 });

      // Reveal answer by clicking "Pokaż odpowiedź" button
      const showAnswerBtn = authenticatedPage.locator('button:has-text("Pokaż odpowiedź")');
      await showAnswerBtn.click();

      // Wait for answer to be visible
      await authenticatedPage.waitForSelector("text=Odpowiedź", { timeout: 3000 });

      // Click the grade button
      const gradeButton = authenticatedPage.locator(`button:has-text("${grade}")`);
      await gradeButton.click();

      // Wait for review to be submitted (200 response)
      await authenticatedPage.waitForResponse(
        (response) => response.url().includes("/review") && response.status() === 200,
        { timeout: 5000 }
      );

      console.log(`Reviewed card ${i + 1} with grade ${grade}`);

      // Small delay between cards
      await authenticatedPage.waitForTimeout(500);
    }

    // STEP 4: Verify completion screen
    await authenticatedPage.waitForSelector("text=Gratulacje", { timeout: 10000 });

    // Check statistics
    const statsText = await authenticatedPage.textContent("body");
    expect(statsText).toContain("Ocenione karty:");
    expect(statsText).toContain("Średnia ocena:");

    console.log("Study session completed successfully");
  });

  test("@slow can navigate between cards and complete session", async ({ authenticatedPage }) => {
    // STEP 1: Generate deck
    const generatorPage = new AIGeneratorPage(authenticatedPage);
    await authenticatedPage.goto("/");

    const mathText = `
      Algebra is a branch of mathematics dealing with symbols and the rules for manipulating 
      those symbols. In elementary algebra, those symbols represent quantities without fixed values.
      
      Geometry is a branch of mathematics concerned with questions of shape, size, relative 
      position of figures, and the properties of space.
    `.trim();

    await generatorPage.fillInputText(mathText);
    await generatorPage.fillDeckName("Math Test Deck");
    await generatorPage.fillMaxCards(2);

    await Promise.all([
      authenticatedPage.waitForURL(/\/generate\/review\?deckId=.+/, { timeout: 60000 }),
      generatorPage.clickGenerate(),
    ]);

    const reviewUrl = authenticatedPage.url();
    const match = reviewUrl.match(/deckId=([^&]+)/);
    createdDeckId = match![1];
    console.log(`Created math deck: ${createdDeckId}`);

    // STEP 2: Go to study
    await authenticatedPage.goto(`/decks/${createdDeckId}/study`);
    await authenticatedPage.waitForSelector("text=Sesja nauki", { timeout: 10000 });

    // STEP 3: Review first card
    await authenticatedPage.waitForSelector("text=Pytanie", { timeout: 5000 });

    // Check card counter (should show "Karta 1 z 2" or similar)
    const cardCounter = await authenticatedPage.textContent("body");
    expect(cardCounter).toMatch(/karta\s+1/i);

    // Show answer and grade with "Bardzo łatwe" (5)
    await authenticatedPage.click('button:has-text("Pokaż odpowiedź")');
    await authenticatedPage.waitForSelector("text=Odpowiedź", { timeout: 3000 });

    // Click grade 5 (Bardzo łatwe)
    await authenticatedPage.click('button:has-text("5")');
    await authenticatedPage.waitForResponse(
      (response) => response.url().includes("/review") && response.status() === 200
    );

    console.log("Reviewed first card with grade 5");

    // STEP 4: Review second card
    await authenticatedPage.waitForSelector("text=Pytanie", { timeout: 5000 });

    // Show answer and grade with "Dobrze" (4)
    await authenticatedPage.click('button:has-text("Pokaż odpowiedź")');
    await authenticatedPage.waitForSelector("text=Odpowiedź", { timeout: 3000 });

    await authenticatedPage.click('button:has-text("4")');
    await authenticatedPage.waitForResponse(
      (response) => response.url().includes("/review") && response.status() === 200
    );

    console.log("Reviewed second card with grade 4");

    // STEP 5: Check completion
    await authenticatedPage.waitForSelector("text=Gratulacje", { timeout: 10000 });

    const completionText = await authenticatedPage.textContent("body");
    expect(completionText).toContain("Ukończyłeś sesję nauki");
    expect(completionText).toContain("Ocenione karty:");

    console.log("Study session completed with 2 cards");
  });
});
