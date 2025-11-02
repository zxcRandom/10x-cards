/**
 * AI Generation E2E Tests with Cleanup
 * 
 * Tests that create decks with AI and clean them up afterwards.
 * Uses afterEach hook for cleanup.
 */

import { test, expect } from './fixtures';
import { AIGeneratorPage } from './page-objects';

test.describe('AI Flashcard Generation with Cleanup', () => {
  // Increase timeout for AI generation tests (can take 60s+)
  test.setTimeout(120000); // 2 minutes
  
  // Mark as slow test (3x timeout)
  test.slow();
  
  let createdDeckId: string | null = null;
  
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
  });
  
  test.afterEach(async ({ authenticatedPage }) => {
    // Cleanup: Delete created deck if exists
    if (createdDeckId) {
      const response = await authenticatedPage.request.delete(`/api/v1/decks/${createdDeckId}`);
      expect(response.ok()).toBeTruthy();
      console.log(`Cleaned up deck: ${createdDeckId}`);
      createdDeckId = null;
    }
  });
  
  test('@slow can generate ML deck and review cards', async ({ authenticatedPage }) => {
    const generatorPage = new AIGeneratorPage(authenticatedPage);
    
    // Generate flashcards about Machine Learning
    const mlText = `
      Machine learning is a subset of artificial intelligence that focuses on the development 
      of algorithms that allow computers to learn from and make predictions based on data.
      
      Neural networks are used for deep learning, which is a type of machine learning that 
      mimics the way human brains operate to process data and create patterns for decision-making.
      
      Deep learning is a subset of machine learning that uses neural networks with many layers 
      (deep architectures) to analyze various factors of data.
      
      Artificial intelligence (AI) is a broader concept that encompasses any technique enabling 
      computers to mimic human behavior, while machine learning is a specific approach within AI 
      that focuses on learning from data.
    `.trim();
    
    await generatorPage.fillInputText(mlText);
    await generatorPage.fillDeckName('ML Deck');
    await generatorPage.fillMaxCards(5);
    
    // Click generate and wait for navigation
    await Promise.all([
      authenticatedPage.waitForURL(/\/generate\/review\?deckId=.+/, { timeout: 60000 }),
      generatorPage.clickGenerate(),
    ]);
    
    // Extract deck ID from URL
    const url = authenticatedPage.url();
    const match = url.match(/deckId=([^&]+)/);
    expect(match).toBeTruthy();
    createdDeckId = match![1];
    
    console.log(`Created deck with ID: ${createdDeckId}`);
    
    // Simply verify we're on the review page
    expect(url).toContain('/generate/review');
  });
});
