/**
 * StudyPage - Page Object Model
 *
 * Encapsulates interactions with the study session page.
 * Provides methods for reviewing flashcards and submitting grades.
 */

import type { Page, Locator } from "@playwright/test";

export class StudyPage {
  readonly page: Page;

  // Locators - Progress
  readonly cardProgress: Locator;
  readonly reviewedCount: Locator;

  // Locators - Card
  readonly questionCard: Locator;
  readonly answerCard: Locator;
  readonly showAnswerButton: Locator;

  // Locators - Review Controls (visible after showing answer)
  readonly againButton: Locator;
  readonly hardButton: Locator;
  readonly goodButton: Locator;
  readonly easyButton: Locator;

  // Locators - States
  readonly loadingSpinner: Locator;
  readonly emptyState: Locator;
  readonly errorState: Locator;
  readonly retryButton: Locator;

  // Locators - Session Summary (shown when done)
  readonly summaryTitle: Locator;
  readonly summaryStats: Locator;
  readonly backToDecksButton: Locator;
  readonly studyAgainButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Progress indicators
    this.cardProgress = page.getByText(/karta \d+ z \d+/i);
    this.reviewedCount = page.getByText(/oceniono: \d+/i);

    // Card display
    this.questionCard = page.getByTestId("question-card");
    this.answerCard = page.getByTestId("answer-card");
    this.showAnswerButton = page.getByRole("button", { name: /pokaż odpowiedź/i });

    // Review grade buttons (1-4 for Again, Hard, Good, Easy)
    this.againButton = page.getByRole("button", { name: /ponownie/i });
    this.hardButton = page.getByRole("button", { name: /trudne/i });
    this.goodButton = page.getByRole("button", { name: /dobrze/i });
    this.easyButton = page.getByRole("button", { name: /łatwe/i });

    // Loading and error states
    this.loadingSpinner = page.locator(".animate-spin");
    this.emptyState = page.getByText(/brak fiszek do nauki/i);
    this.errorState = page.getByText(/wystąpił błąd/i);
    this.retryButton = page.getByRole("button", { name: /spróbuj ponownie/i });

    // Session summary
    this.summaryTitle = page.getByRole("heading", { name: /sesja zakończona/i });
    this.summaryStats = page.getByTestId("session-stats");
    this.backToDecksButton = page.getByRole("button", { name: /powrót do talii/i });
    this.studyAgainButton = page.getByRole("button", { name: /ucz się ponownie/i });
  }

  /**
   * Navigate to study page for specific deck
   */
  async goto(deckId: string) {
    await this.page.goto(`/decks/${deckId}/study`);
  }

  /**
   * Click show answer button
   */
  async showAnswer() {
    await this.showAnswerButton.click();
  }

  /**
   * Submit grade: Again (1)
   */
  async gradeAgain() {
    await this.againButton.click();
  }

  /**
   * Submit grade: Hard (2)
   */
  async gradeHard() {
    await this.hardButton.click();
  }

  /**
   * Submit grade: Good (3)
   */
  async gradeGood() {
    await this.goodButton.click();
  }

  /**
   * Submit grade: Easy (4)
   */
  async gradeEasy() {
    await this.easyButton.click();
  }

  /**
   * Get current card question text
   */
  async getQuestionText(): Promise<string | null> {
    return await this.questionCard.textContent();
  }

  /**
   * Get current card answer text
   */
  async getAnswerText(): Promise<string | null> {
    if (await this.answerCard.isVisible()) {
      return await this.answerCard.textContent();
    }
    return null;
  }

  /**
   * Get current progress (e.g., "Karta 1 z 10")
   */
  async getProgress(): Promise<string | null> {
    return await this.cardProgress.textContent();
  }

  /**
   * Get reviewed count
   */
  async getReviewedCount(): Promise<number> {
    const text = await this.reviewedCount.textContent();
    const match = text?.match(/oceniono: (\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Check if answer is visible
   */
  async isAnswerVisible(): Promise<boolean> {
    return await this.answerCard.isVisible();
  }

  /**
   * Check if review controls are visible
   */
  async areReviewControlsVisible(): Promise<boolean> {
    return await this.againButton.isVisible();
  }

  /**
   * Check if loading
   */
  async isLoading(): Promise<boolean> {
    return await this.loadingSpinner.isVisible();
  }

  /**
   * Check if empty state is shown
   */
  async isEmptyState(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  /**
   * Check if error state is shown
   */
  async isErrorState(): Promise<boolean> {
    return await this.errorState.isVisible();
  }

  /**
   * Click retry button (in error state)
   */
  async retry() {
    await this.retryButton.click();
  }

  /**
   * Check if session is complete (summary visible)
   */
  async isSessionComplete(): Promise<boolean> {
    return await this.summaryTitle.isVisible();
  }

  /**
   * Get session summary statistics
   */
  async getSummaryStats(): Promise<string | null> {
    if (await this.summaryStats.isVisible()) {
      return await this.summaryStats.textContent();
    }
    return null;
  }

  /**
   * Click back to decks button (from summary)
   */
  async backToDecks() {
    await this.backToDecksButton.click();
  }

  /**
   * Click study again button (from summary)
   */
  async studyAgain() {
    await this.studyAgainButton.click();
  }

  /**
   * Complete a full review cycle: show answer and grade
   */
  async reviewCard(grade: "again" | "hard" | "good" | "easy") {
    await this.showAnswer();

    switch (grade) {
      case "again":
        await this.gradeAgain();
        break;
      case "hard":
        await this.gradeHard();
        break;
      case "good":
        await this.gradeGood();
        break;
      case "easy":
        await this.gradeEasy();
        break;
    }
  }
}
