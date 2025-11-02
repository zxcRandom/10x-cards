# Plan implementacji: Password Reset Flow (Forgot/Reset)

## Status

✅ **ZAIMPLEMENTOWANE** - Kompletny OTP-based password reset flow

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

**Wybrana metoda**: **OTP-based recovery** (kod 6-cyfrowy)

- ✅ Maksymalna prostota - wbudowany mechanizm Supabase
- ✅ Działa identycznie lokalnie i produkcyjnie
- ✅ Brak problemów z konfiguracją email templates
- ✅ Kody OTP automatycznie wysyłane przez Supabase

## Jak działa Supabase Auth Password Recovery

**Dokumentacja oficjalna** (z `/auth/v1/recover`, `/auth/v1/otp` i `/auth/v1/user`):

## Jak działa Supabase Auth Password Recovery

**Dokumentacja oficjalna** - Metoda OTP (One-Time Password):

### Flow OTP-based Recovery (Kod 6-cyfrowy)

**Zalety wyboru OTP**:

- ✅ Jeden mechanizm dla dev i production
- ✅ Brak konfiguracji email templates (Supabase ma domyślne)
- ✅ Brak problemów z redirect URLs
- ✅ Automatyczne zarządzanie kodami przez Supabase
- ✅ Kody widoczne w Supabase Dashboard (dev)

### 1. Request OTP Code

```typescript
// Wywołanie w naszym API
await supabase.auth.signInWithOtp({
  email: email,
  options: {
    shouldCreateUser: false, // nie twórz nowego usera dla password reset
  },
});
```

- **API**: `POST /auth/v1/otp`
- **Request**: `{ email: "user@example.com", create_user: false }`
- **Response**: `{ message_id: "xxx" }` (pusty obiekt {} też OK)
- **Email**: Supabase wysyła automatycznie z 6-cyfrowym kodem
- **Kod OTP**: Ważny przez 60 sekund (domyślnie)
- **Rate limit**: Max 1 email na 60 sekund (Supabase)

### 2. User Receives Email with OTP

Email zawiera:

```
Your code is: 123456

This code will expire in 60 seconds.
```

- Kod 6-cyfrowy (np. `123456`)
- Ważny przez 60 sekund
- Supabase używa domyślnego template (można dostosować)

### 3. Verify OTP Code

```typescript
// Wywołanie w naszym API
await supabase.auth.verifyOtp({
  email: email,
  token: otpCode, // 6-cyfrowy kod wpisany przez usera
  type: "email",
});
```

- **API**: `POST /auth/v1/verify`
- **Body**: `{ type: "email", token: "123456", email: "user@example.com" }`
- **Response**: `{ access_token, refresh_token, user }` + sesja w cookies
- **Sesja**: Automatycznie ustawiana przez @supabase/ssr
- **Kod**: Jednorazowy (po verify jest nieważny)

### 4. Update Password

```typescript
// Po weryfikacji OTP sesja jest już ustawiona
const {
  data: { user },
} = await supabase.auth.getUser();

// Zaktualizuj hasło
await supabase.auth.updateUser({ password: newPassword });
```

- **API**: `PUT /auth/v1/user`
- **Auth**: Wymaga aktywnej sesji (z OTP verify)
- **Body**: `{ "password": "new-password" }`
- **Response**: Zaktualizowany user object

## Flow resetowania hasła (PRD US-014)

**Flow OTP-based (kod 6-cyfrowy)**:

### Krok 1: Request OTP Code

1. Użytkownik wpisuje e-mail na `/auth/forgot-password`
2. Frontend → `POST /api/v1/auth/password/request-reset`
3. Backend → Supabase `POST /auth/v1/otp` przez `signInWithOtp()`
4. Supabase wysyła e-mail z 6-cyfrowym kodem OTP
5. **Zawsze zwracamy sukces** (neutralny komunikat dla bezpieczeństwa)

### Krok 2: Email with OTP Code

E-mail zawiera:

```
Your code is: 123456

This code will expire in 60 seconds.
```

- Kod 6-cyfrowy, ważny 60 sekund
- Domyślny template Supabase (można dostosować)

### Krok 3: Enter OTP Code

1. Użytkownik pozostaje na `/auth/forgot-password` lub `/auth/reset`
2. Formularz pokazuje pole do wpisania 6-cyfrowego kodu
3. Użytkownik wpisuje kod z e-maila (np. `123456`)

### Krok 4: Verify OTP and Set Password

1. Użytkownik wpisuje kod OTP + nowe hasło
2. Frontend → `POST /api/v1/auth/password/verify-and-reset`
3. Backend → Supabase `POST /auth/v1/verify` (weryfikacja OTP)
4. Backend → Supabase `PUT /auth/v1/user` (ustawienie hasła)
5. Przekierowanie do `/auth/login` z sukcesem

## Zakres implementacji

### 1. Endpoint: Request OTP Code

#### 1.1 Utworzyć plik `src/pages/api/v1/auth/password/request-reset.ts`

**Funkcjonalność**:

- Przyjmuje adres e-mail
- Wywołuje `supabase.auth.signInWithOtp()` - wysyła kod OTP
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
  "message": "Jeśli podany adres e-mail istnieje, wysłaliśmy kod weryfikacyjny"
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
 * Request OTP code for password reset via email.
 * US-014: Reset Password
 */

import type { APIRoute } from "astro";
import { passwordResetRequestSchema } from "@/lib/validation/auth.schemas";
import { formatZodErrors } from "@/lib/utils/zod-errors";
import { RateLimitService } from "@/lib/services/rate-limit.service";
import { HttpStatus, ErrorCode } from "@/types";
import type { ErrorResponse, ValidationErrorResponse } from "@/types";

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
            message: "Invalid JSON in request body",
          },
        } satisfies ErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Validate input
    const validationResult = passwordResetRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Validation failed",
            errors: formatZodErrors(validationResult.error),
          },
        } satisfies ValidationErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { "Content-Type": "application/json" } }
      );
    }

    const { email } = validationResult.data;

    // 3. Rate limiting - check BEFORE attempt
    const rateLimitCheck = await rateLimiter.checkPasswordResetRateLimit(email);
    if (!rateLimitCheck.allowed) {
      const retryAfterSeconds = rateLimitCheck.resetInMs ? Math.ceil(rateLimitCheck.resetInMs / 1000) : 60;

      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.TOO_MANY_REQUESTS,
            message: "Too many password reset attempts. Please try again later.",
            details: `Retry after ${retryAfterSeconds} seconds`,
          },
        } satisfies ErrorResponse),
        {
          status: HttpStatus.TOO_MANY_REQUESTS,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      );
    }

    // 4. Request OTP code from Supabase
    // Supabase sends 6-digit code via email, valid for 60 seconds
    const { error } = await locals.supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false, // Don't create user for password reset
      },
    });

    // 5. Increment rate limit AFTER attempt
    await rateLimiter.incrementPasswordResetRateLimit(email);

    // IMPORTANT: ALWAYS return success for security (neutral messaging)
    // Don't reveal whether email exists in the system
    if (error) {
      console.error("[Auth] OTP request error:", error);
      // Still return success to user
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Jeśli podany adres e-mail istnieje, wysłaliśmy kod weryfikacyjny (6 cyfr)",
      }),
      { status: HttpStatus.OK, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Auth] OTP request error:", err);

    // Still return success for security
    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Jeśli podany adres e-mail istnieje, wysłaliśmy kod weryfikacyjny (6 cyfr)",
      }),
      { status: HttpStatus.OK, headers: { "Content-Type": "application/json" } }
    );
  }
};
```

### 2. Endpoint: Verify OTP and Reset Password

#### 2.1 Utworzyć plik `src/pages/api/v1/auth/password/verify-and-reset.ts`

**Funkcjonalność**:

- Przyjmuje email, OTP code (6 cyfr) i nowe hasło
- Weryfikuje OTP przez `verifyOtp()` - ustawia sesję
- Aktualizuje hasło przez `updateUser()`
- Jednorazowa operacja (verify + update w jednym endpointcie)

**Request**:

```typescript
POST /api/v1/auth/password/verify-and-reset
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "new-strong-password"
}
```

**Response** (zgodny z types.ts):

```typescript
// Success (200 OK)
{
  "status": "ok",
  "message": "Hasło zostało zmienione pomyślnie"
}

// Error (400 Bad Request - invalid OTP)
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Nieprawidłowy lub wygasły kod weryfikacyjny"
  }
}

// Error (400 Bad Request - validation)
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "errors": [
      { "field": "otp", "message": "Kod musi mieć 6 cyfr" },
      { "field": "newPassword", "message": "Hasło musi mieć co najmniej 8 znaków" }
    ]
  }
}
```

**Implementacja**:

```typescript
/**
 * POST /api/v1/auth/password/verify-and-reset
 * Verify OTP code and reset password in one operation.
 * US-014: Reset Password
 */

import type { APIRoute } from "astro";
import { z } from "zod";
import { formatZodErrors } from "@/lib/utils/zod-errors";
import { HttpStatus, ErrorCode } from "@/types";
import type { ErrorResponse, ValidationErrorResponse } from "@/types";

export const prerender = false;

// Validation schema for OTP + password reset
const verifyAndResetSchema = z.object({
  email: z.string().email("Nieprawidłowy format adresu e-mail"),
  otp: z.string().length(6, "Kod musi mieć 6 cyfr").regex(/^\d+$/, "Kod musi zawierać tylko cyfry"),
  newPassword: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
});

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
            message: "Invalid JSON in request body",
          },
        } satisfies ErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Validate input
    const validationResult = verifyAndResetSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Validation failed",
            errors: formatZodErrors(validationResult.error),
          },
        } satisfies ValidationErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { "Content-Type": "application/json" } }
      );
    }

    const { email, otp, newPassword } = validationResult.data;

    // 3. Verify OTP code (this sets up session automatically)
    const { error: verifyError } = await locals.supabase.auth.verifyOtp({
      email: email,
      token: otp,
      type: "email",
    });

    if (verifyError) {
      console.error("[Auth] OTP verification error:", verifyError);
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: "Nieprawidłowy lub wygasły kod weryfikacyjny",
          },
        } satisfies ErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Update password (session is now active from verifyOtp)
    const { error: updateError } = await locals.supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("[Auth] Password update error:", updateError);
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: "Nie udało się zaktualizować hasła",
          },
        } satisfies ErrorResponse),
        { status: HttpStatus.INTERNAL_SERVER_ERROR, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Success
    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Hasło zostało zmienione pomyślnie",
      }),
      { status: HttpStatus.OK, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Auth] Verify and reset error:", err);
    return new Response(
      JSON.stringify({
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: "Wystąpił nieoczekiwany błąd",
        },
      } satisfies ErrorResponse),
      { status: HttpStatus.INTERNAL_SERVER_ERROR, headers: { "Content-Type": "application/json" } }
    );
  }
};
```

### 3. Validation Schemas

✅ **Częściowo istnieją** - `src/lib/validation/auth.schemas.ts`:

- ✅ `passwordResetRequestSchema` - walidacja e-mail (OK)
- ❌ Brak schema dla OTP + hasło

**Trzeba dodać**:

```typescript
// src/lib/validation/auth.schemas.ts

// Schema dla verify-and-reset (OTP + nowe hasło)
export const otpPasswordResetSchema = z.object({
  email: z.string().email("Nieprawidłowy format adresu e-mail"),
  otp: z.string().length(6, "Kod musi mieć 6 cyfr").regex(/^\d+$/, "Kod musi zawierać tylko cyfry"),
  newPassword: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
});

export type OtpPasswordResetInput = z.infer<typeof otpPasswordResetSchema>;
```

**LUB** użyj inline schema w endpoincie (jak w przykładzie powyżej).

### 4. Konfiguracja Supabase Dashboard

#### 4.1 Email Templates (Supabase Dashboard)

**OTP Email Template** - Supabase ma DOMYŚLNY template dla OTP!

**Lokalizacja**: `Authentication > Email Templates > Magic Link`

**Domyślny template Supabase** (działa out-of-the-box):

```
Your code is: {{ .Token }}

This code will expire in {{ .TokenExpiryDuration }}.
```

**✅ ZALETY**:

- Działa automatycznie bez konfiguracji
- Kod 6-cyfrowy widoczny w e-mailu
- Brak konieczności konfiguracji redirect URLs
- Brak konieczności konfiguracji {{ .ConfirmationURL }}

**Opcjonalnie - Polish version**:

```html
<h2>Kod resetowania hasła</h2>

<p>Twój kod weryfikacyjny:</p>
<h1 style="font-size: 32px; letter-spacing: 8px;">{{ .Token }}</h1>

<p>Kod jest ważny przez {{ .TokenExpiryDuration }} sekund.</p>
<p>Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
```

**NIE WYMAGA konfiguracji**:

- ❌ Redirect URLs - nie używamy linków
- ❌ {{ .ConfirmationURL }} - nie używamy
- ❌ Site URL - nie potrzebne dla OTP

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

**Part 1: Request OTP**

- [ ] Na ekranie logowania jest link "Nie pamiętasz hasła?" → `/auth/forgot-password`
- [ ] Formularz wymaga adresu e-mail
- [ ] Po wysłaniu: neutralny komunikat (zawsze sukces, nawet jeśli e-mail nie istnieje)
- [ ] Komunikat **nie ujawnia**, czy e-mail istnieje w systemie
- [ ] E-mail z kodem OTP jest wysyłany (jeśli adres istnieje w systemie)
- [ ] E-mail zawiera kod 6-cyfrowy (np. `123456`)
- [ ] Kod jest ważny przez 60 sekund
- [ ] Próba żądania OTP więcej niż **3 razy w 1 min** → błąd 429

**Part 2: Verify OTP and Reset Password**

- [ ] Po wysłaniu formularza pokazuje się pole na kod OTP
- [ ] Formularz wymaga: kod OTP (6 cyfr) + nowe hasło (2x)
- [ ] Walidacja client-side: kod != 6 cyfr → błąd
- [ ] Walidacja client-side: hasło < 8 znaków → błąd
- [ ] Walidacja client-side: hasła nie są zgodne → błąd
- [ ] Nieprawidłowy kod OTP → komunikat "Nieprawidłowy lub wygasły kod"
- [ ] Wygasły kod (po 60s) → komunikat "Nieprawidłowy lub wygasły kod"
- [ ] Po sukcesie → toast "Hasło zostało zmienione"
- [ ] Przekierowanie do `/auth/login`
- [ ] Możliwość zalogowania z nowym hasłem

### 7. Kolejność implementacji

1. ✅ **Krok 0**: Sprawdź co już istnieje
   - ✅ Validation schema dla email w `auth.schemas.ts`
   - ✅ RateLimitService z metodami password reset
   - ✅ Middleware z dodanymi ścieżkami
   - ✅ Frontend komponenty (wymaga aktualizacji do OTP)

2. **Krok 1**: Zaimplementuj endpoint `request-reset` (OTP)
   - Stwórz `src/pages/api/v1/auth/password/request-reset.ts`
   - Użyj `signInWithOtp()` zamiast `resetPasswordForEmail()`
   - Rate limiting per e-mail (RateLimitService)
   - ZAWSZE zwracaj sukces (neutralny komunikat)

3. **Krok 2**: Zaimplementuj endpoint `verify-and-reset`
   - Stwórz `src/pages/api/v1/auth/password/verify-and-reset.ts`
   - Verify OTP: `verifyOtp()`
   - Update password: `updateUser({ password })`
   - Jednorazowa operacja (verify + update)

4. **Krok 3**: Aktualizuj frontend (opcjonalne)
   - `ForgotPasswordForm.tsx` - może pozostać bez zmian (request-reset)
   - `ResetPasswordForm.tsx` lub nowy `VerifyOtpAndResetForm.tsx`
   - Formularz: email + OTP (6 cyfr) + nowe hasło (2x)
   - Call `/api/v1/auth/password/verify-and-reset`

5. **Krok 4**: Testowanie end-to-end
   - Test: request OTP dla istniejącego e-mail
   - Test: request OTP dla nieistniejącego e-mail (neutralny komunikat)
   - Test: weryfikacja poprawnego kodu OTP
   - Test: ustawienie nowego hasła
   - Test: logowanie z nowym hasłem
   - Test: nieprawidłowy kod OTP → błąd
   - Test: wygasły kod (po 60s) → błąd
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

3. **OTP security** (zarządzane przez Supabase Auth):
   - ✅ Kod 6-cyfrowy (1 milion kombinacji)
   - ✅ Wygasa po 60 sekundach (bardzo krótko!)
   - ✅ Jednorazowy (po verify jest nieważny)
   - ✅ Nie może być użyty ponownie

4. **Email delivery** (Supabase SMTP):
   - ⚠️ Darmowy tier ma limity (kilka e-maili/godzinę)
   - ⚠️ Dla production: skonfiguruj własny SMTP (SendGrid, AWS SES)
   - ⚠️ Upewnij się, że e-maile nie trafiają do spam
   - ⚠️ Skonfiguruj SPF/DKIM w produkcji

5. **Session management**:
   - Verify OTP ustawia nową sesję (Supabase)
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

⚠️ **Wymaga konfiguracji (opcjonalne)**:

- Supabase Dashboard → Email Templates → Magic Link (OTP) - ma domyślny template
- Własny SMTP dla produkcji (opcjonalne)

❌ **Do zaimplementowania**:

- `/api/v1/auth/password/request-reset.ts` (OTP request)
- `/api/v1/auth/password/verify-and-reset.ts` (OTP verify + password update)

## Estymacja

- **Czas implementacji**: 1-2 godziny (kod backend + frontend)
- **Priorytet**: WYSOKI (security + user experience)
- **Złożoność**: BARDZO NISKA (wbudowany mechanizm Supabase OTP)

## Kluczowe zalety wyboru OTP

### ✅ Prostota implementacji:

- Brak konfiguracji email templates (domyślny działa)
- Brak konfiguracji redirect URLs
- Brak konieczności obsługi token exchange
- Jeden mechanizm dla dev i production

### ✅ Wbudowane mechanizmy Supabase:

- `signInWithOtp()` - wysyła kod automatycznie
- `verifyOtp()` - weryfikuje i ustawia sesję
- Domyślny template email z kodem
- Automatyczne zarządzanie wygasaniem (60s)

### ✅ Bezpieczeństwo:

- Kod 6-cyfrowy (1 milion kombinacji)
- Bardzo krótki czas życia (60s)
- Jednorazowy kod
- Rate limiting (3/min per email)

### ⚠️ Trade-off:

- **UX**: Użytkownik musi wpisać kod (zamiast kliknięcia linku)
- **Czas życia**: 60 sekund (może być za krótko dla niektórych użytkowników)

## Uwagi końcowe

Plan został **maksymalnie uproszczony** zgodnie z wymaganiem "maksymalnej prostoty i użycia wbudowanych mechanizmów":

1. **Używamy natywnego OTP Supabase** - zero custom logic
2. **Domyślny email template** - zero konfiguracji
3. **Brak token exchange** - Supabase robi to automatycznie
4. **Jeden flow dla dev i prod** - identyczna implementacja
5. **Istniejące serwisy** - RateLimitService, validation schemas gotowe

**Główna praca**: 2 endpointy API (request OTP + verify & reset).

- Endpoint 1: `signInWithOtp()` - 1 linia kodu
- Endpoint 2: `verifyOtp()` + `updateUser()` - 2 linie kodu
- Reszta: error handling i rate limiting (wzorowane na istniejących endpointach)
