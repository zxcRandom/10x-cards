/**
 * RegisterPage - Page Object Model
 *
 * Encapsulates interactions with the registration page.
 * Provides methods for account creation and validation.
 */

import type { Page, Locator } from "@playwright/test";

export class RegisterPage {
  readonly page: Page;

  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly loginLink: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly confirmPasswordError: Locator;
  readonly passwordHint: Locator;

  constructor(page: Page) {
    this.page = page;

    // Form inputs - using labels
    this.emailInput = page.getByLabel("Adres e-mail");
    this.passwordInput = page.getByLabel("Hasło", { exact: true });
    this.confirmPasswordInput = page.getByLabel("Potwierdź hasło");

    // Button - using role and name
    this.submitButton = page.getByRole("button", { name: /utwórz konto/i });

    // Link
    this.loginLink = page.getByRole("link", { name: /zaloguj się/i });

    // Error messages - using role="alert"
    this.emailError = page
      .locator('[id$="error"]')
      .filter({ hasText: /e-mail/i })
      .first();
    this.passwordError = page.locator('[id$="error"]').filter({ hasText: /hasło/i }).first();
    this.confirmPasswordError = page.locator('[id$="error"]').filter({ hasText: /hasło/i }).last();

    // Password hint
    this.passwordHint = page.getByText(/hasło musi mieć co najmniej/i);
  }

  /**
   * Navigate to register page
   */
  async goto() {
    await this.page.goto("/auth/register");
  }

  /**
   * Fill email field
   */
  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  /**
   * Fill confirm password field
   */
  async fillConfirmPassword(password: string) {
    await this.confirmPasswordInput.fill(password);
  }

  /**
   * Submit registration form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Complete registration flow
   */
  async register(email: string, password: string, confirmPassword?: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.fillConfirmPassword(confirmPassword ?? password);
    await this.submit();
  }

  /**
   * Click login link
   */
  async clickLogin() {
    await this.loginLink.click();
  }

  /**
   * Get email error message text
   */
  async getEmailError(): Promise<string | null> {
    return await this.emailError.textContent();
  }

  /**
   * Get password error message text
   */
  async getPasswordError(): Promise<string | null> {
    return await this.passwordError.textContent();
  }

  /**
   * Get confirm password error message text
   */
  async getConfirmPasswordError(): Promise<string | null> {
    return await this.confirmPasswordError.textContent();
  }

  /**
   * Check if submit button is disabled
   */
  async isSubmitDisabled(): Promise<boolean> {
    return await this.submitButton.isDisabled();
  }

  /**
   * Check if submit button is loading
   */
  async isSubmitLoading(): Promise<boolean> {
    const text = await this.submitButton.textContent();
    return text?.includes("Tworzenie konta...") ?? false;
  }

  /**
   * Wait for successful redirect after registration
   */
  async waitForRedirect(expectedUrl = "/decks") {
    await this.page.waitForURL(expectedUrl);
  }
}
