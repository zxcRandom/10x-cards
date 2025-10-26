# Plan implementacji: Password Reset Flow (Forgot/Reset)

## Status
❌ **Niezaimplementowane** - Brakuje API endpoints dla reset hasła

## Kontekst
Komponenty frontendowe dla reset hasła już istnieją:
- ✅ `ForgotPasswordForm.tsx` - formularz żądania resetu
- ✅ `ResetPasswordForm.tsx` - formularz ustawiania nowego hasła
- ✅ `/auth/forgot-password.astro` - strona żądania resetu
- ✅ `/auth/reset.astro` - strona ustawiania nowego hasła

Ale próbują wywołać endpointy, które nie istnieją:
- ❌ `POST /api/v1/auth/password/request-reset` - **BRAK**
- ❌ `POST /api/v1/auth/password/reset` - **BRAK**

## Cel
Zaimplementować kompletny flow resetowania hasła zgodnie z PRD (US-014).

## Flow resetowania hasła (PRD US-014)

1. **Forgot Password Request**:
   - Użytkownik wpisuje e-mail
   - System wysyła link resetowania (jeśli e-mail istnieje)
   - Neutralny komunikat (nie ujawnia, czy e-mail istnieje)
   - Link ważny 60 minut, jednorazowy

2. **Reset Password**:
   - Użytkownik klika link z e-maila
   - Wpisuje nowe hasło (dwukrotnie)
   - System zmienia hasło
   - Poprzednie sesje mogą zostać unieważnione
   - Przekierowanie do logowania

## Zakres implementacji

### 1. Endpoint: Request Password Reset

#### 1.1 Utworzyć plik `src/pages/api/v1/auth/password/request-reset.ts`

**Funkcjonalność**:
- Przyjmuje adres e-mail
- Generuje jednorazowy link resetowania (token)
- Wysyła e-mail z linkiem
- **Zawsze zwraca sukces** (neutralny komunikat dla bezpieczeństwa)
- Rate limiting (max 3 próby na 10 minut per IP/e-mail)

**Request**:
```typescript
POST /api/v1/auth/password/request-reset
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response**:
```typescript
// Success (200 OK) - ZAWSZE zwracane dla bezpieczeństwa
{
  "status": "success",
  "message": "If the email exists, reset instructions have been sent"
}

// Error (429 Too Many Requests)
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many reset attempts. Try again later."
  }
}
```

**Implementacja**:
```typescript
// src/pages/api/v1/auth/password/request-reset.ts
import type { APIRoute } from 'astro';
import { passwordResetRequestSchema } from '@/lib/validation/auth.schemas';
import { createServerClient } from '@/db/supabase.client';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Parse and validate input
    const body = await request.json();
    const validation = passwordResetRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
            errors: validation.error.errors.map((err) => ({
              field: err.path[0],
              message: err.message,
            })),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email } = validation.data;

    // 2. Create Supabase client
    const supabase = createServerClient(
      cookies,
      request.headers.get('cookie'),
      request.headers.get('authorization')
    );

    // 3. Send password reset email via Supabase Auth
    // Supabase handles token generation, email sending, and expiration (1 hour)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${new URL(request.url).origin}/auth/reset`,
    });

    // 4. ALWAYS return success (neutral messaging for security)
    // Don't reveal if email exists or not
    if (error) {
      console.error('[Auth] Password reset request error:', error);
      // Still return success to user
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'If the email exists, reset instructions have been sent',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Auth] Unexpected error in password reset request:', err);
    
    // Even on error, return neutral success message
    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'If the email exists, reset instructions have been sent',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

### 2. Endpoint: Reset Password

#### 2.1 Utworzyć plik `src/pages/api/v1/auth/password/reset.ts`

**Funkcjonalność**:
- Weryfikuje token z URL
- Ustawia nowe hasło
- Wylogowuje wszystkie sesje (opcjonalnie)
- Token jednorazowy, wygasa po 60 min

**Request**:
```typescript
POST /api/v1/auth/password/reset
Content-Type: application/json

{
  "newPassword": "string"
}

// Token jest w query params URL (?code=xxx) lub w access_token cookie
// Ustaw przez Supabase Auth automatycznie
```

**Response**:
```typescript
// Success (200 OK)
{
  "status": "success",
  "message": "Password has been reset successfully"
}

// Error (401 Unauthorized - invalid/expired token)
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Reset link has expired or is invalid"
  }
}

// Error (400 Bad Request - validation)
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Password validation failed",
    "errors": [
      { "field": "newPassword", "message": "Must be at least 8 characters" }
    ]
  }
}
```

**Implementacja**:
```typescript
// src/pages/api/v1/auth/password/reset.ts
import type { APIRoute } from 'astro';
import { passwordResetSchema } from '@/lib/validation/auth.schemas';
import { createServerClient } from '@/db/supabase.client';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Parse and validate input
    const body = await request.json();
    const validation = passwordResetSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Password validation failed',
            errors: validation.error.errors.map((err) => ({
              field: err.path[0],
              message: err.message,
            })),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { newPassword } = validation.data;

    // 2. Create Supabase client
    const supabase = createServerClient(
      cookies,
      request.headers.get('cookie'),
      request.headers.get('authorization')
    );

    // 3. Get user from token (Supabase Auth handles token validation)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Reset link has expired or is invalid',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('[Auth] Password reset error:', updateError);
      return new Response(
        JSON.stringify({
          error: {
            code: 'UPDATE_FAILED',
            message: updateError.message || 'Failed to reset password',
          },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Optionally: Sign out all sessions (force re-login)
    // await supabase.auth.signOut({ scope: 'global' });

    // 6. Success
    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Password has been reset successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Auth] Unexpected error in password reset:', err);
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

### 3. Validation Schemas

#### 3.1 Sprawdź/zaktualizuj `src/lib/validation/auth.schemas.ts`

Komponenty już używają tych schemas:
```typescript
// src/lib/validation/auth.schemas.ts
import { z } from 'zod';

export const passwordResetRequestSchema = z.object({
  email: z.string().email('Nieprawidłowy format adresu e-mail'),
});

export const passwordResetSchema = z.object({
  newPassword: z.string().min(8, 'Hasło musi mieć co najmniej 8 znaków'),
  confirmNewPassword: z.string().min(1, 'Potwierdzenie hasła jest wymagane'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Hasła nie są zgodne',
  path: ['confirmNewPassword'],
});

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
```

### 4. Konfiguracja e-mail (Supabase Auth)

#### 4.1 Email Templates w Supabase Dashboard

**Lokalizacja**: Authentication > Email Templates > Reset Password

**Domyślny template** (można dostosować):
```html
<h2>Reset Your Password</h2>
<p>Follow this link to reset the password for your account:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>This link will expire in 60 minutes.</p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

**Polish version** (do ustawienia):
```html
<h2>Zresetuj hasło</h2>
<p>Kliknij poniższy link, aby zresetować hasło do swojego konta:</p>
<p><a href="{{ .ConfirmationURL }}">Ustaw nowe hasło</a></p>
<p>Link jest ważny przez 60 minut.</p>
<p>Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
```

**Redirect URL**: `http://localhost:3000/auth/reset` (dev) / `https://yourdomain.com/auth/reset` (prod)

### 5. Rate Limiting

#### 5.1 Dodać rate limiting w request-reset endpoint

```typescript
// W POST handler przed wywołaniem resetPasswordForEmail:

import { RateLimitService } from '@/lib/services/rate-limit.service';

const rateLimiter = new RateLimitService({
  windowMs: 10 * 60 * 1000, // 10 minut
  maxRequests: 3,
});

// Rate limit per IP
const clientIp = request.headers.get('cf-connecting-ip') || 
                request.headers.get('x-forwarded-for') || 
                'unknown';
const allowed = await rateLimiter.checkLimit(`reset:${clientIp}`);

if (!allowed) {
  return new Response(
    JSON.stringify({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many reset attempts. Try again in 10 minutes.',
      },
    }),
    { 
      status: 429, 
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': '600',
      } 
    }
  );
}
```

### 6. Testy akceptacyjne

**US-014: Reset zapomnianego hasła**

**Part 1: Request Reset**
- [ ] Na ekranie logowania jest link "Nie pamiętasz hasła?"
- [ ] Link prowadzi do `/auth/forgot-password`
- [ ] Formularz wymaga adresu e-mail
- [ ] Po wysłaniu wyświetla się neutralny komunikat o wysłaniu instrukcji
- [ ] Komunikat nie ujawnia, czy e-mail istnieje w systemie
- [ ] E-mail z linkiem resetowania jest wysyłany (jeśli adres istnieje)
- [ ] Link jest ważny 60 minut
- [ ] Próba żądania resetu więcej niż 3 razy w 10 min → błąd 429

**Part 2: Reset Password**
- [ ] Link z e-maila prowadzi do `/auth/reset?code=xxx`
- [ ] Formularz wymaga dwukrotnego wpisania nowego hasła
- [ ] Walidacja: hasło < 8 znaków → błąd
- [ ] Walidacja: hasła nie są zgodne → błąd
- [ ] Wygasły/nieprawidłowy link → komunikat o wygaśnięciu
- [ ] Po sukcesie → toast "Hasło zostało zmienione"
- [ ] Przekierowanie do `/auth/login` z komunikatem
- [ ] Możliwość zalogowania z nowym hasłem

### 7. Kolejność implementacji

1. **Krok 1**: Zweryfikuj/stwórz validation schemas
   - Sprawdź `src/lib/validation/auth.schemas.ts`
   - Dodaj brakujące schemas

2. **Krok 2**: Skonfiguruj Supabase Email Templates
   - W Supabase Dashboard → Authentication → Email Templates
   - Ustaw template "Reset Password"
   - Ustaw redirect URL
   - Przetestuj wysyłanie e-mail

3. **Krok 3**: Zaimplementuj endpoint `request-reset`
   - Stwórz plik `src/pages/api/v1/auth/password/request-reset.ts`
   - Zaimplementuj logikę
   - Dodaj rate limiting

4. **Krok 4**: Zaimplementuj endpoint `reset`
   - Stwórz plik `src/pages/api/v1/auth/password/reset.ts`
   - Zaimplementuj logikę

5. **Krok 5**: Testowanie end-to-end
   - Test: request reset dla istniejącego e-mail
   - Test: request reset dla nieistniejącego e-mail (neutralny komunikat)
   - Test: kliknięcie linku z e-maila
   - Test: ustawienie nowego hasła
   - Test: logowanie z nowym hasłem
   - Test: wygasły link (po 60 min)
   - Test: próba użycia linku dwa razy (jednorazowy)
   - Test: rate limiting (4+ próby w 10 min)

### 8. Uwagi bezpieczeństwa

1. **Neutralne komunikaty**:
   - ✅ ZAWSZE zwracaj sukces dla request-reset (nie ujawniaj, czy e-mail istnieje)
   - ✅ Nie ujawniaj szczegółów błędów w odpowiedziach

2. **Rate limiting**:
   - ✅ Max 3 próby na 10 minut per IP
   - ✅ Zapobiega brute force i spamowi

3. **Token security**:
   - ✅ Token jednorazowy (Supabase Auth)
   - ✅ Wygasa po 60 minutach
   - ✅ Bezpieczne przechowywanie (hashed w DB)

4. **Email delivery**:
   - ⚠️ Upewnij się, że e-maile nie trafiają do spam
   - ⚠️ Skonfiguruj SPF/DKIM w produkcji
   - ⚠️ Użyj dedykowanej domeny dla e-mail

5. **Session management**:
   - ⚠️ Opcjonalnie: wyloguj wszystkie sesje po resecie
   - ⚠️ Wymaga ponownego logowania

## Zależności
- Supabase Auth - **już skonfigurowane**
- Supabase Email Service - **wymaga konfiguracji templates**
- Validation schemas - **prawdopodobnie istnieją**
- Frontend components - **już istnieją**

## Estymacja
- **Czas implementacji**: 3-4 godziny (+ czas na konfigurację Supabase)
- **Priorytet**: WYSOKI (security + user experience)
- **Złożoność**: ŚREDNIA

## Uwagi
- Supabase Auth obsługuje większość logiki (token generation, expiration, email sending)
- Główna praca to konfiguracja templates i endpointy opakowujące Supabase API
- Neutralne komunikaty są krytyczne dla bezpieczeństwa
- Rate limiting zapobiega abuse
- Testowanie e-mail może wymagać real SMTP w produkcji (nie Supabase dev mode)

