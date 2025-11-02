# CI/CD Setup - GitHub Actions

## Przegląd

Ten projekt używa GitHub Actions do automatycznej walidacji Pull Requestów do brancha `main`.

## Workflow: Pull Request Validation

Plik: `.github/workflows/pr-validation.yml`

### Triggery

Workflow uruchamia się automatycznie przy każdym Pull Requeście do brancha `main`.

### Jobs

#### 1. Lint Code

- **Cel**: Sprawdzenie jakości kodu za pomocą ESLint
- **Komendy**: `npm ci` → `npm run lint`
- **Czas**: ~1-2 minuty

#### 2. Unit Tests

- **Cel**: Uruchomienie testów jednostkowych
- **Komendy**: `npm ci` → `npm run test:unit`
- **Czas**: ~1-2 minuty

#### 3. Build Check

- **Cel**: Weryfikacja, czy projekt buduje się poprawnie
- **Komendy**: `npm ci` → `npm run build`
- **Czas**: ~2-3 minuty

#### 4. E2E Tests (opcjonalne - obecnie wyłączone)

- **Cel**: Testy end-to-end z Playwright
- **Status**: Wyłączone (`if: false`)
- **Wymaga**: Konfiguracji secrets w GitHub

## Najlepsze praktyki zastosowane

### ✅ Zastosowane w projekcie:

1. **Używanie `npm ci` zamiast `npm install`**
   - Szybsza instalacja
   - Gwarantuje spójność z `package-lock.json`
   - Czyści `node_modules` przed instalacją

2. **Caching zależności Node.js**

   ```yaml
   uses: actions/setup-node@v4
   with:
     node-version: "20.x"
     cache: "npm"
   ```

   - Przyspiesza instalację dependencies
   - Zmniejsza obciążenie npm registry

3. **Pinning wersji akcji do konkretnych tagów**
   - `actions/checkout@v5`
   - `actions/setup-node@v4`
   - Zapewnia stabilność i bezpieczeństwo

4. **Minimalne wymagane uprawnienia**

   ```yaml
   permissions:
     contents: read
     pull-requests: write
   ```

5. **Równoległe wykonywanie niezależnych jobów**
   - `lint`, `unit-tests`, i `build` uruchamiają się równolegle
   - Skraca całkowity czas wykonania workflow

6. **Dependency chain dla testów E2E**

   ```yaml
   needs: [lint, unit-tests, build]
   ```

   - E2E testy uruchamiają się tylko jeśli podstawowe sprawdzenia przejdą

7. **Upload artifacts dla diagnostyki**
   - Playwright reports są zachowywane przez 30 dni
   - `if: always()` zapewnia upload nawet przy błędach

8. **Retry logic w Playwright**
   - Konfiguracja w `playwright.config.ts`: `retries: process.env.CI ? 2 : 0`

## Jak włączyć testy E2E w CI

### Krok 1: Dodaj Secrets w GitHub

1. Przejdź do: `Settings` → `Secrets and variables` → `Actions`
2. Kliknij `New repository secret`
3. Dodaj następujące secrets:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`

### Krok 2: Włącz job E2E

W pliku `.github/workflows/pr-validation.yml` zmień:

```yaml
if: false # Ustaw na 'true' gdy skonfigurujesz secrets w GitHub
```

na:

```yaml
if: true
```

### Krok 3: (Opcjonalnie) Stwórz dedykowaną bazę testową

Dla bezpieczeństwa, rozważ użycie oddzielnej instancji Supabase dla testów CI/CD.

## Testowanie workflow lokalnie

Możesz przetestować workflow lokalnie używając [act](https://github.com/nektos/act):

```bash
# Instalacja act (Windows)
choco install act-cli

# Uruchom workflow
act pull_request
```

## Monitorowanie

- Sprawdź status workflows: `Actions` tab w GitHub
- Każdy PR pokazuje status checków
- Kliknij na "Details" aby zobaczyć logi

## Troubleshooting

### Problem: npm ci zawodzi

**Rozwiązanie**: Upewnij się, że `package-lock.json` jest zaktualizowany i commitnięty.

### Problem: Build timeout

**Rozwiązanie**: Zwiększ timeout w workflow lub zoptymalizuj build.

### Problem: Testy E2E nie przechodzą w CI

**Rozwiązanie**:

1. Sprawdź czy secrets są poprawnie skonfigurowane
2. Uruchom testy lokalnie z `CI=true npm run test:e2e:fast`
3. Sprawdź logi artifacts (Playwright report)

## Rozszerzenia (TODO)

Możliwe usprawnienia:

- [ ] Dodać coverage reporting (Codecov/Coveralls)
- [ ] Dodać security scanning (Dependabot, Snyk)
- [ ] Dodać performance budgets
- [ ] Matrix strategy dla różnych wersji Node.js
- [ ] Deploy preview dla każdego PR (Vercel/Netlify)
- [ ] Automatic PR labeling
- [ ] Slack/Discord notifications
