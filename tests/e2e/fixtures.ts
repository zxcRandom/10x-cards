import { test as base, expect } from '@playwright/test';

/**
 * E2E test fixture with pre-authenticated user
 * Usage: test('should do something', async ({ page }) => { ... })
 */
export const test = base;

export { expect };
