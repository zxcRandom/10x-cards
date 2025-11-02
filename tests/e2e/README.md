# E2E Tests - Playwright

E2E testy dla aplikacji 10x-cards używające Playwright.

## 🚀 Szybki start

### 1. Upewnij się że masz zainstalowane zależności:

```bash
npm install
npx playwright install chromium
```

### 2. Skonfiguruj środowisko testowe:

Plik `.env.test` zawiera dane testowego użytkownika:

```bash
E2E_USERNAME_ID=0ecb0b2e-0d67-4603-8448-610102cc555a
E2E_USERNAME=marcin.charubin@gmail.com
E2E_PASSWORD=playwright
```

### 3. Uruchom testy:

```bash
# Uruchom wszystkie testy E2E
npx playwright test

# Uruchom w trybie UI (interaktywny)
npx playwright test --ui

# Uruchom z widoczną przeglądarką
npx playwright test --headed

# Uruchom konkretny plik
npx playwright test tests/e2e/auth.spec.ts
```

## 📁 Struktura testów

```
tests/e2e/
├── fixtures.ts                    # Fixture z automatyczną autentykacją
├── page-objects/                  # Page Object Model classes
│   ├── LoginPage.ts
│   ├── RegisterPage.ts
│   ├── DecksPage.ts
│   ├── CreateDeckDialog.ts
│   ├── AIGeneratorPage.ts
│   ├── StudyPage.ts
│   ├── index.ts
│   └── README.md
├── auth.spec.ts                   # Testy autentykacji
├── decks.spec.ts                  # Testy zarządzania taliami
├── ai-generator.spec.ts           # Testy generatora AI
├── study.spec.ts                  # Testy sesji nauki
└── example-authenticated.spec.ts  # Przykład z autentykacją
```

## 🔐 Autentykacja w testach

### Automatyczna autentykacja (zalecane)

Użyj fixture `authenticatedPage` który automatycznie loguje użytkownika:

```typescript
import { test, expect } from './fixtures';
import { DecksPage } from './page-objects';

test('authenticated test', async ({ authenticatedPage }) => {
  const decksPage = new DecksPage(authenticatedPage);
  
  // Użytkownik już zalogowany!
  await decksPage.goto();
  await expect(decksPage.pageTitle).toBeVisible();
});
```

### Testy bez autentykacji

Dla testów logowania/rejestracji użyj standardowego `page`:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './page-objects';

test('login test', async ({ page }) => {
  const loginPage = new LoginPage(page);
  
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password');
});
```

## 🎯 Przykłady użycia

### Test z autentykacją

```typescript
import { test, expect } from './fixtures';
import { DecksPage, CreateDeckDialog } from './page-objects';

test('create new deck', async ({ authenticatedPage }) => {
  const decksPage = new DecksPage(authenticatedPage);
  const createDialog = new CreateDeckDialog(authenticatedPage);
  
  await decksPage.goto();
  await decksPage.clickCreateDeck();
  
  await createDialog.waitForDialog();
  await createDialog.createDeck('Test Deck', 'Description');
  await createDialog.waitForClose();
  
  const deckCard = decksPage.getDeckCardByName('Test Deck');
  await expect(deckCard).toBeVisible();
});
```

### Test logowania

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './page-objects';

test('user can login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  
  await loginPage.goto();
  await loginPage.login(
    process.env.E2E_USERNAME!,
    process.env.E2E_PASSWORD!
  );
  
  await expect(page).toHaveURL('/decks');
});
```

### Test generatora AI

```typescript
import { test, expect } from './fixtures';
import { AIGeneratorPage } from './page-objects';

test('generate flashcards', async ({ authenticatedPage }) => {
  const generatorPage = new AIGeneratorPage(authenticatedPage);
  
  await generatorPage.goto();
  
  const text = 'Machine learning is a subset of AI...';
  await generatorPage.generate(text, 'ML Deck', 10);
  
  await generatorPage.waitForRedirect();
  await expect(authenticatedPage).toHaveURL(/\/generate\/review/);
});
```

## 🔧 Konfiguracja

### playwright.config.ts

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',  // URL aplikacji
    testIdAttribute: 'data-testid',     // Atrybut dla getByTestId()
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',              // Auto-start aplikacji
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
```

## 📊 Raporty i debugowanie

### Generowanie raportów

```bash
# Uruchom testy (automatycznie generuje raport)
npx playwright test

# Zobacz raport HTML
npx playwright show-report

# Zobacz trace dla nieudanych testów
npx playwright show-trace trace.zip
```

### Debugowanie

```bash
# Debugowanie z Playwright Inspector
npx playwright test --debug

# Debugowanie konkretnego testu
npx playwright test auth.spec.ts --debug

# Uruchom z zatrzymaniem na każdym kroku
npx playwright test --headed --debug
```

### Tryb UI (zalecany)

```bash
# Interaktywny interfejs do uruchamiania i debugowania
npx playwright test --ui
```

## 🎨 Page Object Model

Wszystkie testy używają Page Object Model dla łatwiejszego utrzymania:

```typescript
// ✅ Dobrze - używamy POM
const loginPage = new LoginPage(page);
await loginPage.login('user@email.com', 'password');

// ❌ Źle - bezpośrednie selektory w testach
await page.getByLabel('Email').fill('user@email.com');
await page.getByLabel('Password').fill('password');
await page.getByRole('button', { name: 'Login' }).click();
```

Więcej informacji: [Page Objects README](./page-objects/README.md)

## ✅ Best Practices

1. **Używaj fixtures** dla autentykacji
2. **Stosuj POM** zamiast bezpośrednich selektorów
3. **Pattern AAA** - Arrange, Act, Assert
4. **Izoluj testy** - każdy test niezależny
5. **Opisowe nazwy** - `test('user can create deck with valid data')`
6. **Czekaj na stan** - używaj `waitFor()`, `toBeVisible()`
7. **Cleanup** - używaj `beforeEach`/`afterEach`

## 🐛 Troubleshooting

### Testy nie mogą się połączyć z bazą danych

Sprawdź czy `.env.test` zawiera poprawne dane:
```bash
cat .env.test
```

### Aplikacja nie startuje

Sprawdź czy port 5173 jest wolny:
```bash
lsof -i :5173  # macOS/Linux
netstat -ano | findstr :5173  # Windows
```

### Testy timeout

Zwiększ timeout w `playwright.config.ts`:
```typescript
timeout: 60000,  // 60 sekund
```

## 📚 Dokumentacja

- [Playwright Documentation](https://playwright.dev)
- [Page Objects Guide](./page-objects/README.md)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
