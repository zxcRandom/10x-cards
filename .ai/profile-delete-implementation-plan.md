# API Endpoint Implementation Plan: DELETE /api/v1/profile

## 1. Przegląd punktu końcowego

### Cel
Endpoint służy do soft delete profilu zalogowanego użytkownika. Ustawia pole `deleted_at` na bieżącą datę i czas, nie usuwając fizycznie rekordu z bazy danych. Soft delete pozwala na zachowanie integralności danych historycznych (reviews, decks, cards) oraz umożliwia potencjalne przywrócenie konta przez endpoint PATCH.

### Charakterystyka
- **Metoda HTTP**: DELETE
- **Ścieżka**: `/api/v1/profile`
- **Uwierzytelnianie**: Wymagane (Supabase JWT w nagłówku Authorization)
- **Autoryzacja**: Użytkownik może usunąć tylko swój własny profil
- **Idempotentność**: Tak (wielokrotne wywołanie daje ten sam rezultat - profil pozostaje usunięty)
- **Typ operacji**: Soft delete (nie fizyczne usunięcie z bazy)

### Przypadki użycia

1. **Użytkownik usuwa konto**:
   - Użytkownik decyduje się opuścić aplikację
   - Profil zostaje oznaczony jako usunięty (`deleted_at = NOW()`)
   - Dane historyczne (decks, cards, reviews) pozostają w bazie

2. **Wielokrotne wywołanie DELETE**:
   - Użytkownik wywołuje DELETE dwa razy
   - Pierwsze wywołanie: 200 OK, ustawia `deleted_at`
   - Drugie wywołanie: 200 OK, `deleted_at` pozostaje bez zmian (idempotentność)

3. **Późniejsze przywrócenie konta**:
   - Po DELETE użytkownik może użyć PATCH z `restore: true`
   - Przywraca profil (ustawia `deleted_at = null`)

## 2. Szczegóły żądania

### Metoda HTTP
`DELETE`

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
Brak (metoda DELETE nie przyjmuje body dla tego endpointu)

### Nagłówki wymagane
```
Authorization: Bearer <supabase_jwt_token>
```

### Przykład żądania
```http
DELETE /api/v1/profile HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

#### ProfileDeletedDTO
```typescript
// Już zdefiniowany w src/types.ts
export interface ProfileDeletedDTO {
  status: 'deleted';
  deletedAt: string; // ISO-8601 timestamp
}
```

### Typy pomocnicze

#### DbProfile
```typescript
// Już zdefiniowany w src/types.ts
export type DbProfile = Tables<'profiles'>;
```

### Typy błędów

#### ErrorResponse
```typescript
// Wspólny typ dla wszystkich endpointów (już powinien być zdefiniowany)
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
  }
}
```

### Internal types

#### DeleteProfileData
```typescript
// Wewnętrzny typ dla update query (soft delete to UPDATE, nie DELETE)
interface DeleteProfileData {
  deleted_at: string; // ISO-8601 timestamp (NOW())
  updated_at?: string; // Automatycznie przez trigger
}
```

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

#### Status HTTP
`200 OK`

**Uwaga**: Używamy 200 OK zamiast 204 No Content, ponieważ zwracamy body z informacją o czasie usunięcia.

#### Response Body
```json
{
  "status": "deleted",
  "deletedAt": "2024-01-20T15:45:30.123Z"
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

**Uwaga**: Ten błąd nie powinien wystąpić w normalnym przepływie, ponieważ profil jest tworzony automatycznie przy rejestracji.

#### 409 Conflict
**Przyczyna**: Profil jest już usunięty (opcjonalnie - zależnie od strategii idempotentności)

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Profile is already deleted",
    "details": "Profile was deleted at 2024-01-15T10:00:00.000Z"
  }
}
```

**Uwaga strategii**: Możemy:
- **Opcja A** (zalecana): Zwrócić 200 OK z obecnym `deletedAt` (true idempotency)
- **Opcja B**: Zwrócić 409 Conflict (informacja o już usuniętym profilu)

**Rekomendacja**: Użyć Opcji A dla prawdziwej idempotentności (wielokrotne DELETE daje 200).

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
       │ DELETE /api/v1/profile + JWT Token
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
│  API Route Handler (DELETE)             │
│  (src/pages/api/v1/profile.ts)          │
│  - Sprawdzenie autentykacji             │
│  - Wywołanie ProfileService.deleteProfile() │
└──────┬──────────────────────────────────┘
       │ user.id, supabase client
       │
       ▼
┌─────────────────────────────────────────┐
│  ProfileService.deleteProfile()         │
│  (src/lib/services/profile.service.ts)  │
│  - Sprawdzenie czy profil istnieje      │
│  - (Opcjonalnie) Sprawdzenie czy już usunięty │
│  - Soft delete: UPDATE deleted_at       │
└──────┬──────────────────────────────────┘
       │ deleted_at timestamp
       │
       ▼
┌─────────────────────────────────────────┐
│  Supabase Update Query                  │
│  UPDATE public.profiles                 │
│  SET deleted_at = NOW(),                │
│      updated_at = NOW()                 │
│  WHERE id = ?                           │
│  RETURNING deleted_at                   │
└──────┬──────────────────────────────────┘
       │ deleted_at: string
       │
       ▼
┌─────────────────────────────────────────┐
│  Tworzenie odpowiedzi                   │
│  - ProfileDeletedDTO                    │
│  - status: 'deleted'                    │
│  - deletedAt: ISO-8601 string           │
└──────┬──────────────────────────────────┘
       │ ProfileDeletedDTO
       │
       ▼
┌─────────────────────────────────────────┐
│  Response                               │
│  - Status: 200 OK                       │
│  - Body: ProfileDeletedDTO (JSON)       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Klient    │
└─────────────┘
```

### Szczegółowy opis przepływu

#### Krok 1: Weryfikacja autentykacji (Middleware)
Identyczny jak w GET i PATCH:
- Middleware pobiera token JWT z nagłówka `Authorization`
- Tworzy klienta Supabase: `context.locals.supabase`
- Wywołuje `supabase.auth.getUser()` aby zweryfikować użytkownika

#### Krok 2: Handler endpointu
1. **Sprawdzenie autentykacji**:
   ```typescript
   const { data: { user } } = await locals.supabase.auth.getUser();
   if (!user) return 401;
   ```

2. **Wywołanie service**:
   ```typescript
   const result = await ProfileService.deleteProfile(user.id, supabase);
   ```

3. **Zwrócenie odpowiedzi**:
   ```typescript
   return new Response(JSON.stringify(result), { status: 200 });
   ```

#### Krok 3: Logika biznesowa (Service)

**Strategia A (Zalecana): True Idempotency**
```typescript
async deleteProfile(userId, supabase) {
  // Pobierz obecny profil
  const currentProfile = await getProfile(userId, supabase);
  
  if (!currentProfile) {
    throw new Error('Profile not found');
  }
  
  // Jeśli już usunięty, zwróć obecny deletedAt (idempotentność)
  if (currentProfile.deletedAt) {
    return {
      status: 'deleted',
      deletedAt: currentProfile.deletedAt
    };
  }
  
  // Wykonaj soft delete
  const { data } = await supabase
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', userId)
    .select('deleted_at')
    .single();
  
  return {
    status: 'deleted',
    deletedAt: data.deleted_at
  };
}
```

**Strategia B: Explicit Conflict**
```typescript
async deleteProfile(userId, supabase) {
  const currentProfile = await getProfile(userId, supabase);
  
  if (!currentProfile) {
    throw new Error('Profile not found');
  }
  
  // Jeśli już usunięty, throw ConflictError
  if (currentProfile.deletedAt) {
    throw new ConflictError(
      'Profile is already deleted',
      `Profile was deleted at ${currentProfile.deletedAt}`
    );
  }
  
  // Wykonaj soft delete
  // ... (jak wyżej)
}
```

**Rekomendacja**: Użyj Strategii A dla prawdziwej idempotentności zgodnie z HTTP semantics.

#### Krok 4: Update w bazie danych

**SQL wykonywany przez Supabase**:
```sql
UPDATE public.profiles
SET deleted_at = NOW()
WHERE id = $1
RETURNING deleted_at;
```

**Uwagi**:
- `updated_at` jest automatycznie aktualizowany przez trigger `update_updated_at_column`
- Używamy `NOW()` zamiast client-side timestamp dla spójności z serwerem bazodanowym
- `RETURNING deleted_at` zwraca ustawioną wartość

#### Krok 5: Formatowanie odpowiedzi
Zwracamy `ProfileDeletedDTO`:
```typescript
{
  status: 'deleted',
  deletedAt: data.deleted_at // ISO-8601 string
}
```

### Scenariusze brzegowe

#### Scenariusz 1: Pierwsze usunięcie profilu
```
DELETE /api/v1/profile
→ 200 OK
{
  "status": "deleted",
  "deletedAt": "2024-01-20T15:45:30.123Z"
}
```

#### Scenariusz 2: Drugie usunięcie (już usunięty profil)
**Strategia A (Zalecana)**:
```
DELETE /api/v1/profile
→ 200 OK
{
  "status": "deleted",
  "deletedAt": "2024-01-20T15:45:30.123Z"  // Ten sam timestamp co pierwsze usunięcie
}
```

**Strategia B**:
```
DELETE /api/v1/profile
→ 409 Conflict
{
  "error": {
    "code": "CONFLICT",
    "message": "Profile is already deleted"
  }
}
```

#### Scenariusz 3: Usunięcie → Restore → Usunięcie
```
1. DELETE /api/v1/profile → deletedAt: "2024-01-20T15:45:30.123Z"
2. PATCH /api/v1/profile {"restore": true} → deletedAt: null
3. DELETE /api/v1/profile → deletedAt: "2024-01-21T10:00:00.456Z" (nowy timestamp)
```

## 6. Względy bezpieczeństwa

### Uwierzytelnianie (Authentication)
Identyczne jak w GET i PATCH:
- Supabase JWT w nagłówku Authorization
- Weryfikacja przez `supabase.auth.getUser()`

### Autoryzacja (Authorization)
- Użytkownik może usunąć **tylko swój własny profil**
- User ID pochodzi z tokenu JWT (nigdy z parametrów!)
- RLS policies wymuszają `auth.uid() = id`

### Row Level Security (RLS)

#### Wymagane polityki RLS
```sql
-- Polityka UPDATE: użytkownik może aktualizować tylko swój profil
-- (soft delete to UPDATE deleted_at, nie fizyczne DELETE)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);
```

**Uwaga**: Soft delete używa UPDATE (nie DELETE), więc potrzebujemy polityki UPDATE, nie DELETE.

#### Polityka DELETE (opcjonalna)
Jeśli w przyszłości chcemy umożliwić fizyczne usunięcie (hard delete):
```sql
CREATE POLICY "Users can delete own profile"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);
```

**W MVP**: Nie używamy fizycznego DELETE, więc ta polityka nie jest potrzebna.

### Kaskadowe konsekwencje usunięcia

#### Co się dzieje z danymi użytkownika po soft delete?

**Tabela profiles** (ON DELETE CASCADE z auth.users):
- Soft delete: `deleted_at = NOW()` → profil pozostaje w bazie
- Hard delete (fizyczne): profil usunięty + cascade do powiązanych tabel

**Tabela decks** (REFERENCES auth.users ON DELETE CASCADE):
- Jeśli soft delete profilu: decks **pozostają** (user_id dalej istnieje w auth.users)
- Jeśli hard delete użytkownika z auth.users: decks **usuwane kaskadowo**

**Tabela cards** (REFERENCES decks ON DELETE CASCADE):
- Usuwane kaskadowo wraz z decks

**Tabela reviews** (REFERENCES auth.users ON DELETE CASCADE):
- Usuwane kaskadowo jeśli hard delete użytkownika

**Tabela ai_generation_logs** (REFERENCES auth.users ON DELETE CASCADE):
- Usuwane kaskadowo jeśli hard delete użytkownika

#### Strategia dla MVP: Soft Delete Only

**Zalecane podejście**:
1. **Soft delete profilu**: Ustawia `deleted_at`, dane pozostają
2. **Dane użytkownika**: Wszystkie decks, cards, reviews pozostają w bazie
3. **Ukrywanie danych**: Middleware/RLS sprawdzają `deleted_at` i blokują dostęp
4. **Przywrócenie**: Możliwe przez PATCH `/api/v1/profile` z `restore: true`

**Hard delete** (fizyczne usunięcie):
- Tylko dla użytkowników którzy tego wymagają (GDPR right to erasure)
- Oddzielny proces: admin endpoint lub scheduled job
- Usuwa użytkownika z `auth.users` → kaskadowe usunięcie wszystkich danych

### Ochrona przed atakami

#### SQL Injection
- **Chronione**: Supabase client używa parametryzowanych zapytań

#### CSRF (Cross-Site Request Forgery)
- **Chronione**: JWT token w nagłówku (nie w cookie)

#### Accidental Deletion Protection
**Problem**: Użytkownik może przypadkowo usunąć konto.

**Rozwiązania** (do rozważenia w przyszłości):
1. **Confirmation required**: Wymagaj potwierdzenia (drugi request)
2. **Grace period**: 30-dniowy okres przed fizycznym usunięciem
3. **Email notification**: Wyślij email z linkiem do przywrócenia

**W MVP**: Soft delete daje naturalną ochronę (można restore).

### Logowanie (audyt)

#### Co logować

**INFO level** (dla audytu):
```typescript
console.info('[DELETE /api/v1/profile] Profile soft-deleted:', {
  userId: user.id,
  deletedAt: result.deletedAt,
  timestamp: new Date().toISOString()
});
```

**WARN level** (jeśli używamy Strategii B):
```typescript
console.warn('[DELETE /api/v1/profile] Attempt to delete already deleted profile:', {
  userId: user.id,
  originalDeletedAt: currentProfile.deletedAt
});
```

**ERROR level**:
- 404 Not Found (profil nie istnieje - bardzo rzadkie)
- 500 Internal Server Error

#### Format logów

```typescript
{
  action: 'PROFILE_DELETED',
  userId: 'uuid',
  deletedAt: '2024-01-20T15:45:30.123Z',
  timestamp: '2024-01-20T15:45:30.123Z',
  ipAddress: '192.168.1.1', // Opcjonalnie
  userAgent: 'Mozilla/5.0...' // Opcjonalnie
}
```

## 7. Obsługa błędów

### Macierz błędów

| Scenariusz | Kod HTTP | Kod błędu | Komunikat | Akcja |
|------------|----------|-----------|-----------|-------|
| Brak tokenu JWT | 401 | UNAUTHORIZED | "Authentication required" | Zwróć 401 |
| Token nieprawidłowy | 401 | UNAUTHORIZED | "Invalid or expired token" | Zwróć 401 |
| Profil nie istnieje | 404 | PROFILE_NOT_FOUND | "User profile not found" | Zwróć 404, loguj (alert!) |
| Profil już usunięty (Strategia A) | 200 | - | status: 'deleted' | Zwróć 200 z obecnym deletedAt |
| Profil już usunięty (Strategia B) | 409 | CONFLICT | "Profile is already deleted" | Zwróć 409 |
| Błąd połączenia z DB | 500 | DATABASE_ERROR | "Database error" | Zwróć 500, loguj szczegóły |
| Nieobsłużony wyjątek | 500 | INTERNAL_SERVER_ERROR | "Unexpected error" | Zwróć 500, loguj stack |

### Strategia obsługi błędów

#### Try-catch pattern (Strategia A - Zalecana)
```typescript
try {
  const result = await ProfileService.deleteProfile(user.id, supabase);
  
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

} catch (error) {
  if (error instanceof Error && error.message === 'Profile not found') {
    console.error('[DELETE /api/v1/profile] Profile not found:', user.id);
    
    return new Response(JSON.stringify({
      error: {
        code: 'PROFILE_NOT_FOUND',
        message: 'User profile not found'
      }
    }), { status: 404 });
  }
  
  // Inne błędy → 500
  console.error('[DELETE /api/v1/profile] Error:', error);
  
  return new Response(JSON.stringify({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  }), { status: 500 });
}
```

#### Try-catch pattern (Strategia B - z ConflictError)
```typescript
try {
  // ... (jak wyżej)

} catch (error) {
  if (error instanceof ConflictError) {
    console.warn('[DELETE /api/v1/profile] Already deleted:', user.id);
    
    return new Response(JSON.stringify({
      error: {
        code: 'CONFLICT',
        message: error.message,
        details: error.details
      }
    }), { status: 409 });
  }
  
  // ... (reszta jak wyżej)
}
```

### Early returns dla błędów

```typescript
// ✅ Dobre - early return
if (!user) {
  return errorResponse(401, 'UNAUTHORIZED');
}

const result = await deleteProfile(user.id);
return successResponse(result);

// ❌ Złe - głębokie zagnieżdżenia
if (user) {
  const result = await deleteProfile(user.id);
  return successResponse(result);
} else {
  return errorResponse(401);
}
```

## 8. Rozważania dotyczące wydajności

### Optymalizacje zapytań

#### Single UPDATE query
```sql
UPDATE public.profiles
SET deleted_at = NOW()
WHERE id = $1
RETURNING deleted_at;
```

**Wydajność**: ~5-10ms (bardzo szybkie, UPDATE po PK)

#### Index usage
- UPDATE po PK (`id`) wykorzystuje primary key index
- Brak dodatkowych joinów lub scans

#### Strategia idempotentności

**Strategia A (Zalecana): SELECT + warunkowy UPDATE**
```typescript
// SELECT (sprawdzenie stanu)
const profile = await getProfile(userId);

// Jeśli już usunięty, return without UPDATE
if (profile.deletedAt) {
  return { status: 'deleted', deletedAt: profile.deletedAt };
}

// UPDATE (tylko jeśli nie usunięty)
const result = await supabase.update({ deleted_at: NOW() });
```

**Koszt**: 2 queries (SELECT + warunkowy UPDATE)
**Zaleta**: True idempotency, brak zbędnych UPDATE

**Strategia B: Zawsze UPDATE**
```typescript
// Zawsze wykonaj UPDATE (nawet jeśli deleted_at już ustawione)
const result = await supabase.update({ deleted_at: NOW() });
```

**Koszt**: 1 query (zawsze UPDATE)
**Wada**: Zbędne UPDATE jeśli już usunięty, może zmienić `updated_at`

**Rekomendacja**: Użyj Strategii A (2 queries) dla prawdziwej idempotentności.

### Caching

#### Strategia cachowania
**Nie cachować odpowiedzi DELETE** - to operacja mutująca.

**Cache invalidation**: Po soft delete:
- Invalidate cache dla GET /api/v1/profile
- Invalidate cache dla endpointów zwracających dane użytkownika

### Transakcje

**Czy potrzebna transakcja?**
- **NIE** dla prostego UPDATE na jednej tabeli
- Single UPDATE jest atomowy w PostgreSQL

**Kiedy transakcja jest potrzebna?**
- Jeśli chcemy atomowo: soft delete profilu + insert do audit log
- Jeśli chcemy atomowo: soft delete profilu + wysłanie notification

**W MVP**: Nie używamy transakcji (prosty UPDATE wystarczy).

### Rate limiting

**Rekomendowane limity**:
- **Per user**: 5 req/min (usunięcie konta jest bardzo rzadką operacją)
- **Per IP**: 10 req/min

**Uzasadnienie**: DELETE jest bardzo rzadką operacją, więc niskie limity są OK.

### Potencjalne wąskie gardła

#### 1. Sprawdzenie stanu (SELECT przed UPDATE)
**Problem**: Dodatkowe zapytanie SELECT

**Rozwiązanie**: 
- Cache rezultatu SELECT w ramach request
- Lub akceptuj koszt (5ms to niewiele)

#### 2. Trigger updated_at
**Problem**: Minimalny overhead

**Rozwiązenie**: Nie wymaga optymalizacji (trigger jest bardzo szybki)

### Metryki wydajności do monitorowania

| Metryka | Docelowa wartość | Alert przy |
|---------|------------------|------------|
| Response time (p50) | < 100ms | > 500ms |
| Response time (p95) | < 200ms | > 1000ms |
| Database query time | < 15ms | > 100ms |
| Error rate | < 0.1% | > 1% |
| Deletion rate | Tracking | Spike > 10x normal |

## 9. Etapy wdrożenia

### Faza 1: Przygotowanie (jeśli nie zrobione w poprzednich endpointach)

#### 1.1. Weryfikacja polityk RLS
**Sprawdzić**: Czy polityka UPDATE dla profiles istnieje

```sql
-- Sprawdź polityki
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

Jeśli brak, dodaj:
```sql
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);
```

#### 1.2. Weryfikacja constraint deleted_at
**Sprawdzić**: Czy constraint `valid_deleted_at` istnieje

```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'valid_deleted_at';
```

Powinno być:
```sql
CHECK (deleted_at IS NULL OR deleted_at <= NOW())
```

### Faza 2: Rozszerzenie ProfileService

#### 2.1. Dodanie metody deleteProfile
**Plik**: `src/lib/services/profile.service.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileDeletedDTO } from '@/types';

export class ProfileService {
  // ... existing methods (getProfile, updateProfile) ...

  /**
   * Soft delete profilu użytkownika (ustawia deleted_at)
   * @param userId - UUID użytkownika (z JWT tokenu)
   * @param supabase - Klient Supabase powiązany z żądaniem
   * @returns ProfileDeletedDTO z timestampem usunięcia
   * @throws Error jeśli profil nie istnieje lub błąd bazy danych
   */
  static async deleteProfile(
    userId: string,
    supabase: SupabaseClient
  ): Promise<ProfileDeletedDTO> {
    // Krok 1: Sprawdź czy profil istnieje (opcjonalnie: sprawdź czy już usunięty)
    const currentProfile = await this.getProfile(userId, supabase);

    if (!currentProfile) {
      throw new Error('Profile not found');
    }

    // Krok 2: Idempotentność - jeśli już usunięty, zwróć obecny deletedAt
    if (currentProfile.deletedAt) {
      return {
        status: 'deleted',
        deletedAt: currentProfile.deletedAt,
      };
    }

    // Krok 3: Wykonaj soft delete (UPDATE deleted_at = NOW())
    const { data, error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId)
      .select('deleted_at')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || !data.deleted_at) {
      throw new Error('Delete failed: no deleted_at returned');
    }

    // Krok 4: Zwróć ProfileDeletedDTO
    return {
      status: 'deleted',
      deletedAt: data.deleted_at,
    };
  }

  // ... existing mapProfileToDTO, validateUpdateCommand ...
}
```

#### 2.2. Wariant bez idempotentności (Strategia B)
Jeśli preferujesz zwracanie 409 Conflict dla już usuniętych profili:

```typescript
static async deleteProfile(
  userId: string,
  supabase: SupabaseClient
): Promise<ProfileDeletedDTO> {
  const currentProfile = await this.getProfile(userId, supabase);

  if (!currentProfile) {
    throw new Error('Profile not found');
  }

  // Rzuć ConflictError jeśli już usunięty
  if (currentProfile.deletedAt) {
    throw new ConflictError(
      'Profile is already deleted',
      `Profile was deleted at ${currentProfile.deletedAt}`
    );
  }

  // ... reszta jak w Strategii A ...
}
```

#### 2.3. Unit tests dla deleteProfile
**Plik**: `src/lib/services/profile.service.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ProfileService } from './profile.service';

describe('ProfileService.deleteProfile', () => {
  it('should soft delete profile successfully', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: '123',
                privacy_consent: true,
                deleted_at: null, // Active profile
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  deleted_at: '2024-01-20T15:45:30.123Z',
                },
                error: null,
              })),
            })),
          })),
        })),
      })),
    };

    const result = await ProfileService.deleteProfile('123', mockSupabase as any);

    expect(result.status).toBe('deleted');
    expect(result.deletedAt).toBe('2024-01-20T15:45:30.123Z');
  });

  it('should return existing deletedAt for already deleted profile (idempotency)', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: '123',
                privacy_consent: true,
                deleted_at: '2024-01-15T10:00:00Z', // Already deleted
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-15T10:00:00Z',
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    const result = await ProfileService.deleteProfile('123', mockSupabase as any);

    // Should return existing deletedAt without calling update
    expect(result.status).toBe('deleted');
    expect(result.deletedAt).toBe('2024-01-15T10:00:00Z');
  });

  it('should throw error when profile not found', async () => {
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

    await expect(
      ProfileService.deleteProfile('999', mockSupabase as any)
    ).rejects.toThrow('Profile not found');
  });
});
```

### Faza 3: Implementacja DELETE handler

#### 3.1. Dodanie DELETE handler do route
**Plik**: `src/pages/api/v1/profile.ts`

Dodaj do istniejącego pliku (który ma GET i PATCH handlers):

```typescript
import type { APIRoute } from 'astro';
import { ProfileService, ConflictError, UnprocessableError } from '@/lib/services/profile.service';
// ... other imports ...

// ... existing GET handler ...
// ... existing PATCH handler ...

/**
 * DELETE /api/v1/profile
 * Soft delete profilu zalogowanego użytkownika
 */
export const DELETE: APIRoute = async ({ locals }) => {
  try {
    // Krok 1: Sprawdź autentykację
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

    // Krok 2: Wykonaj soft delete przez service
    const result = await ProfileService.deleteProfile(user.id, locals.supabase);

    // Krok 3: Logowanie (dla audytu)
    console.info('[DELETE /api/v1/profile] Profile soft-deleted:', {
      userId: user.id,
      deletedAt: result.deletedAt,
      timestamp: new Date().toISOString(),
    });

    // Krok 4: Sukces - zwróć ProfileDeletedDTO
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    // Obsługa ConflictError (jeśli używamy Strategii B)
    if (error instanceof ConflictError) {
      console.warn('[DELETE /api/v1/profile] Attempt to delete already deleted profile');
      
      return new Response(
        JSON.stringify({
          error: {
            code: 'CONFLICT',
            message: error.message,
            details: error.details,
          },
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Obsługa błędu "Profile not found"
    if (error instanceof Error && error.message === 'Profile not found') {
      console.error('[DELETE /api/v1/profile] Profile not found for user:', user?.id);

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

    // Błąd serwera
    console.error('[DELETE /api/v1/profile] Unexpected error:', error);

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

// Wyłącz prerendering (już jest z poprzednich handlers)
export const prerender = false;
```

### Faza 4: Testowanie

#### 4.1. Testy jednostkowe
```bash
# Test ProfileService
npm run test src/lib/services/profile.service.test.ts
```

#### 4.2. Testy integracyjne

**Test 1: Pierwsze usunięcie profilu**
```bash
curl -X DELETE http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>"

# Expected: 200 OK
# {
#   "status": "deleted",
#   "deletedAt": "2024-01-20T15:45:30.123Z"
# }
```

**Test 2: Drugie usunięcie (idempotentność)**
```bash
# Po wykonaniu Test 1, wywołaj ponownie
curl -X DELETE http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>"

# Expected (Strategia A): 200 OK z tym samym deletedAt
# Expected (Strategia B): 409 Conflict
```

**Test 3: Weryfikacja GET po DELETE**
```bash
# Po DELETE, sprawdź GET
curl -X GET http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>"

# Expected: 200 OK z deletedAt != null
# {
#   "id": "...",
#   "privacyConsent": true,
#   "deletedAt": "2024-01-20T15:45:30.123Z",
#   "createdAt": "...",
#   "updatedAt": "..."
# }
```

**Test 4: DELETE → Restore → DELETE (full cycle)**
```bash
# 1. DELETE profilu
curl -X DELETE http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <token>"
# → deletedAt: "2024-01-20T15:45:30.123Z"

# 2. Restore profilu
curl -X PATCH http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"restore": true}'
# → deletedAt: null

# 3. Ponownie DELETE
curl -X DELETE http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <token>"
# → deletedAt: "2024-01-21T10:00:00.456Z" (nowy timestamp)
```

**Test 5: Brak tokenu (401)**
```bash
curl -X DELETE http://localhost:4321/api/v1/profile

# Expected: 401 Unauthorized
```

**Test 6: Nieprawidłowy token (401)**
```bash
curl -X DELETE http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer invalid_token"

# Expected: 401 Unauthorized
```

**Test 7: Wielokrotne DELETE (test idempotentności)**
```bash
# Wywołaj 5 razy z tym samym tokenem
for i in {1..5}; do
  curl -X DELETE http://localhost:4321/api/v1/profile \
    -H "Authorization: Bearer <token>"
  echo ""
done

# Expected: Wszystkie 200 OK, deletedAt identyczny w każdej odpowiedzi (Strategia A)
```

**Test 8: Sprawdzenie stanu bazy po DELETE**
```sql
-- W Supabase SQL Editor
SELECT id, privacy_consent, deleted_at, updated_at
FROM public.profiles
WHERE id = '<test_user_id>';

-- Expected:
-- deleted_at: timestamp (not null)
-- updated_at: updated to same or newer timestamp
```

#### 4.3. Testy wydajnościowe
```bash
# Test obciążenia (opcjonalnie)
ab -n 100 -c 5 -H "Authorization: Bearer <token>" \
  -m DELETE http://localhost:4321/api/v1/profile

# Oczekiwane wyniki:
# - p50 < 100ms
# - p95 < 200ms
# - 0% błędów (lub 100% 200/409 jeśli Strategia B)
```

### Faza 5: Dokumentacja

#### 5.1. Aktualizacja API docs
**Plik**: `docs/api/profile/delete-profile.md` (jeśli istnieje)

```markdown
## Delete Profile (Soft Delete)

### Endpoint
`DELETE /api/v1/profile`

### Description
Soft deletes the authenticated user's profile by setting the `deletedAt` field to the current timestamp. The profile data remains in the database and can be restored using the PATCH endpoint with `restore: true`.

### Request
```bash
curl -X DELETE https://api.example.com/api/v1/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Response
```json
{
  "status": "deleted",
  "deletedAt": "2024-01-20T15:45:30.123Z"
}
```

### Restoring a Deleted Profile
```bash
curl -X PATCH https://api.example.com/api/v1/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"restore": true}'
```

### Idempotency
Calling DELETE multiple times returns the same result (200 OK with the original `deletedAt` timestamp).
```

#### 5.2. Changelog
```markdown
## [Unreleased]

### Added
- DELETE /api/v1/profile - Endpoint do soft delete profilu użytkownika
- ProfileDeletedDTO type
- Profile restoration capability (undo soft delete via PATCH)
- Audit logging for profile deletions

### Changed
- Complete Profile CRUD implementation (GET, PATCH, DELETE)
```

### Faza 6: Code Review Checklist

Przed mergem PR:

- [ ] RLS policies zweryfikowane (UPDATE policy wystarczy)
- [ ] Wszystkie testy jednostkowe przechodzą
- [ ] Wszystkie 8 testów integracyjnych przechodzą
- [ ] Test idempotentności (wielokrotne DELETE) przechodzi
- [ ] Test full cycle (DELETE → Restore → DELETE) przechodzi
- [ ] Soft delete używa UPDATE (nie fizyczne DELETE)
- [ ] Proper error handling (401, 404, 500, opcjonalnie 409)
- [ ] Logging dla audytu (INFO level)
- [ ] TypeScript kompiluje bez błędów
- [ ] Linter nie zgłasza błędów
- [ ] Dokumentacja zaktualizowana
- [ ] Early returns dla błędów
- [ ] User ID zawsze z tokenu JWT
- [ ] Constraint `valid_deleted_at` działa poprawnie

### Faza 7: Deployment

#### 7.1. Pre-deployment checklist
- [ ] Wszystkie punkty z Code Review Checklist ✓
- [ ] Smoke tests w staging przeszły
- [ ] Performance tests przeszły (response time < 200ms p95)
- [ ] Security audit przeprowadzony
- [ ] Backwards compatibility zweryfikowana (soft delete nie łamie istniejących endpointów)

#### 7.2. Deployment do staging
```bash
git checkout feature/profile-delete-endpoint
git push origin feature/profile-delete-endpoint
# Otwórz PR, poczekaj na approval
```

#### 7.3. Deployment do production
```bash
git checkout main
git pull origin main
npm run deploy
```

#### 7.4. Post-deployment verification

**Smoke test**:
```bash
# Test DELETE w produkcji (używając test account!)
curl -X DELETE https://api.production.com/api/v1/profile \
  -H "Authorization: Bearer <test_account_token>"

# Expected: 200 OK + ProfileDeletedDTO

# Weryfikuj restore działa
curl -X PATCH https://api.production.com/api/v1/profile \
  -H "Authorization: Bearer <test_account_token>" \
  -H "Content-Type: application/json" \
  -d '{"restore": true}'

# Expected: 200 OK + ProfileDTO z deletedAt=null
```

**Monitoring**:
- Sprawdź logi w Supabase Dashboard
- Monitoruj deletion rate (powinna być bardzo niska)
- Sprawdź response times
- Verify że nie ma wzrostu error rate

### Faza 8: Monitoring i utrzymanie

#### 8.1. Metryki do śledzenia

**Application metrics**:
- Request rate (req/hour dla DELETE - powinna być bardzo niska)
- Response time distribution (p50, p95, p99)
- Error rate
- Deletion rate (daily, weekly, monthly)
- Restoration rate (ile usuniętych profili jest przywracanych)

**Database metrics**:
- UPDATE query performance dla soft delete
- Liczba profili z deleted_at != null
- Storage usage (soft delete nie redukuje storage)

**Business metrics**:
- User churn rate (deleted profiles per period)
- Restoration rate (% deleted profiles that are restored)
- Time to restoration (jak szybko użytkownicy przywracają konta)

#### 8.2. Alerty

Skonfigurować alerty dla:
- Error rate > 1%
- p95 response time > 500ms
- Deletion rate spike > 200% średniej (może wskazywać problem z aplikacją)
- Profile not found errors (każdy przypadek wymaga investigacji)

#### 8.3. Scheduled tasks (do rozważenia w przyszłości)

**Hard delete po grace period**:
```sql
-- Scheduled job (np. co tydzień)
-- Fizyczne usunięcie profili usuniętych > 90 dni temu
DELETE FROM auth.users
WHERE id IN (
  SELECT id FROM public.profiles
  WHERE deleted_at < NOW() - INTERVAL '90 days'
);
```

**Uwaga**: Hard delete wymaga osobnego procesu i dodatkowych safeguards.

#### 8.4. Utrzymanie

**Co tydzień**:
- Przejrzyj logi błędów
- Sprawdź deletion rate trendy
- Verify restoration success rate

**Co miesiąc**:
- Analyze user churn patterns
- Review grace period policy (jeśli implementowane)
- Consider implementing hard delete if storage becomes issue

---

## Podsumowanie

Ten plan wdrożenia zapewnia kompleksowe wskazówki dla implementacji endpointu DELETE /api/v1/profile. Kluczowe punkty:

1. **Soft delete**: UPDATE deleted_at (nie fizyczne DELETE)
2. **Idempotentność**: Wielokrotne DELETE zwraca 200 OK (Strategia A zalecana)
3. **Restowalność**: Można cofnąć przez PATCH z restore=true
4. **Prostota**: Tylko 3-4 kody statusu (200, 401, 404, 500, opcjonalnie 409)
5. **Audyt**: Logowanie każdego usunięcia dla compliance

**Szacowany czas implementacji**: 2-3 godziny (prosty endpoint)

**Priorytet**: ŚREDNI (mniej krytyczny niż GET/PATCH, ale potrzebny dla CRUD)

**Zależności**: GET i PATCH /api/v1/profile (dla restore functionality)

**Kompletność**: Po implementacji tego endpointu, CRUD profilu będzie **100% kompletny** ✅

---

## Następne kroki po zakończeniu Profile CRUD

Po implementacji GET, PATCH i DELETE dla `/api/v1/profile`, naturalne kolejne kroki to:

1. **Decks CRUD**: POST, GET, PATCH, DELETE `/api/v1/decks`
2. **Cards CRUD**: POST, GET, PATCH, DELETE `/api/v1/cards`
3. **Reviews**: POST `/api/v1/cards/{cardId}/review`, GET `/api/v1/reviews`
4. **AI Generation**: POST `/api/v1/ai/decks/from-text`
5. **Health check**: GET `/api/v1/health`

**Recommended order**: Decks → Cards → Reviews → AI Generation → Health

