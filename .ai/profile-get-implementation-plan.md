# API Endpoint Implementation Plan: GET /api/v1/profile

## 1. Przegląd punktu końcowego

### Cel
Endpoint służy do pobierania profilu zalogowanego użytkownika. Zwraca dane profilu użytkownika z tabeli `public.profiles`, która rozszerza podstawowe informacje z `auth.users` o dane specyficzne dla aplikacji (zgoda na prywatność, soft delete).

### Charakterystyka
- **Metoda HTTP**: GET
- **Ścieżka**: `/api/v1/profile`
- **Uwierzytelnianie**: Wymagane (Supabase JWT w nagłówku Authorization)
- **Autoryzacja**: Użytkownik może pobrać tylko swój własny profil
- **Idempotentność**: Tak (GET jest idempotentny)

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
/api/v1/profile
```

### Parametry

#### Parametry ścieżki (path parameters)
Brak

#### Parametry zapytania (query parameters)
Brak

#### Request Body
Nie dotyczy (metoda GET nie przyjmuje body)

### Nagłówki wymagane
```
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

### Przykład żądania
```http
GET /api/v1/profile HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

#### ProfileDTO
```typescript
// Już zdefiniowany w src/types.ts
export interface ProfileDTO {
  id: string;                    // UUID użytkownika (z auth.users)
  privacyConsent: boolean;       // Zgoda na przetwarzanie przez AI
  deletedAt: string | null;      // Data soft delete (ISO-8601) lub null
  createdAt: string;             // Data utworzenia profilu (ISO-8601)
  updatedAt: string;             // Data ostatniej aktualizacji (ISO-8601)
}
```

### Typy pomocnicze

#### DbProfile
```typescript
// Już zdefiniowany w src/types.ts
export type DbProfile = Tables<'profiles'>;

// Struktura z database.types.ts:
// {
//   id: string;
//   privacy_consent: boolean;
//   deleted_at: string | null;
//   created_at: string;
//   updated_at: string;
// }
```

### Typy błędów

#### ErrorResponse
```typescript
// Do zdefiniowania w src/types.ts (wspólne dla wszystkich endpointów)
interface ErrorResponse {
  error: {
    code: string;           // Kod błędu (np. "UNAUTHORIZED", "NOT_FOUND")
    message: string;        // Opis błędu czytelny dla człowieka
    details?: unknown;      // Opcjonalne szczegóły (tylko w dev mode)
  }
}
```

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

#### Status HTTP
`200 OK`

#### Response Body
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "privacyConsent": true,
  "deletedAt": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T14:45:30.000Z"
}
```

#### Nagłówki odpowiedzi
```
Content-Type: application/json
Cache-Control: no-cache, no-store, must-revalidate
```

### Błędy

#### 401 Unauthorized
**Przyczyna**: Brak tokenu JWT, token wygasły lub nieprawidłowy

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please provide a valid access token."
  }
}
```

#### 404 Not Found
**Przyczyna**: Profil użytkownika nie istnieje w bazie danych

```json
{
  "error": {
    "code": "PROFILE_NOT_FOUND",
    "message": "User profile not found. Please contact support if this issue persists."
  }
}
```

**Uwaga**: Ten błąd nie powinien wystąpić w normalnym przepływie, ponieważ profil jest tworzony automatycznie przez trigger `handle_new_user()` przy rejestracji. Jeśli wystąpi, może wskazywać na problem z integracją Supabase Auth lub ręczne usunięcie profilu.

#### 500 Internal Server Error
**Przyczyna**: Błąd połączenia z bazą danych lub nieobsłużony wyjątek

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  }
}
```

## 5. Przepływ danych

### Diagram przepływu
```
┌─────────────┐
│   Klient    │
└──────┬──────┘
       │ GET /api/v1/profile + JWT Token
       │
       ▼
┌─────────────────────────────────────────┐
│  Astro Middleware (src/middleware)      │
│  - Weryfikacja JWT tokenu               │
│  - Inicjalizacja locals.supabase        │
│  - Pobranie user z getUser()            │
└──────┬──────────────────────────────────┘
       │ context.locals.supabase, user.id
       │
       ▼
┌─────────────────────────────────────────┐
│  API Route Handler                      │
│  (src/pages/api/v1/profile.ts)          │
│  - Sprawdzenie czy user jest zalogowany │
│  - Wywołanie ProfileService             │
└──────┬──────────────────────────────────┘
       │ user.id, supabase client
       │
       ▼
┌─────────────────────────────────────────┐
│  ProfileService.getProfile()            │
│  (src/lib/services/profile.service.ts)  │
│  - Query: SELECT * FROM profiles        │
│    WHERE id = user.id                   │
└──────┬──────────────────────────────────┘
       │ DbProfile | null
       │
       ▼
┌─────────────────────────────────────────┐
│  Mapowanie danych                       │
│  - mapProfileToDTO(dbProfile)           │
│  - Konwersja snake_case → camelCase     │
│  - Formatowanie dat do ISO-8601         │
└──────┬──────────────────────────────────┘
       │ ProfileDTO
       │
       ▼
┌─────────────────────────────────────────┐
│  Response                               │
│  - Status: 200 OK                       │
│  - Body: ProfileDTO (JSON)              │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Klient    │
└─────────────┘
```

### Szczegółowy opis przepływu

#### Krok 1: Weryfikacja autentykacji (Middleware)
- Middleware Astro pobiera token JWT z nagłówka `Authorization`
- Tworzy klienta Supabase powiązanego z żądaniem: `context.locals.supabase`
- Wywołuje `supabase.auth.getUser()` aby pobrać dane użytkownika
- Jeśli token jest nieprawidłowy → zwraca 401 Unauthorized

#### Krok 2: Handler endpointu
- Sprawdza czy `user` istnieje w kontekście (double-check)
- Wywołuje `ProfileService.getProfile(user.id, supabase)`
- Obsługuje błędy i zwraca odpowiednie kody statusu

#### Krok 3: Pobieranie danych z bazy (Service)
- Wykonuje query SQL przez Supabase client:
  ```sql
  SELECT id, privacy_consent, deleted_at, created_at, updated_at
  FROM public.profiles
  WHERE id = $1
  ```
- Zwraca pojedynczy wiersz lub null

#### Krok 4: Mapowanie i odpowiedź
- Konwertuje `DbProfile` (snake_case) na `ProfileDTO` (camelCase)
- Serializuje daty do formatu ISO-8601 string
- Zwraca JSON response z kodem 200

## 6. Względy bezpieczeństwa

### Uwierzytelnianie (Authentication)

#### Mechanizm
- **Supabase JWT**: Token dostępowy generowany przez Supabase Auth
- **Weryfikacja**: Automatyczna przez Supabase client podczas `getUser()`
- **Lokalizacja**: Nagłówek `Authorization: Bearer <token>`

#### Implementacja w middleware
```typescript
// src/middleware/index.ts
const { data: { user }, error } = await supabase.auth.getUser();

if (error || !user) {
  return new Response(JSON.stringify({
    error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
  }), { status: 401 });
}

context.locals.user = user;
```

### Autoryzacja (Authorization)

#### Zasada
Użytkownik może pobrać **tylko swój własny profil**. User ID pochodzi z zweryfikowanego tokenu JWT, nigdy z parametrów żądania.

#### Implementacja
```typescript
// W API route handler
const userId = context.locals.user.id; // Z tokenu JWT
const profile = await ProfileService.getProfile(userId, supabase);
```

**Ważne**: Nigdy nie używać user ID z query params, path params ani body - zawsze z tokenu!

### Row Level Security (RLS)

#### Stan obecny (z migracji)
- RLS jest **włączony** na tabeli `public.profiles`
- **Brak zdefiniowanych polityk** → dostęp domyślnie ZABRONIONY

#### Wymagane polityki RLS

Przed wdrożeniem produkcyjnym należy dodać polityki:

```sql
-- Polityka SELECT: użytkownik może odczytać tylko swój profil
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Polityka UPDATE: użytkownik może aktualizować tylko swój profil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);
```

#### Tymczasowe rozwiązanie (DEV)
Dla środowiska deweloperskiego można:
1. Użyć **service role key** (bypasses RLS) - **NIE dla produkcji!**
2. LUB dodać polityki RLS natychmiast

**Rekomendacja**: Dodać polityki RLS od razu, nawet w DEV.

### Walidacja danych

#### Dane wejściowe
- Brak parametrów do walidacji (user ID z tokenu jest już zweryfikowany)

#### Dane wyjściowe
- Upewnić się, że daty są w formacie ISO-8601
- Sprawdzić czy wszystkie wymagane pola są obecne przed zwróceniem

### Ochrona przed atakami

#### SQL Injection
- **Chronione**: Używamy Supabase client z parametryzowanymi zapytaniami
- Supabase automatycznie escapuje parametry

#### XSS (Cross-Site Scripting)
- **Nie dotyczy**: Endpoint zwraca JSON (nie HTML)
- Frontend musi sanityzować dane przed wyświetleniem

#### CSRF (Cross-Site Request Forgery)
- **Chronione**: JWT token w nagłówku (nie w cookie)
- Same-Origin Policy przeglądarek

#### Rate Limiting
- **Rekomendacja**: Dodać rate limiting na poziomie API gateway lub middleware
- Sugerowane limity: 100 req/min per IP, 50 req/min per user

## 7. Obsługa błędów

### Macierz błędów

| Scenariusz | Kod HTTP | Kod błędu | Komunikat | Akcja |
|------------|----------|-----------|-----------|-------|
| Brak tokenu JWT | 401 | UNAUTHORIZED | "Authentication required" | Zwróć 401, loguj |
| Token JWT nieprawidłowy | 401 | UNAUTHORIZED | "Invalid or expired token" | Zwróć 401, loguj |
| Token JWT wygasł | 401 | UNAUTHORIZED | "Token expired" | Zwróć 401, odśwież token |
| Profil nie istnieje | 404 | PROFILE_NOT_FOUND | "User profile not found" | Zwróć 404, loguj (alert!) |
| Błąd połączenia z DB | 500 | DATABASE_ERROR | "Database connection failed" | Zwróć 500, loguj szczegóły |
| Nieobsłużony wyjątek | 500 | INTERNAL_SERVER_ERROR | "Unexpected error occurred" | Zwróć 500, loguj stack trace |
| Supabase RLS blokuje dostęp | 500 | DATABASE_ERROR | "Access denied" | Zwróć 500, loguj (fix RLS!) |

### Strategia logowania

#### Co logować

**Zawsze loguj (ERROR level)**:
- 404 Not Found dla profilu (powinno być bardzo rzadkie - wskazuje problem)
- 500 Internal Server Error (wszystkie błędy serwera)
- Błędy połączenia z bazą danych
- Nieobsłużone wyjątki

**Opcjonalnie loguj (INFO level)**:
- Pomyślne żądania (dla analytics)
- 401 Unauthorized (może wskazywać na ataki)

**Nie loguj**:
- Zawartości tokenu JWT (security risk)
- Danych osobowych użytkownika (GDPR)

#### Format logów

```typescript
console.error('[GET /api/v1/profile]', {
  userId: user.id,
  error: error.message,
  code: error.code,
  timestamp: new Date().toISOString(),
  // W DEV: stack trace
  ...(import.meta.env.DEV && { stack: error.stack })
});
```

### Obsługa błędów w kodzie

#### Try-catch pattern
```typescript
try {
  const profile = await ProfileService.getProfile(userId, supabase);
  
  if (!profile) {
    return new Response(JSON.stringify({
      error: {
        code: 'PROFILE_NOT_FOUND',
        message: 'User profile not found'
      }
    }), { status: 404 });
  }
  
  return new Response(JSON.stringify(profile), { status: 200 });
  
} catch (error) {
  console.error('[GET /api/v1/profile] Error:', error);
  
  return new Response(JSON.stringify({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  }), { status: 500 });
}
```

#### Early returns dla błędów
Zgodnie z zasadami clean code, sprawdzaj błędy na początku funkcji:

```typescript
// ✅ Dobre - early return
if (!user) {
  return errorResponse(401, 'UNAUTHORIZED');
}

const profile = await getProfile(user.id);
if (!profile) {
  return errorResponse(404, 'PROFILE_NOT_FOUND');
}

return successResponse(profile);

// ❌ Złe - głębokie zagnieżdżenia
if (user) {
  const profile = await getProfile(user.id);
  if (profile) {
    return successResponse(profile);
  } else {
    return errorResponse(404);
  }
} else {
  return errorResponse(401);
}
```

## 8. Rozważania dotyczące wydajności

### Optymalizacje zapytań

#### Indeksy bazodanowe
- **Primary key na `profiles.id`**: Automatycznie zindeksowany (UUID)
- **Indeks na `profiles.deleted_at`**: Już istnieje (partial index dla `deleted_at IS NULL`)
- Query SELECT po PK jest **bardzo szybkie** (O(log n))

#### Query
```sql
-- Zoptymalizowane zapytanie (wykorzystuje PK index)
SELECT id, privacy_consent, deleted_at, created_at, updated_at
FROM public.profiles
WHERE id = $1
LIMIT 1;
```

**Wydajność**: ~1-5ms dla pojedynczego rekordu

### Caching

#### Strategia cachowania

**Nie cachować na poziomie serwera** z powodu:
- Dane profilu mogą się często zmieniać (privacy_consent, deleted_at)
- Proste zapytanie po PK jest już bardzo szybkie
- Ryzyko zwrócenia nieaktualnych danych

**Cachowanie po stronie klienta**:
```http
Cache-Control: private, max-age=300
```
- `private`: Cache tylko w przeglądarce użytkownika (nie w shared cache)
- `max-age=300`: 5 minut (wystarczające dla profilu)

**Lub brak cachowania** (zalecane dla MVP):
```http
Cache-Control: no-cache, no-store, must-revalidate
```

### Connection pooling

- **Supabase client**: Automatycznie zarządza poolem połączeń
- **Konfiguracja**: Domyślne ustawienia Supabase są wystarczające dla MVP
- **Monitoring**: Sprawdzać wykorzystanie połączeń w Supabase Dashboard

### Potencjalne wąskie gardła

#### 1. Supabase RLS policies
**Problem**: Polityki RLS dodają overhead do każdego zapytania

**Rozwiązanie**:
- Upewnić się, że polityki używają indeksów (np. `auth.uid() = id` używa PK)
- Monitorować czas wykonania zapytań w Supabase Dashboard
- W przyszłości: rozważyć service role + ręczna autoryzacja dla krytycznych endpointów

#### 2. Zimne starty (cold starts)
**Problem**: Pierwsze zapytanie po okresie bezczynności może być wolniejsze

**Rozwiązanie**:
- Używać serverless functions z warm-up (jeśli dotyczy)
- W produkcji: rozważyć dedicated instance Supabase

#### 3. Rate limiting
**Problem**: Zbyt wiele żądań może przeciążyć serwer

**Rozwiązanie**:
- Implementować rate limiting (np. 100 req/min per user)
- Używać Redis lub Upstash dla distributed rate limiting

### Metryki wydajności do monitorowania

| Metryka | Docelowa wartość | Alert przy |
|---------|------------------|------------|
| Response time (p50) | < 100ms | > 500ms |
| Response time (p95) | < 200ms | > 1000ms |
| Response time (p99) | < 500ms | > 2000ms |
| Error rate | < 0.1% | > 1% |
| Database query time | < 10ms | > 50ms |
| Throughput | > 100 req/s | < 10 req/s |

## 9. Etapy wdrożenia

### Faza 1: Przygotowanie infrastruktury

#### 1.1. Dodanie polityk RLS do bazy danych
**Plik**: `supabase/migrations/[timestamp]_add_profiles_rls_policies.sql`

```sql
-- Polityka SELECT: użytkownik może odczytać swój profil
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Polityka UPDATE: użytkownik może aktualizować swój profil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Polityka DELETE: soft delete (opcjonalnie, jeśli będzie potrzebne)
CREATE POLICY "Users can soft delete own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id AND deleted_at IS NULL);
```

**Akcja**: Uruchom migrację
```bash
npx supabase db push
```

#### 1.2. Weryfikacja triggera auto-create profile
**Sprawdzić**: Czy trigger `handle_new_user()` działa poprawnie

**Test**:
```sql
-- Sprawdź czy trigger istnieje
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Test: Utwórz użytkownika testowego i sprawdź czy profil został utworzony
```

### Faza 2: Implementacja warstwy Service

#### 2.1. Utworzenie ProfileService
**Plik**: `src/lib/services/profile.service.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbProfile, ProfileDTO } from '@/types';

export class ProfileService {
  /**
   * Pobiera profil użytkownika z bazy danych
   * @param userId - UUID użytkownika (z JWT tokenu)
   * @param supabase - Klient Supabase powiązany z żądaniem
   * @returns ProfileDTO lub null jeśli profil nie istnieje
   * @throws Error jeśli wystąpi błąd bazy danych
   */
  static async getProfile(
    userId: string,
    supabase: SupabaseClient
  ): Promise<ProfileDTO | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, privacy_consent, deleted_at, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error) {
      // Jeśli profil nie istnieje, zwróć null (nie throw)
      if (error.code === 'PGRST116') {
        return null;
      }
      // Inne błędy - rzuć wyjątek
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.mapProfileToDTO(data);
  }

  /**
   * Mapuje DbProfile (snake_case) na ProfileDTO (camelCase)
   * @param dbProfile - Wiersz z bazy danych
   * @returns ProfileDTO
   */
  private static mapProfileToDTO(dbProfile: DbProfile): ProfileDTO {
    return {
      id: dbProfile.id,
      privacyConsent: dbProfile.privacy_consent,
      deletedAt: dbProfile.deleted_at,
      createdAt: dbProfile.created_at,
      updatedAt: dbProfile.updated_at,
    };
  }
}
```

**Test jednostkowy** (opcjonalnie):
```typescript
// src/lib/services/profile.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  it('should return profile when found', async () => {
    // Mock Supabase client
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: '123',
                privacy_consent: true,
                deleted_at: null,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    const profile = await ProfileService.getProfile('123', mockSupabase as any);

    expect(profile).toEqual({
      id: '123',
      privacyConsent: true,
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    });
  });

  it('should return null when profile not found', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' },
            })),
          })),
        })),
      })),
    };

    const profile = await ProfileService.getProfile('999', mockSupabase as any);

    expect(profile).toBeNull();
  });
});
```

### Faza 3: Implementacja API Route Handler

#### 3.1. Utworzenie route handler
**Plik**: `src/pages/api/v1/profile.ts`

```typescript
import type { APIRoute } from 'astro';
import { ProfileService } from '@/lib/services/profile.service';

/**
 * GET /api/v1/profile
 * Pobiera profil zalogowanego użytkownika
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    // Sprawdź autentykację (double-check po middleware)
    const { data: { user }, error: authError } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please provide a valid access token.',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Pobierz profil użytkownika
    const profile = await ProfileService.getProfile(user.id, locals.supabase);

    if (!profile) {
      // Profil nie istnieje - to nie powinno się zdarzyć!
      console.error('[GET /api/v1/profile] Profile not found for user:', user.id);

      return new Response(
        JSON.stringify({
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: 'User profile not found. Please contact support if this issue persists.',
          },
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Sukces - zwróć profil
    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    // Błąd serwera
    console.error('[GET /api/v1/profile] Unexpected error:', error);

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
          // W DEV mode: dodaj szczegóły
          ...(import.meta.env.DEV && {
            details: error instanceof Error ? error.message : String(error),
          }),
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// Wyłącz prerendering (wymagane dla API routes)
export const prerender = false;
```

#### 3.2. Weryfikacja middleware
**Plik**: `src/middleware/index.ts`

Upewnij się, że middleware inicjalizuje `locals.supabase`:

```typescript
import { defineMiddleware } from 'astro:middleware';
import { createServerClient } from '@/db/supabase.client';

export const onRequest = defineMiddleware(async (context, next) => {
  // Inicjalizuj Supabase client dla tego żądania
  context.locals.supabase = createServerClient(context);

  // Kontynuuj do route handler
  return next();
});
```

**Uwaga**: Autoryzacja (sprawdzenie user) odbywa się w route handler, nie w middleware (zgodnie z zasadą: middleware tylko inicjalizuje, handler autoryzuje).

### Faza 4: Testowanie

#### 4.1. Testy jednostkowe

**Test ProfileService**:
```bash
npm run test src/lib/services/profile.service.test.ts
```

#### 4.2. Testy integracyjne

**Test 1: Pomyślne pobranie profilu**
```bash
curl -X GET http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json"

# Expected: 200 OK + ProfileDTO
```

**Test 2: Brak tokenu**
```bash
curl -X GET http://localhost:4321/api/v1/profile \
  -H "Content-Type: application/json"

# Expected: 401 Unauthorized
```

**Test 3: Nieprawidłowy token**
```bash
curl -X GET http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json"

# Expected: 401 Unauthorized
```

**Test 4: Profil nie istnieje** (trudny do przetestowania - wymaga ręcznego usunięcia profilu z DB)
```sql
-- W Supabase SQL Editor
DELETE FROM public.profiles WHERE id = '<test_user_id>';
```
```bash
curl -X GET http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <test_user_token>" \
  -H "Content-Type: application/json"

# Expected: 404 Not Found
```

#### 4.3. Testy wydajnościowe

**Test obciążenia** (opcjonalnie):
```bash
# Używając Apache Bench
ab -n 1000 -c 10 -H "Authorization: Bearer <token>" \
  http://localhost:4321/api/v1/profile

# Lub k6
k6 run load-test.js
```

**Oczekiwane wyniki**:
- p50 < 100ms
- p95 < 200ms
- 0% błędów

### Faza 5: Dokumentacja

#### 5.1. Aktualizacja API docs
Dodać przykłady użycia do dokumentacji API:

**Plik**: `docs/api/profile/get-profile.md` (jeśli istnieje)

#### 5.2. Changelog
Dodać wpis do CHANGELOG.md:

```markdown
## [Unreleased]

### Added
- GET /api/v1/profile - Endpoint do pobierania profilu użytkownika
- ProfileService dla logiki biznesowej profili
- RLS policies dla tabeli profiles
```

#### 5.3. Komentarze w kodzie
Upewnić się, że wszystkie funkcje mają JSDoc comments (już w przykładach powyżej).

### Faza 6: Deployment

#### 6.1. Pre-deployment checklist

- [ ] RLS policies dodane i przetestowane
- [ ] Testy jednostkowe przechodzą
- [ ] Testy integracyjne przechodzą
- [ ] Linter nie zgłasza błędów
- [ ] TypeScript kompiluje się bez błędów
- [ ] Environment variables ustawione (.env)
- [ ] Dokumentacja zaktualizowana

#### 6.2. Deployment do staging

```bash
# Build production
npm run build

# Test production build lokalnie
npm run preview

# Deploy do staging
git push origin feature/profile-get-endpoint
# Otwórz PR i poczekaj na review
```

#### 6.3. Deployment do production

```bash
# Po merge do main
git checkout main
git pull origin main

# Deploy (zależnie od platformy)
npm run deploy
# Lub automatyczny deploy przez CI/CD
```

#### 6.4. Post-deployment verification

**Smoke test**:
```bash
# Test w produkcji
curl -X GET https://api.production.com/api/v1/profile \
  -H "Authorization: Bearer <production_token>"

# Expected: 200 OK + dane profilu
```

**Monitoring**:
- Sprawdź logi w Supabase Dashboard
- Monitoruj error rate w aplikacji
- Sprawdź response times

### Faza 7: Monitoring i utrzymanie

#### 7.1. Metryki do śledzenia

**W Supabase Dashboard**:
- Query performance dla `SELECT * FROM profiles WHERE id = ?`
- Connection pool utilization
- RLS policy execution time

**W Application Monitoring** (np. Sentry, LogRocket):
- Error rate dla GET /api/v1/profile
- Response time distribution (p50, p95, p99)
- 404 errors (powinno być 0 lub bardzo mało)

#### 7.2. Alerty

Skonfigurować alerty dla:
- Error rate > 1%
- p95 response time > 500ms
- 404 errors (profile not found) - każdy przypadek wymaga investigacji
- 500 errors

#### 7.3. Utrzymanie

**Co tydzień**:
- Przejrzyj logi błędów
- Sprawdź wydajność endpointu

**Co miesiąc**:
- Przeanalizuj trendy w użyciu
- Zoptymalizuj jeśli potrzeba (np. dodaj caching)

---

## Podsumowanie

Ten plan wdrożenia zapewnia kompleksowe wskazówki dla implementacji endpointu GET /api/v1/profile. Kluczowe punkty:

1. **Bezpieczeństwo**: RLS policies + JWT authentication
2. **Prostota**: Prosty SELECT po PK - bardzo wydajne
3. **Czystość kodu**: Service layer + proper error handling
4. **Testowalność**: Unit tests + integration tests
5. **Monitoring**: Logi + metryki wydajności

**Szacowany czas implementacji**: 2-4 godziny (w zależności od doświadczenia zespołu)

**Priorytet**: WYSOKI (podstawowy endpoint dla aplikacji)

**Zależności**: Middleware Astro, polityki RLS, trigger auto-create profile

