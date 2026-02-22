# GitHub Actions Deployment Guide

Ten dokument opisuje konfigurację deployment pipeline dla projektu 10x-cards na Cloudflare Pages.

## Workflows

### 1. Pull Request Validation (`pr-validation.yml`)

Uruchamia się automatycznie przy każdym Pull Request do `main`.

**Wykonywane kroki:**

- ✅ Linting kodu (ESLint)
- ✅ Testy jednostkowe (Vitest)
- ✅ Weryfikacja budowania projektu
- ⚠️ Testy E2E (opcjonalne, wyłączone domyślnie)

### 2. Production Deployment (`master.yml`)

Uruchamia się automatycznie przy każdym push do `main`.

**Wykonywane kroki:**

- ✅ Linting kodu (ESLint)
- ✅ Testy jednostkowe (Vitest)
- ✅ Build projektu
- 🚀 Deployment na Cloudflare Pages

## Wymagane GitHub Secrets

Aby uruchomić deployment na Cloudflare Pages, należy skonfigurować następujące sekrety w ustawieniach repozytorium GitHub:

### Cloudflare

```
CLOUDFLARE_API_TOKEN          - Token API z Cloudflare Dashboard
CLOUDFLARE_ACCOUNT_ID         - ID konta Cloudflare
CLOUDFLARE_PROJECT_NAME       - Nazwa projektu w Cloudflare Pages (np. "10x-cards")
```

### Supabase

```
PUBLIC_SUPABASE_URL          - Publiczny URL instancji Supabase
PUBLIC_SUPABASE_ANON_KEY     - Publiczny klucz anon Supabase
SUPABASE_URL                 - URL instancji Supabase (może być taki sam jak PUBLIC)
SUPABASE_KEY                 - Service role key Supabase
```

### OpenRouter (AI)

```
OPENROUTER_API_KEY           - Klucz API OpenRouter
OPENROUTER_DEFAULT_MODEL     - Domyślny model AI (np. "openai/gpt-4o-mini")
OPENROUTER_BASE_URL          - URL API OpenRouter (https://openrouter.ai/api/v1)
OPENROUTER_REFERRER          - URL referrer (np. "https://10x-cards.pages.dev")
OPENROUTER_TITLE             - Tytuł aplikacji dla OpenRouter
```

### AI Configuration

```
AI_TIMEOUT_MS                - Timeout dla requestów AI (ms)
AI_RATE_LIMIT_PER_MINUTE     - Limit requestów na minutę
AI_RATE_LIMIT_PER_DAY        - Limit requestów na dzień
AI_MAX_INPUT_LENGTH          - Maksymalna długość inputu
AI_DEFAULT_MAX_CARDS         - Domyślna liczba kart do wygenerowania
AI_MAX_CARDS_LIMIT           - Maksymalny limit kart
```

## Jak uzyskać Cloudflare API Token?

1. Zaloguj się do [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Przejdź do **My Profile** > **API Tokens**
3. Kliknij **Create Token**
4. Wybierz template **Edit Cloudflare Workers** lub utwórz custom token z uprawnieniami:
   - Account - Cloudflare Pages: Edit
5. Skopiuj wygenerowany token

## Jak uzyskać Cloudflare Account ID?

1. Zaloguj się do [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Wybierz **Workers & Pages**
3. Account ID znajduje się w prawej kolumnie (pod **Account Details**)

## Jak skonfigurować sekrety w GitHub?

1. Przejdź do swojego repozytorium na GitHub
2. Kliknij **Settings** > **Secrets and variables** > **Actions**
3. Kliknij **New repository secret**
4. Wpisz nazwę sekretu i wartość
5. Kliknij **Add secret**
6. Powtórz dla wszystkich wymaganych sekretów

## Struktura projektu

```
.github/
  workflows/
    pr-validation.yml    # Walidacja Pull Requestów
    master.yml          # Deployment na produkcję
```

## Tech Stack

- **Framework:** Astro 5 z React 19
- **Hosting:** Cloudflare Pages
- **CI/CD:** GitHub Actions
- **Backend:** Supabase
- **AI:** OpenRouter.ai

## Kluczowe zależności

- `@astrojs/cloudflare` - Adapter Astro dla Cloudflare Pages
- `cloudflare/pages-action@v1` - GitHub Action do deploymentu
- `actions/checkout@v5` - Checkout kodu
- `actions/setup-node@v6` - Setup Node.js

## Przydatne komendy

```bash
# Lokalny development
npm run dev

# Build produkcyjny
npm run build

# Testy
npm run test:unit
npm run test:e2e

# Linting
npm run lint
npm run lint:fix
```

## Troubleshooting

### Deployment fails z błędem "MessageChannel is not defined"

**⚠️ CRITICAL**: This error occurs because Cloudflare Pages automatic GitHub deployments **do not respect** `compatibility_flags` from `wrangler.toml`.

**REQUIRED MANUAL CONFIGURATION**:

1. **Configure in Cloudflare Dashboard** (See [CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md) for detailed guide):

   a. Go to https://dash.cloudflare.com/

   b. Navigate to: Workers & Pages → 10x-cards → Settings → Functions → Runtime

   c. **Configure BOTH Preview AND Production environments**:
   - Click **Edit** for each environment
   - Set **Compatibility date**: `2025-11-02` (or current date)
   - Set **Compatibility flags**: `nodejs_compat`
   - **Save** each environment

   d. **Critical**: Make sure compatibility_date is **>= 2024-09-23**
   - Earlier dates do NOT support MessageChannel
   - If you see `Nov 2, 2024` in Preview - update to `Nov 2, 2025`

2. **Why wrangler.toml alone is not enough**:
   - The `compatibility_flags = ["nodejs_compat"]` in `wrangler.toml` works for local development
   - Cloudflare Pages automatic deployments from GitHub READ but DO NOT APPLY these settings
   - Manual Dashboard configuration takes precedence and is REQUIRED for production

3. **After Dashboard configuration**: Push a new commit or manually redeploy from Cloudflare Dashboard
   ```bash
   git commit --allow-empty -m "chore: trigger redeploy after runtime settings update"
   git push origin <your-branch>
   ```

**Root cause**: React 19 SSR uses Node.js APIs (MessageChannel) not available in Cloudflare Workers without `nodejs_compat` flag AND `compatibility_date >= 2024-09-23`.

**Common mistake**: Having `nodejs_compat` flag set but outdated `compatibility_date` (e.g., `Nov 2, 2024` instead of `Nov 2, 2025`). The date MUST be recent enough to include full MessageChannel implementation.

### Deployment fails z błędem "Context access might be invalid"

- To są tylko ostrzeżenia ESLint, nie błędy
- Upewnij się, że wszystkie sekrety są skonfigurowane w GitHub

### Build fails z błędem ENV variables

- Sprawdź czy wszystkie wymagane zmienne środowiskowe są ustawione
- Dla buildów Astro wymagane są zmienne z prefiksem `PUBLIC_`

### Cloudflare deployment fails

- Sprawdź czy `CLOUDFLARE_API_TOKEN` ma odpowiednie uprawnienia
- Zweryfikuj czy `CLOUDFLARE_PROJECT_NAME` zgadza się z nazwą w Cloudflare Pages
- Upewnij się, że projekt w Cloudflare Pages już istnieje

## Wsparcie

W przypadku problemów:

1. Sprawdź logi w Actions na GitHub
2. Zweryfikuj konfigurację sekretów
3. Sprawdź dokumentację Cloudflare Pages
