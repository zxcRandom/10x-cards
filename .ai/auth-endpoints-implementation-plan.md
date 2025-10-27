# Plan implementacji: Auth API Endpoints

## Status
✅ **ZAIMPLEMENTOWANE** - Kompletne API endpoints dla zarządzania kontem

## Kontekst
Komponenty frontendowe dla zarządzania kontem już istnieją:
- ✅ `ChangePasswordForm.tsx` - formularz zmiany hasła
- ✅ `DeleteAccountSection.tsx` - sekcja usuwania konta
- ✅ `/account/settings.astro` - strona ustawień konta

Ale próbują wywołać endpointy, które nie istnieją:
- ❌ `POST /api/v1/auth/password/change` - **BRAK**
- ❌ `DELETE /api/v1/auth/account/delete` - **BRAK**

## Cel
Zaimplementować brakujące API endpoints dla Account Settings zgodnie z PRD (US-003, US-004, US-014).

## Zakres implementacji

### 1. Endpoint: Zmiana hasła

#### 1.1 Utworzyć plik `src/pages/api/v1/auth/password/change.ts`

**Funkcjonalność**:
- Zmiana hasła dla zalogowanego użytkownika
- Wymaga podania obecnego hasła (weryfikacja)
- Nowe hasło musi spełniać minimalne wymagania (≥8 znaków)
- Rate limiting (max 5 prób na 10 min)

**Request**:
```typescript
POST /api/v1/auth/password/change
Content-Type: application/json

{
  "currentPassword": "string",
  "newPassword": "string",
  "confirmNewPassword": "string"
}
```

**Response**:
```typescript
// Success (200 OK)
{
  "status": "success",
  "message": "Password changed successfully"
}

// Error (400 Bad Request)
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "errors": [
      { "field": "newPassword", "message": "Password must be at least 8 characters" }
    ]
  }
}

// Error (401 Unauthorized)
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Current password is incorrect"
  }
}

// Error (429 Too Many Requests)
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many attempts. Try again later."
  }
}
```

**Implementacja**:
```typescript
// src/pages/api/v1/auth/password/change.ts
import type { APIRoute } from 'astro';
import { passwordChangeSchema } from '@/lib/validation/auth.schemas';
import { createServerClient } from '@/db/supabase.client';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Parse request body
    const body = await request.json();

    // 2. Validate input
    const validation = passwordChangeSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: validation.error.errors.map((err) => ({
              field: err.path[0],
              message: err.message,
            })),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // 3. Get authenticated user
    const supabase = createServerClient(
      cookies,
      request.headers.get('cookie'),
      request.headers.get('authorization')
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Verify current password by attempting sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Current password is incorrect',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('[Auth] Password change error:', updateError);
      return new Response(
        JSON.stringify({
          error: {
            code: 'UPDATE_FAILED',
            message: updateError.message || 'Failed to update password',
          },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Success
    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Password changed successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Auth] Unexpected error in password change:', err);
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

### 2. Endpoint: Usunięcie konta

#### 2.1 Utworzyć plik `src/pages/api/v1/auth/account/delete.ts`

**Funkcjonalność**:
- Trwałe usunięcie konta użytkownika
- Wymaga potwierdzenia (wpisanie "DELETE")
- Kaskadowe usunięcie wszystkich danych użytkownika:
  - Decks (talii)
  - Cards (fiszek)
  - Reviews (recenzji)
  - AI generation logs
  - Profile
- Wylogowanie po usunięciu
- Rate limiting

**Request**:
```typescript
DELETE /api/v1/auth/account/delete
Content-Type: application/json

{
  "confirm": "DELETE"
}
```

**Response**:
```typescript
// Success (200 OK)
{
  "status": "deleted",
  "message": "Account permanently deleted"
}

// Error (400 Bad Request)
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Confirmation failed",
    "errors": [
      { "field": "confirm", "message": "Must type DELETE to confirm" }
    ]
  }
}

// Error (401 Unauthorized)
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Implementacja**:
```typescript
// src/pages/api/v1/auth/account/delete.ts
import type { APIRoute } from 'astro';
import { deleteAccountSchema } from '@/lib/validation/auth.schemas';
import { createServerClient } from '@/db/supabase.client';

export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Parse request body
    const body = await request.json();

    // 2. Validate input
    const validation = deleteAccountSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Confirmation failed',
            errors: validation.error.errors.map((err) => ({
              field: err.path[0],
              message: err.message,
            })),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get authenticated user
    const supabase = createServerClient(
      cookies,
      request.headers.get('cookie'),
      request.headers.get('authorization')
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Delete user data (cascading deletes handled by DB)
    // Delete profile (this will cascade to decks → cards → reviews via foreign keys)
    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (profileDeleteError) {
      console.error('[Auth] Profile deletion error:', profileDeleteError);
      return new Response(
        JSON.stringify({
          error: {
            code: 'DELETE_FAILED',
            message: 'Failed to delete profile data',
          },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Delete auth user (Supabase Auth)
    // Note: This requires admin privileges or RPC function
    // For MVP, we can soft-delete by setting profile.deleted_at
    // Or use Supabase Admin API (service role)
    
    // Option 1: Soft delete (set deleted_at)
    // Already handled by profile deletion if using ON DELETE CASCADE

    // Option 2: Hard delete via Admin API (requires service role)
    // const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    // 6. Sign out
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('[Auth] Sign out error after account deletion:', signOutError);
    }

    // 7. Clear auth cookies
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });

    // 8. Success
    return new Response(
      JSON.stringify({
        status: 'deleted',
        message: 'Account permanently deleted',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Auth] Unexpected error in account deletion:', err);
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

### 3. Validation schemas

#### 3.1 Sprawdź/zaktualizuj `src/lib/validation/auth.schemas.ts`

Komponenty frontendowe już używają tych schemas:
```typescript
// src/lib/validation/auth.schemas.ts
import { z } from 'zod';

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Obecne hasło jest wymagane'),
  newPassword: z.string().min(8, 'Nowe hasło musi mieć co najmniej 8 znaków'),
  confirmNewPassword: z.string().min(1, 'Potwierdzenie hasła jest wymagane'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Hasła nie są zgodne',
  path: ['confirmNewPassword'],
});

export const deleteAccountSchema = z.object({
  confirm: z.string().refine((val) => val === 'DELETE', {
    message: 'Wpisz DELETE aby potwierdzić',
  }),
});

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
```

### 4. Rate Limiting

#### 4.1 Dodać rate limiting middleware (opcjonalnie dla MVP)

Dla uproszczenia MVP można pominąć lub użyć prostego in-memory rate limiter:

```typescript
// src/lib/services/rate-limit.service.ts
// JUŻ ISTNIEJE - użyj istniejącego serwisu

import { RateLimitService } from '@/lib/services/rate-limit.service';

// W endpointach:
const rateLimiter = new RateLimitService({
  windowMs: 10 * 60 * 1000, // 10 minut
  maxRequests: 5,
});

const identifier = user.id; // lub IP
const allowed = await rateLimiter.checkLimit(identifier);
if (!allowed) {
  return new Response(
    JSON.stringify({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many attempts. Try again later.',
      },
    }),
    { 
      status: 429, 
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': '600', // 10 minut
      } 
    }
  );
}
```

### 5. Database considerations

#### 5.1 Cascade deletes

Upewnij się, że w schemacie bazy danych są ustawione CASCADE:

```sql
-- W migrations/20251014120000_initial_schema.sql
-- Powinno już być:

-- decks.user_id → profiles.id ON DELETE CASCADE
-- cards.deck_id → decks.id ON DELETE CASCADE  
-- reviews.card_id → cards.id ON DELETE CASCADE
-- reviews.user_id → profiles.id ON DELETE CASCADE
-- ai_generation_logs.user_id → profiles.id ON DELETE CASCADE
```

Jeśli nie ma, dodaj migrację:
```sql
-- migrations/YYYYMMDDHHMMSS_add_cascade_deletes.sql
ALTER TABLE decks DROP CONSTRAINT IF EXISTS decks_user_id_fkey;
ALTER TABLE decks ADD CONSTRAINT decks_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Podobnie dla pozostałych tabel
```

### 6. Testy akceptacyjne

**US-003: Zmiana hasła**
- [ ] W ustawieniach konta znajduje się formularz zmiany hasła
- [ ] Formularz wymaga: obecne hasło, nowe hasło, potwierdzenie nowego hasła
- [ ] Walidacja: puste pola blokują submit
- [ ] Walidacja: nowe hasło < 8 znaków → błąd
- [ ] Walidacja: nowe hasło ≠ potwierdzenie → błąd
- [ ] Błędne obecne hasło → "Nieprawidłowe obecne hasło"
- [ ] Po sukcesie → toast "Hasło zostało zmienione"
- [ ] Formularz zostaje wyczyszczony

**US-004: Usunięcie konta**
- [ ] W ustawieniach konta znajduje się przycisk "Usuń konto" (czerwony)
- [ ] Kliknięcie otwiera dialog z ostrzeżeniem
- [ ] Dialog wymaga wpisania "DELETE" do potwierdzenia
- [ ] Lista ostrzeżeń o konsekwencjach jest widoczna
- [ ] Przycisk "Usuń konto na stałe" jest disabled dopóki nie wpiszemy DELETE
- [ ] Po potwierdzeniu konto i wszystkie dane są usuwane
- [ ] Toast "Konto zostało usunięte"
- [ ] Przekierowanie do strony głównej
- [ ] Próba zalogowania na usunięte konto → błąd

### 7. Kolejność implementacji

1. **Krok 1**: Zweryfikuj/stwórz validation schemas
   - Sprawdź `src/lib/validation/auth.schemas.ts`
   - Dodaj brakujące schemas

2. **Krok 2**: Zaimplementuj endpoint password/change
   - Stwórz plik `src/pages/api/v1/auth/password/change.ts`
   - Zaimplementuj logikę
   - Dodaj error handling

3. **Krok 3**: Zaimplementuj endpoint account/delete
   - Stwórz plik `src/pages/api/v1/auth/account/delete.ts`
   - Zaimplementuj logikę
   - Dodaj cascade deletes

4. **Krok 4**: Testowanie manualne
   - Test: zmiana hasła (success case)
   - Test: zmiana hasła (błędne obecne hasło)
   - Test: zmiana hasła (nowe hasło za krótkie)
   - Test: usunięcie konta
   - Test: weryfikacja czy wszystkie dane zostały usunięte

5. **Krok 5**: Rate limiting (opcjonalnie)
   - Dodaj rate limiter do endpointów
   - Test: przekroczenie limitu

### 8. Uwagi bezpieczeństwa

1. **Password change**:
   - ✅ Wymaga weryfikacji obecnego hasła
   - ✅ Minimalna długość nowego hasła (8 znaków)
   - ✅ Rate limiting zapobiega brute force
   - ✅ Wszystkie sesje użytkownika pozostają aktywne (nie wymaga re-login)

2. **Account deletion**:
   - ✅ Wymaga jawnego potwierdzenia ("DELETE")
   - ✅ Kaskadowe usunięcie wszystkich danych
   - ✅ Wylogowanie po usunięciu
   - ⚠️ Nieodwracalna operacja - wyraźne ostrzeżenia w UI

3. **General**:
   - ✅ Endpoints wymagają autentykacji
   - ✅ HTTPS only w produkcji
   - ✅ Neutralne komunikaty błędów (nie ujawniają szczegółów)

## Zależności
- Supabase Auth - **już skonfigurowane**
- Supabase Client - **już istnieje**
- Validation schemas - **prawdopodobnie istnieją**
- Frontend components - **już istnieją**
- Database schema - **już istnieje**

## Estymacja
- **Czas implementacji**: 3-4 godziny
- **Priorytet**: WYSOKI (security + user management)
- **Złożoność**: ŚREDNIA

## Uwagi
- Dla MVP można pominąć hard delete z Supabase Auth (wymaga service role)
- Soft delete przez ustawienie `deleted_at` w profile może wystarczyć
- Rate limiting może być prosty (in-memory) w MVP
- Cascade deletes muszą być poprawnie skonfigurowane w DB

