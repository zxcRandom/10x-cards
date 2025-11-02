/**
 * Simple E2E Test - No Authentication
 * 
 * This test checks the login page without authentication.
 * Good for testing basic navigation and page rendering.
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from './page-objects';

test.describe('Public Pages - No Auth Required', () => {
  
  test('can view login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    // Navigate to login page
    await loginPage.goto();
    
    // Verify page elements are visible
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
    await expect(loginPage.forgotPasswordLink).toBeVisible();
    await expect(loginPage.registerLink).toBeVisible();
  });
  
  test('submit button is disabled when fields are empty', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.goto();
    
    // Verify submit is disabled without input
    const isDisabled = await loginPage.isSubmitDisabled();
    expect(isDisabled).toBe(true);
  });
  
  test('can type in email and password fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.goto();
    
    // Type in fields
    await loginPage.fillEmail('test@example.com');
    await loginPage.fillPassword('testpassword');
    
    // Verify values are filled
    await expect(loginPage.emailInput).toHaveValue('test@example.com');
    await expect(loginPage.passwordInput).toHaveValue('testpassword');
  });
});
