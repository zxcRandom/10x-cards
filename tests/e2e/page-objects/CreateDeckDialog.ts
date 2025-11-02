/**
 * CreateDeckDialog - Page Object Model
 * 
 * Encapsulates interactions with the create deck dialog.
 * Provides methods for creating new decks.
 */

import type { Page, Locator } from '@playwright/test';

export class CreateDeckDialog {
  readonly page: Page;
  
  // Locators
  readonly dialog: Locator;
  readonly dialogTitle: Locator;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly closeButton: Locator;
  readonly nameError: Locator;
  
  constructor(page: Page) {
    this.page = page;
    
    // Dialog container
    this.dialog = page.getByRole('dialog').filter({ hasText: /utwórz nową talię/i });
    
    // Dialog elements
    this.dialogTitle = this.dialog.getByRole('heading', { name: /utwórz nową talię/i });
    this.nameInput = this.dialog.getByLabel(/nazwa talii/i);
    this.descriptionInput = this.dialog.getByLabel(/opis/i);
    this.submitButton = this.dialog.getByRole('button', { name: /utwórz/i });
    this.cancelButton = this.dialog.getByRole('button', { name: /anuluj/i });
    this.closeButton = this.dialog.getByRole('button', { name: /zamknij/i });
    this.nameError = this.dialog.locator('[role="alert"]').first();
  }
  
  /**
   * Wait for dialog to be visible
   */
  async waitForDialog() {
    await this.dialog.waitFor({ state: 'visible' });
  }
  
  /**
   * Fill deck name
   */
  async fillName(name: string) {
    await this.nameInput.fill(name);
  }
  
  /**
   * Fill deck description
   */
  async fillDescription(description: string) {
    await this.descriptionInput.fill(description);
  }
  
  /**
   * Submit form
   */
  async submit() {
    await this.submitButton.click();
  }
  
  /**
   * Cancel dialog
   */
  async cancel() {
    await this.cancelButton.click();
  }
  
  /**
   * Close dialog using X button
   */
  async close() {
    await this.closeButton.click();
  }
  
  /**
   * Create deck with name and optional description
   */
  async createDeck(name: string, description?: string) {
    await this.fillName(name);
    if (description) {
      await this.fillDescription(description);
    }
    await this.submit();
  }
  
  /**
   * Get name error message
   */
  async getNameError(): Promise<string | null> {
    return await this.nameError.textContent();
  }
  
  /**
   * Check if submit button is disabled
   */
  async isSubmitDisabled(): Promise<boolean> {
    return await this.submitButton.isDisabled();
  }
  
  /**
   * Check if dialog is visible
   */
  async isVisible(): Promise<boolean> {
    return await this.dialog.isVisible();
  }
  
  /**
   * Wait for dialog to close
   */
  async waitForClose() {
    await this.dialog.waitFor({ state: 'hidden' });
  }
}
