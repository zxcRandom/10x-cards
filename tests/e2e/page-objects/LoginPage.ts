/**
 * LoginPage - Page Object Model
 *
 * Encapsulates interactions with the login page.
 * Provides methods for navigation, authentication, and validation.
 */

import type { Page, Locator } from "@playwright/test";

export class LoginPage {
  readonly page: Page;

  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly registerLink: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;

  constructor(page: Page) {
    this.page = page;

    // Form inputs - using labels for better accessibility
    this.emailInput = page.getByLabel("Adres e-mail");
    this.passwordInput = page.getByLabel("Hasło");

    // Buttons - using role and name
    this.submitButton = page.getByRole("button", { name: /zaloguj się/i });

    // Links
    this.forgotPasswordLink = page.getByRole("link", { name: /zapomniałeś hasła/i });
    this.registerLink = page.getByRole("link", { name: /zarejestruj się/i });

    // Error messages - using role="alert"
    this.emailError = page.locator('[role="alert"]').first();
    this.passwordError = page.locator('[role="alert"]').last();
  }

  /**
   * Navigate to login page
   */
  async goto() {
    await this.page.goto("/auth/login");
  }

  /**
   * Navigate to login page with next URL parameter
   */
  async gotoWithNext(nextUrl: string) {
    await this.page.goto(`/auth/login?next=${encodeURIComponent(nextUrl)}`);
  }

  /**
   * Fill email field
   * Uses pressSequentially to trigger React onChange events
   */
  async fillEmail(email: string) {
    await this.emailInput.click();
    await this.emailInput.clear();
    await this.emailInput.pressSequentially(email, { delay: 50 });
  }

  /**
   * Fill password field
   * Uses pressSequentially to trigger React onChange events
   */
  async fillPassword(password: string) {
    await this.passwordInput.click();
    await this.passwordInput.clear();
    await this.passwordInput.pressSequentially(password, { delay: 50 });
  }

  /**
   * Submit login form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Complete login flow
   */
  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
  }

  /**
   * Click register link
   */
  async clickRegister() {
    await this.registerLink.click();
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
    return text?.includes("Logowanie...") ?? false;
  }

  /**
   * Wait for successful redirect after login
   * Default redirect is to dashboard (root)
   */
  async waitForRedirect(expectedUrl = "/") {
    await this.page.waitForURL(expectedUrl);
  }
}
