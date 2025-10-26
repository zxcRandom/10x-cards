# Plan implementacji: Password Reset Flow (Forgot/Reset)

## Status
❌ **Niezaimplementowane** - Brakuje API endpoints dla reset hasła

## ✅ Weryfikacja z dokumentacją Supabase Auth

Plan został zweryfikowany z oficjalną dokumentacją:
- ✅ **API Endpoints**: `/auth/v1/recover` (POST), `/auth/v1/user` (PUT)
- ✅ **Token format**: `?token_hash=xxx&type=recovery` (NIE `?code=xxx`)
- ✅ **Email template**: Używa `{{ .ConfirmationURL }}`
- ✅ **Token exchange**: Automatyczny przez @supabase/ssr
- ✅ **Rate limiting**: Max 60 sekund między próbami (Supabase domyślnie)

## Kontekst
Komponenty frontendowe dla reset hasła już istnieją:
- ✅ `ForgotPasswordForm.tsx` - formularz żądania resetu
- ✅ `ResetPasswordForm.tsx` - formularz ustawiania nowego hasła
- ✅ `/auth/forgot-password.astro` - strona żądania resetu
- ✅ `/auth/reset.astro` - strona ustawiania nowego hasła (wymaga aktualizacji!)
- ✅ `auth.schemas.ts` - validation schemas
- ✅ `RateLimitService` - gotowe metody rate limiting
- ✅ `middleware/index.ts` - ścieżki dodane do PUBLIC_EXACT_PATHS

Ale próbują wywołać endpointy, które nie istnieją:
- ❌ `POST /api/v1/auth/password/request-reset` - **BRAK**
- ❌ `POST /api/v1/auth/password/reset` - **BRAK**

## Cel
Zaimplementować kompletny flow resetowania hasła zgodnie z PRD (US-014) i **dokumentacją Supabase Auth**.

## Jak działa Supabase Auth Password Recovery

**Dokumentacja oficjalna** (z `/auth/v1/recover` i `/auth/v1/user`):

### 1. Request Password Reset
```typescript
// Wywołanie w naszym API
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'https://yourapp.com/auth/reset'
})
```
- **API**: `POST /auth/v1/recover`
- **Response**: `{}` (pusty obiekt)
- **Limit**: Max 1 request na 60 sekund per email (Supabase)
- **Email**: Wysyłany z `{{ .ConfirmationURL }}`

### 2. Email Link Format
```
https://yourapp.com/auth/reset?token_hash=xxx&type=recovery
```
- **Parametry**: `token_hash` + `type=recovery` (NIE `code`!)
- **Token**: Jednorazowy, ważny 60 minut
- **Exchange**: @supabase/ssr automatycznie wymienia token na sesję

### 3. Update Password
```typescript
// Token już wymieniony na sesję przez @supabase/ssr
const { data: { user } } = await supabase.auth.getUser();

// Zaktualizuj hasło
await supabase.auth.updateUser({ password: newPassword });
```
- **API**: `PUT /auth/v1/user`
- **Auth**: Wymaga aktywnej sesji (z token exchange)
- **Body**: `{ "password": "new-password" }`

## Flow resetowania hasła (PRD US-014)

**Zgodnie z dokumentacją Supabase Auth:**

### Krok 1: Request Password Reset
1. Użytkownik wpisuje e-mail na `/auth/forgot-password`
2. Frontend → `POST /api/v1/auth/password/request-reset`
3. Backend → Supabase `POST /auth/v1/recover` przez `resetPasswordForEmail()`
4. Supabase wysyła e-mail z `{{ .ConfirmationURL }}`
5. **Zawsze zwracamy sukces** (neutralny komunikat dla bezpieczeństwa)

### Krok 2: Email Link
E-mail zawiera link:
```
https://yourapp.com/auth/reset?token_hash=xxx&type=recovery
```
- Token jednorazowy, ważny 60 minut
- `type=recovery` identyfikuje flow

### Krok 3: Token Exchange (automatyczny!)
1. Użytkownik klika link z e-maila
2. **@supabase/ssr automatycznie wykrywa `token_hash` w URL**
3. **@supabase/ssr automatycznie wymienia token na sesję**
4. Sesja zapisana w cookies `sb-access-token` i `sb-refresh-token`
5. Strona `/auth/reset.astro` sprawdza `token_hash` w URL
6. Jeśli obecny → pokazuje formularz resetowania

### Krok 4: Reset Password
1. Użytkownik wprowadza nowe hasło
2. Frontend → `POST /api/v1/auth/password/reset`
3. Backend sprawdza sesję: `getUser()` (ustawioną z tokenu)
4. Backend → Supabase `PUT /auth/v1/user` przez `updateUser({ password })`
5. Przekierowanie do `/auth/login` z sukcesem

## Zakres implementacji

### 1. Endpoint: Request Password Reset

#### 1.1 Utworzyć plik `src/pages/api/v1/auth/password/request-reset.ts`

**Funkcjonalność**:
- Przyjmuje adres e-mail
- Wywołuje `supabase.auth.resetPasswordForEmail()` - Supabase robi całą robotę
- **Zawsze zwraca sukces** (neutralny komunikat dla bezpieczeństwa)
- Rate limiting (max 3 próby na 1 min per e-mail) - używa RateLimitService

**Request**:
```typescript
POST /api/v1/auth/password/request-reset
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response** (zgodny z types.ts):
```typescript
// Success (200 OK) - ZAWSZE zwracane
{
  "status": "ok",
  "message": "Jeśli podany adres e-mail istnieje, wysłaliśmy instrukcje"
}

// Error (429 Too Many Requests)
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many password reset attempts. Please try again later.",
    "details": "Retry after 60 seconds"
  }
}
```

**Implementacja** (wzorowana na sign-in.ts):
```typescript
/**
 * POST /api/v1/auth/password/request-reset
 * Request password reset email. Always returns success for security.
 * US-014: Reset Password
 */

import type { APIRoute } from 'astro';
import { passwordResetRequestSchema } from '@/lib/validation/auth.schemas';
import { formatZodErrors } from '@/lib/utils/zod-errors';
import { RateLimitService } from '@/lib/services/rate-limit.service';
import { HttpStatus, ErrorCode } from '@/types';
import type { ErrorResponse, ValidationErrorResponse } from '@/types';

export const prerender = false;

const rateLimiter = new RateLimitService();

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: 'Invalid JSON in request body',
          },
        } satisfies ErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validate input
    const validationResult = passwordResetRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Validation failed',
            errors: formatZodErrors(validationResult.error),
          },
        } satisfies ValidationErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email } = validationResult.data;

    // 3. Rate limiting - check BEFORE attempt
    const rateLimitCheck = await rateLimiter.checkPasswordResetRateLimit(email);
    if (!rateLimitCheck.allowed) {
      const retryAfterSeconds = rateLimitCheck.resetInMs
        ? Math.ceil(rateLimitCheck.resetInMs / 1000)
        : 60;

      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.TOO_MANY_REQUESTS,
            message: 'Too many password reset attempts. Please try again later.',
            details: `Retry after ${retryAfterSeconds} seconds`,
          },
        } satisfies ErrorResponse),
        {
          status: HttpStatus.TOO_MANY_REQUESTS,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfterSeconds.toString(),
          },
        }
      );
    }

    // 4. Request password reset from Supabase
    // Supabase handles: token generation, email sending, expiration (60 min)
    const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${new URL(request.url).origin}/auth/reset`,
    });

    // 5. Increment rate limit AFTER attempt
    await rateLimiter.incrementPasswordResetRateLimit(email);

    // IMPORTANT: ALWAYS return success for security (neutral messaging)
    // Don't reveal whether email exists in the system
    if (error) {
      console.error('[Auth] Password reset request error:', error);
      // Still return success to user
    }

    return new Response(
      JSON.stringify({
        status: 'ok',
        message: 'Jeśli podany adres e-mail istnieje, wysłaliśmy instrukcje resetowania hasła',
      }),
      { status: HttpStatus.OK, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Auth] Password reset request error:', err);

    // Still return success for security
    return new Response(
      JSON.stringify({
        status: 'ok',
        message: 'Jeśli podany adres e-mail istnieje, wysłaliśmy instrukcje resetowania hasła',
      }),
      { status: HttpStatus.OK, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

### 2. Endpoint: Reset Password

#### 2.1 Utworzyć plik `src/pages/api/v1/auth/password/reset.ts`

**Funkcjonalność**:
- Supabase automatycznie weryfikuje token z URL (?code=xxx) i ustawia sesję
- Endpoint tylko wywołuje `updateUser({ password })` - resztę robi Supabase
- Token jednorazowy, wygasa po 60 min (zarządzane przez Supabase)

**Request**:
```typescript
POST /api/v1/auth/password/reset
Content-Type: application/json

{
  "newPassword": "new-strong-password"
}

// WAŻNE: Token z URL (?code=xxx) jest automatycznie obsługiwany przez Supabase
// Po kliknięciu linku z e-maila, Supabase ustawia sesję w cookie
```

**Response** (zgodny z types.ts):
```typescript
// Success (200 OK)
{
  "status": "ok",
  "message": "Hasło zostało zmienione pomyślnie"
}

// Error (401 Unauthorized - invalid/expired token)
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Link do resetowania hasła wygasł lub jest nieprawidłowy"
  }
}

// Error (400 Bad Request - validation)
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "errors": [
      { "field": "newPassword", "message": "Hasło musi mieć co najmniej 8 znaków" }
    ]
  }
}
```

**Implementacja** (wzorowana na change.ts):
```typescript
/**
 * POST /api/v1/auth/password/reset
 * Reset password with token from email.
 * US-014: Reset Password
 */

import type { APIRoute } from 'astro';
import { passwordResetSchema } from '@/lib/validation/auth.schemas';
import { formatZodErrors } from '@/lib/utils/zod-errors';
import { HttpStatus, ErrorCode } from '@/types';
import type { ErrorResponse, ValidationErrorResponse } from '@/types';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Check if user has valid session (set by Supabase from ?code= token)
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Link do resetowania hasła wygasł lub jest nieprawidłowy',
          },
        } satisfies ErrorResponse),
        { status: HttpStatus.UNAUTHORIZED, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: 'Invalid JSON in request body',
          },
        } satisfies ErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validate input (only newPassword, confirmNewPassword is for client-side)
    const validationResult = passwordResetSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Validation failed',
            errors: formatZodErrors(validationResult.error),
          },
        } satisfies ValidationErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { newPassword } = validationResult.data;

    // 4. Update password using Supabase Auth
    const { error: updateError } = await locals.supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('[Auth] Password reset error:', updateError);
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: 'Nie udało się zresetować hasła',
          },
        } satisfies ErrorResponse),
        { status: HttpStatus.INTERNAL_SERVER_ERROR, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Success
    return new Response(
      JSON.stringify({
        status: 'ok',
        message: 'Hasło zostało zmienione pomyślnie',
      }),
      { status: HttpStatus.OK, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Auth] Password reset error:', err);
    return new Response(
      JSON.stringify({
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Wystąpił nieoczekiwany błąd',
        },
      } satisfies ErrorResponse),
      { status: HttpStatus.INTERNAL_SERVER_ERROR, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

### 3. Validation Schemas

✅ **Już istnieją** - `src/lib/validation/auth.schemas.ts` zawiera:
- `passwordResetRequestSchema` - walidacja e-mail
- `passwordResetSchema` - walidacja nowego hasła + potwierdzenie
- Typy TypeScript eksportowane

**Nie wymaga żadnych zmian.**

### 4. Konfiguracja Supabase Dashboard

#### 4.1 Email Templates (Supabase Dashboard)

**KRYTYCZNE**: Template MUSI używać `{{ .ConfirmationURL }}` - to jedyna zmień prawidłowa zmienna!

**Lokalizacja**: `Authentication > Email Templates > Reset Password`

**Template zgodny z dokumentacją Supabase**:
```html
<h2>Zresetuj hasło</h2>

<p>Kliknij poniższy link, aby zresetować hasło do swojego konta:</p>
<p><a href="{{ .ConfirmationURL }}">Ustaw nowe hasło</a></p>

<p>Link jest ważny przez 60 minut.</p>
<p>Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
```

**❌ NIE UŻYWAJ**:
- `{{ .SiteURL }}` + manual URL - nie zadziała!
- `{{ .TokenHash }}` - dostępne tylko w niektórych templatech
- `?code=xxx` - Supabase używa `?token_hash=xxx&type=recovery`

**✅ UŻYWAJ**:
- `{{ .ConfirmationURL }}` - zawiera kompletny URL z tokenem

**Redirect URL Configuration**:
1. `Authentication > URL Configuration > Site URL`:
   - Development: `http://localhost:4321`
   - Production: `https://yourdomain.com`

2. `Authentication > URL Configuration > Redirect URLs` (whitelist):
   - Development: `http://localhost:4321/auth/reset`
   - Production: `https://yourdomain.com/auth/reset`

#### 4.2 Konfiguracja SMTP (opcjonalne dla MVP)

Supabase w trybie darmowym używa własnego SMTP, ale ma limity (kilka e-maili/godzinę).

Dla production polecane jest skonfigurowanie własnego SMTP:
- `Authentication > Settings > SMTP Settings`
- Dodaj dane swojego dostawcy SMTP (np. SendGrid, AWS SES, Mailgun)
- Skonfiguruj SPF/DKIM dla domeny

### 5. Rate Limiting

✅ **Już zaimplementowane** - `RateLimitService` ma gotowe metody:
- `checkPasswordResetRateLimit(email)` - sprawdza limit
- `incrementPasswordResetRateLimit(email)` - inkrementuje licznik
- Limit: **3 próby na 1 minutę per e-mail**

**Endpoint request-reset używa tego automatycznie** (patrz implementacja w sekcji 1.1).

### 6. Testy akceptacyjne (US-014)

**Part 1: Request Reset**
- [ ] Na ekranie logowania jest link "Nie pamiętasz hasła?" → `/auth/forgot-password`
- [ ] Formularz wymaga adresu e-mail
- [ ] Po wysłaniu: neutralny komunikat (zawsze sukces, nawet jeśli e-mail nie istnieje)
- [ ] Komunikat **nie ujawnia**, czy e-mail istnieje w systemie
- [ ] E-mail z linkiem jest wysyłany (jeśli adres istnieje w systemie)
- [ ] Link zawiera token i prowadzi do `/auth/reset?code=xxx`
- [ ] Link jest ważny 60 minut
- [ ] Próba żądania resetu więcej niż **3 razy w 1 min** → błąd 429

**Part 2: Reset Password**
- [ ] Link z e-maila prowadzi do `/auth/reset?code=xxx`
- [ ] Supabase automatycznie weryfikuje token i ustawia sesję
- [ ] Formularz wymaga dwukrotnego wpisania nowego hasła
- [ ] Walidacja client-side: hasło < 8 znaków → błąd
- [ ] Walidacja client-side: hasła nie są zgodne → błąd
- [ ] Wygasły/nieprawidłowy token → komunikat o wygaśnięciu linku
- [ ] Po sukcesie → toast "Hasło zostało zmienione"
- [ ] Przekierowanie do `/auth/login`
- [ ] Możliwość zalogowania z nowym hasłem

### 7. Kolejność implementacji

1. ✅ **Krok 0**: Sprawdź co już istnieje
   - ✅ Validation schemas w `auth.schemas.ts`
   - ✅ RateLimitService z metodami password reset
   - ✅ Middleware z dodanymi ścieżkami
   - ✅ Frontend komponenty i strony

2. **Krok 1**: Skonfiguruj Supabase Dashboard
   - W Supabase Dashboard → Authentication → Email Templates
   - Ustaw template "Reset Password" (użyj polskiej wersji)
   - Ustaw redirect URL: `http://localhost:4321/auth/reset` (dev)
   - Dodaj redirect URL do whitelisty
   - Przetestuj wysyłanie e-mail

3. **Krok 2**: Zaimplementuj endpoint `request-reset`
   - Stwórz `src/pages/api/v1/auth/password/request-reset.ts`
   - Użyj implementacji z sekcji 1.1 (wzorowana na sign-in.ts)
   - Rate limiting per e-mail (RateLimitService)
   - ZAWSZE zwracaj sukces (neutralny komunikat)

4. **Krok 3**: Zaimplementuj endpoint `reset`
   - Stwórz `src/pages/api/v1/auth/password/reset.ts`
   - Użyj implementacji z sekcji 2.1 (wzorowana na change.ts)
   - Weryfikacja sesji (token z URL obsługuje Supabase)
   - Wywołaj `updateUser({ password })`

5. **Krok 4**: Testowanie end-to-end
   - Test: request reset dla istniejącego e-mail
   - Test: request reset dla nieistniejącego e-mail (neutralny komunikat)
   - Test: kliknięcie linku z e-maila (Supabase weryfikuje token)
   - Test: ustawienie nowego hasła
   - Test: logowanie z nowym hasłem
   - Test: wygasły link (po 60 min)
   - Test: próba użycia linku dwa razy (token jednorazowy)
   - Test: rate limiting (4+ próby w 1 min → 429)

### 8. Uwagi bezpieczeństwa

1. **Neutralne komunikaty** (KRYTYCZNE):
   - ✅ ZAWSZE zwracaj sukces dla request-reset
   - ✅ Nie ujawniaj, czy e-mail istnieje w systemie
   - ✅ Nie ujawniaj szczegółów błędów w odpowiedziach

2. **Rate limiting** (zaimplementowane w RateLimitService):
   - ✅ Max 3 próby na 1 minutę per e-mail
   - ✅ Zapobiega brute force i spamowi
   - ✅ Używa in-memory storage (wystarczające dla MVP)

3. **Token security** (zarządzane przez Supabase Auth):
   - ✅ Token jednorazowy
   - ✅ Wygasa po 60 minutach
   - ✅ Bezpieczne przechowywanie (hashed w DB Supabase)
   - ✅ Weryfikacja automatyczna przy kliknięciu linku

4. **Email delivery** (Supabase SMTP):
   - ⚠️ Darmowy tier ma limity (kilka e-maili/godzinę)
   - ⚠️ Dla production: skonfiguruj własny SMTP (SendGrid, AWS SES)
   - ⚠️ Upewnij się, że e-maile nie trafiają do spam
   - ⚠️ Skonfiguruj SPF/DKIM w produkcji

5. **Session management**:
   - Token z e-maila ustawia nową sesję (Supabase)
   - Po zmianie hasła użytkownik pozostaje zalogowany
   - Opcjonalnie można wymusić wylogowanie: `signOut({ scope: 'global' })`

## Zależności

✅ **Już dostępne**:
- Supabase Auth - skonfigurowane w projekcie
- Validation schemas - w `auth.schemas.ts`
- RateLimitService - z metodami password reset
- Frontend components - ForgotPasswordForm, ResetPasswordForm
- Middleware - ścieżki dodane do PUBLIC_EXACT_PATHS
- Supabase client - createServerClient z SSR support

⚠️ **Wymaga konfiguracji**:
- Supabase Dashboard → Email Templates (Reset Password)
- Supabase Dashboard → Redirect URLs whitelist

❌ **Do zaimplementowania**:
- `/api/v1/auth/password/request-reset.ts`
- `/api/v1/auth/password/reset.ts`

## Estymacja
- **Czas implementacji**: 1-2 godziny (kod) + 30 min (konfiguracja Supabase)
- **Priorytet**: WYSOKI (security + user experience)
- **Złożoność**: NISKA (Supabase robi większość pracy)

## Kluczowe różnice od oryginalnego planu

### ❌ Niepotrzebne w nowym planie:
- Własna implementacja tokenów (Supabase to robi)
- Manualne wysyłanie e-maili (Supabase to robi)
- Manualne zarządzanie wygasaniem tokenów (Supabase to robi)
- Własny system sesji dla reset flow (Supabase to robi)
- Rate limiting per IP (używamy per e-mail, prostsze dla MVP)

### ✅ Wykorzystujemy istniejące wzorce:
- Struktura endpointów zgodna z `sign-in.ts`, `change.ts`
- ErrorResponse i ValidationErrorResponse z `types.ts`
- RateLimitService (już zaimplementowany)
- formatZodErrors dla spójnych błędów walidacji
- HttpStatus i ErrorCode enums
- locals.supabase zamiast tworzenia nowego clienta

### 📋 Uproszczenia dla MVP:
- Rate limiting in-memory (wystarczające dla MVP)
- Darmowy SMTP Supabase (dla produkcji: własny SMTP)
- Brak wylogowania wszystkich sesji po resecie (można dodać później)
- Neutralne komunikaty (bezpieczeństwo > UX)

## Uwagi końcowe

Plan został **znacząco uproszczony** i dostosowany do istniejącego stosu technologicznego:

1. **Supabase Auth robi całą ciężką robotę** - my tylko wywołujemy metody
2. **Istniejące serwisy są gotowe** - RateLimitService, validation schemas, middleware
3. **Frontend już działa** - komponenty i strony są kompletne
4. **Implementacja spójna z resztą projektu** - te same wzorce co sign-in, change password

**Główna praca**: Konfiguracja Supabase Dashboard + 2 proste endpointy API.
- Rate limiting zapobiega abuse
- Testowanie e-mail może wymagać real SMTP w produkcji (nie Supabase dev mode)

