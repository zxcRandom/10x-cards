/**
 * DecksPage - Page Object Model
 * 
 * Encapsulates interactions with the decks list page.
 * Provides methods for viewing, creating, editing, and deleting decks.
 */

import type { Page, Locator } from '@playwright/test';

export class DecksPage {
  readonly page: Page;
  
  // Locators - Page elements
  readonly pageTitle: Locator;
  readonly pageDescription: Locator;
  readonly createDeckButton: Locator;
  readonly searchInput: Locator;
  readonly sortSelect: Locator;
  readonly deckCards: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;
  readonly errorMessage: Locator;
  
  // Locators - Pagination
  readonly paginationInfo: Locator;
  readonly previousButton: Locator;
  readonly nextButton: Locator;
  
  // Locators - Dialogs
  readonly createDialog: Locator;
  readonly editDialog: Locator;
  readonly deleteDialog: Locator;
  
  constructor(page: Page) {
    this.page = page;
    
    // Page elements
    this.pageTitle = page.getByRole('heading', { name: /moje talie/i, level: 1 });
    this.pageDescription = page.getByText(/zarządzaj swoimi taliami/i);
    this.createDeckButton = page.getByRole('button', { name: /stwórz nową talię/i });
    this.searchInput = page.getByPlaceholder(/szukaj talii/i);
    this.sortSelect = page.getByRole('combobox', { name: /sortuj/i });
    this.deckCards = page.getByTestId('deck-card');
    this.emptyState = page.getByText(/nie masz jeszcze żadnych talii/i);
    this.loadingSpinner = page.locator('.animate-spin');
    this.errorMessage = page.getByText(/wystąpił błąd/i);
    
    // Pagination
    this.paginationInfo = page.getByText(/wyświetlanie/i);
    this.previousButton = page.getByRole('button', { name: /poprzednia/i });
    this.nextButton = page.getByRole('button', { name: /następna/i });
    
    // Dialogs (will be visible when opened)
    this.createDialog = page.getByRole('dialog').filter({ hasText: /utwórz nową talię/i });
    this.editDialog = page.getByRole('dialog').filter({ hasText: /edytuj talię/i });
    this.deleteDialog = page.getByRole('dialog').filter({ hasText: /usuń talię/i });
  }
  
  /**
   * Navigate to decks page
   */
  async goto() {
    await this.page.goto('/decks');
  }
  
  /**
   * Click create deck button to open dialog
   */
  async clickCreateDeck() {
    await this.createDeckButton.click();
  }
  
  /**
   * Search for decks by name
   */
  async search(query: string) {
    await this.searchInput.fill(query);
  }
  
  /**
   * Change sort order
   */
  async changeSort(option: string) {
    await this.sortSelect.selectOption(option);
  }
  
  /**
   * Get all deck cards
   */
  getDeckCards(): Locator {
    return this.deckCards;
  }
  
  /**
   * Get deck card by name
   */
  getDeckCardByName(name: string): Locator {
    return this.deckCards.filter({ hasText: name });
  }
  
  /**
   * Click on a deck card to view details
   */
  async clickDeck(name: string) {
    await this.getDeckCardByName(name).click();
  }
  
  /**
   * Click edit button on a specific deck
   */
  async clickEditDeck(deckName: string) {
    const deckCard = this.getDeckCardByName(deckName);
    await deckCard.getByRole('button', { name: /edytuj/i }).click();
  }
  
  /**
   * Click delete button on a specific deck
   */
  async clickDeleteDeck(deckName: string) {
    const deckCard = this.getDeckCardByName(deckName);
    await deckCard.getByRole('button', { name: /usuń/i }).click();
  }
  
  /**
   * Get count of displayed decks
   */
  async getDeckCount(): Promise<number> {
    return await this.deckCards.count();
  }
  
  /**
   * Check if empty state is visible
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }
  
  /**
   * Check if loading
   */
  async isLoading(): Promise<boolean> {
    return await this.loadingSpinner.isVisible();
  }
  
  /**
   * Check if error is displayed
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }
  
  /**
   * Navigate to next page
   */
  async goToNextPage() {
    await this.nextButton.click();
  }
  
  /**
   * Navigate to previous page
   */
  async goToPreviousPage() {
    await this.previousButton.click();
  }
  
  /**
   * Check if next button is enabled
   */
  async canGoToNextPage(): Promise<boolean> {
    return await this.nextButton.isEnabled();
  }
  
  /**
   * Check if previous button is enabled
   */
  async canGoToPreviousPage(): Promise<boolean> {
    return await this.previousButton.isEnabled();
  }
}
