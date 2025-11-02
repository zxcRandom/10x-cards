/**
 * AIGeneratorPage - Page Object Model
 *
 * Encapsulates interactions with the AI flashcard generator page.
 * Provides methods for generating flashcards from text using AI.
 */

import type { Page, Locator } from "@playwright/test";

export class AIGeneratorPage {
  readonly page: Page;

  // Locators
  readonly pageTitle: Locator;
  readonly pageDescription: Locator;
  readonly inputTextArea: Locator;
  readonly deckNameInput: Locator;
  readonly maxCardsInput: Locator;
  readonly generateButton: Locator;
  readonly cancelButton: Locator;
  readonly charCounter: Locator;
  readonly privacyNotice: Locator;
  readonly inputTextError: Locator;
  readonly deckNameError: Locator;
  readonly maxCardsError: Locator;
  readonly maxCardsHint: Locator;
  readonly apiError: Locator;
  readonly loadingSpinner: Locator;
  readonly loadingText: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page elements
    this.pageTitle = page.getByRole("heading", { name: /generuj fiszki ai/i });
    this.pageDescription = page.getByText(/wklej tekst, a ai automatycznie/i);

    // Form inputs
    this.inputTextArea = page.getByLabel(/tekst do przetworzenia/i);
    this.deckNameInput = page.getByLabel(/nazwa talii/i);
    this.maxCardsInput = page.getByLabel(/maksymalna liczba kart/i);

    // Buttons
    this.generateButton = page.getByRole("button", { name: /^generuj$/i });
    this.cancelButton = page.getByRole("button", { name: /anuluj/i });

    // Info elements
    this.charCounter = page.locator("text=/\\d+\\/20,000/");
    this.privacyNotice = page.getByText(/treść jest wysyłana do dostawcy ai/i);
    this.maxCardsHint = page.getByText(/od 1 do 100 kart/i);

    // Error messages
    this.inputTextError = page.locator("#input-text-error");
    this.deckNameError = page.locator("#deck-name-error");
    this.maxCardsError = page.locator("#max-cards-error");
    this.apiError = page.locator(".bg-destructive\\/10").getByText(/.*/).first();

    // Loading state
    this.loadingSpinner = page.locator(".animate-spin");
    this.loadingText = page.getByText(/generowanie fiszek/i);
  }

  /**
   * Navigate to AI generator page
   */
  async goto() {
    await this.page.goto("/generate");
  }

  /**
   * Fill input text area
   */
  async fillInputText(text: string) {
    await this.inputTextArea.waitFor({ state: "visible" });
    await this.inputTextArea.click();

    // Clear any existing content first
    await this.inputTextArea.clear();

    // Use pressSequentially to trigger React onChange events properly
    // This is slower but ensures React state updates correctly
    await this.inputTextArea.pressSequentially(text, { delay: 10 });

    // Wait a bit for React to process the input
    await this.page.waitForTimeout(300);
  }

  /**
   * Fill deck name (optional)
   */
  async fillDeckName(name: string) {
    await this.deckNameInput.fill(name);
  }

  /**
   * Fill max cards input
   */
  async fillMaxCards(count: number) {
    await this.maxCardsInput.fill(count.toString());
  }

  /**
   * Click generate button
   */
  async clickGenerate() {
    await this.generateButton.click();
  }

  /**
   * Click cancel button (only visible during generation)
   */
  async clickCancel() {
    await this.cancelButton.click();
  }

  /**
   * Generate flashcards with all parameters
   */
  async generate(text: string, deckName?: string, maxCards?: number) {
    await this.fillInputText(text);
    if (deckName) {
      await this.fillDeckName(deckName);
    }
    if (maxCards) {
      await this.fillMaxCards(maxCards);
    }
    await this.clickGenerate();
  }

  /**
   * Get current character count
   */
  async getCharCount(): Promise<number> {
    const text = await this.charCounter.textContent();
    const match = text?.match(/^([\d,]+)/);
    return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
  }

  /**
   * Get input text error message
   */
  async getInputTextError(): Promise<string | null> {
    if (await this.inputTextError.isVisible()) {
      return await this.inputTextError.textContent();
    }
    return null;
  }

  /**
   * Get deck name error message
   */
  async getDeckNameError(): Promise<string | null> {
    if (await this.deckNameError.isVisible()) {
      return await this.deckNameError.textContent();
    }
    return null;
  }

  /**
   * Get max cards error message
   */
  async getMaxCardsError(): Promise<string | null> {
    if (await this.maxCardsError.isVisible()) {
      return await this.maxCardsError.textContent();
    }
    return null;
  }

  /**
   * Get API error message
   */
  async getApiError(): Promise<string | null> {
    if (await this.apiError.isVisible()) {
      return await this.apiError.textContent();
    }
    return null;
  }

  /**
   * Check if generate button is disabled
   */
  async isGenerateDisabled(): Promise<boolean> {
    return await this.generateButton.isDisabled();
  }

  /**
   * Check if currently generating (loading state)
   */
  async isGenerating(): Promise<boolean> {
    return await this.loadingSpinner.isVisible();
  }

  /**
   * Wait for generation to complete and redirect
   */
  async waitForRedirect() {
    await this.page.waitForURL(/\/generate\/review\?deckId=.+/);
  }

  /**
   * Check if cancel button is visible
   */
  async isCancelVisible(): Promise<boolean> {
    return await this.cancelButton.isVisible();
  }
}
