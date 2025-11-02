# Page Object Model (POM) - E2E Tests

This directory contains Page Object Model classes for E2E testing with Playwright.

## 📁 Structure

```
tests/e2e/page-objects/
├── index.ts                  # Central export file
├── LoginPage.ts              # Login page interactions
├── RegisterPage.ts           # Registration page interactions
├── DecksPage.ts              # Decks list page interactions
├── CreateDeckDialog.ts       # Create deck dialog interactions
├── AIGeneratorPage.ts        # AI generator page interactions
└── StudyPage.ts              # Study session page interactions
```

## 🎯 Purpose

Page Object Model classes encapsulate:
- **Page locators** - All selectors in one place using Playwright's recommended locator hierarchy
- **Page actions** - Reusable methods for user interactions
- **Assertions helpers** - Methods to retrieve state for validation

## 📚 Available Page Objects

### LoginPage
Handles authentication login flow.

**Key methods:**
- `goto()` - Navigate to login page
- `login(email, password)` - Complete login flow
- `fillEmail(email)` - Fill email field
- `fillPassword(password)` - Fill password field
- `submit()` - Submit form
- `clickForgotPassword()` - Navigate to password reset
- `getEmailError()` - Get email validation error
- `isSubmitDisabled()` - Check if submit is disabled

### RegisterPage
Handles user registration flow.

**Key methods:**
- `goto()` - Navigate to registration page
- `register(email, password, confirmPassword?)` - Complete registration
- `fillEmail(email)` - Fill email field
- `fillPassword(password)` - Fill password field
- `fillConfirmPassword(password)` - Fill confirm password field
- `submit()` - Submit form
- `getPasswordError()` - Get password validation error
- `isSubmitLoading()` - Check loading state

### DecksPage
Manages decks list view.

**Key methods:**
- `goto()` - Navigate to decks page
- `clickCreateDeck()` - Open create deck dialog
- `search(query)` - Search for decks
- `getDeckCardByName(name)` - Get specific deck locator
- `clickDeck(name)` - Open deck details
- `clickEditDeck(deckName)` - Open edit dialog for deck
- `clickDeleteDeck(deckName)` - Open delete dialog for deck
- `getDeckCount()` - Get number of displayed decks
- `isEmptyStateVisible()` - Check if empty state shown
- `goToNextPage()` - Navigate pagination

### CreateDeckDialog
Handles deck creation dialog.

**Key methods:**
- `waitForDialog()` - Wait for dialog to appear
- `createDeck(name, description?)` - Complete creation flow
- `fillName(name)` - Fill deck name
- `fillDescription(description)` - Fill deck description
- `submit()` - Submit form
- `cancel()` - Cancel dialog
- `getNameError()` - Get name validation error
- `isVisible()` - Check dialog visibility
- `waitForClose()` - Wait for dialog to close

### AIGeneratorPage
Manages AI flashcard generation.

**Key methods:**
- `goto()` - Navigate to generator page
- `generate(text, deckName?, maxCards?)` - Complete generation flow
- `fillInputText(text)` - Fill input text area
- `fillDeckName(name)` - Fill deck name (optional)
- `fillMaxCards(count)` - Set max cards limit
- `clickGenerate()` - Start generation
- `clickCancel()` - Cancel generation
- `getCharCount()` - Get current character count
- `isGenerating()` - Check loading state
- `waitForRedirect()` - Wait for redirect to review page

### StudyPage
Manages study session and card reviews.

**Key methods:**
- `goto(deckId)` - Navigate to study session
- `showAnswer()` - Reveal card answer
- `gradeAgain()` - Grade as "Again" (1)
- `gradeHard()` - Grade as "Hard" (2)
- `gradeGood()` - Grade as "Good" (3)
- `gradeEasy()` - Grade as "Easy" (4)
- `reviewCard(grade)` - Complete full review cycle
- `getProgress()` - Get current progress text
- `getReviewedCount()` - Get number of reviewed cards
- `isSessionComplete()` - Check if session finished
- `backToDecks()` - Return to decks from summary

## 🎨 Locator Strategy

Page Objects follow Playwright's recommended locator hierarchy:

1. **`getByRole()`** - Most resilient (e.g., buttons, headings)
2. **`getByLabel()`** - For form fields with labels
3. **`getByPlaceholder()`** - For inputs with placeholders
4. **`getByText()`** - For text content
5. **`getByTestId()`** - For elements with `data-testid`
6. **CSS/XPath** - Last resort (avoided when possible)

## 💡 Usage Examples

### Basic Login Test
```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './page-objects';

test('user can login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  
  // Arrange
  await loginPage.goto();
  
  // Act
  await loginPage.login('user@example.com', 'password123');
  
  // Assert
  await expect(page).toHaveURL('/decks');
});
```

### Creating a Deck
```typescript
import { test, expect } from '@playwright/test';
import { DecksPage, CreateDeckDialog } from './page-objects';

test('can create new deck', async ({ page }) => {
  const decksPage = new DecksPage(page);
  const createDialog = new CreateDeckDialog(page);
  
  await decksPage.goto();
  await decksPage.clickCreateDeck();
  await createDialog.waitForDialog();
  await createDialog.createDeck('My Deck', 'Description');
  await createDialog.waitForClose();
  
  const deckCard = decksPage.getDeckCardByName('My Deck');
  await expect(deckCard).toBeVisible();
});
```

### Complete Study Flow
```typescript
import { test, expect } from '@playwright/test';
import { StudyPage } from './page-objects';

test('can review flashcards', async ({ page }) => {
  const studyPage = new StudyPage(page);
  
  await studyPage.goto('deck-id-123');
  
  // Review first card
  await studyPage.reviewCard('good');
  
  // Check progress
  const reviewedCount = await studyPage.getReviewedCount();
  expect(reviewedCount).toBe(1);
});
```

## 🏗️ Best Practices

### 1. AAA Pattern
Structure tests with Arrange-Act-Assert:
```typescript
test('example test', async ({ page }) => {
  const pageObject = new PageObject(page);
  
  // Arrange - Set up preconditions
  await pageObject.goto();
  
  // Act - Perform action
  await pageObject.doSomething();
  
  // Assert - Verify outcome
  await expect(page.getByText('Success')).toBeVisible();
});
```

### 2. Reusable Methods
Encapsulate common flows in POM methods:
```typescript
async login(email: string, password: string) {
  await this.fillEmail(email);
  await this.fillPassword(password);
  await this.submit();
}
```

### 3. Readonly Locators
Define locators as `readonly` properties:
```typescript
readonly submitButton: Locator;

constructor(page: Page) {
  this.submitButton = page.getByRole('button', { name: 'Submit' });
}
```

### 4. Wait for State
Use explicit waits for state changes:
```typescript
async waitForDialog() {
  await this.dialog.waitFor({ state: 'visible' });
}

async waitForClose() {
  await this.dialog.waitFor({ state: 'hidden' });
}
```

## 🧪 Test Organization

Test files are organized by feature:
- `auth.spec.ts` - Authentication tests
- `decks.spec.ts` - Deck management tests
- `ai-generator.spec.ts` - AI generation tests
- `study.spec.ts` - Study session tests

## 📖 References

- [Playwright POM Documentation](https://playwright.dev/docs/pom)
- [Project POM Guidelines](../../.cursor/rules/playwright-selectors-pom.mdc)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
