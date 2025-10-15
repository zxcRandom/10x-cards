# API Endpoint Implementation Plan: PATCH /api/v1/profile

## 1. Przegląd punktu końcowego

### Cel
Endpoint służy do aktualizacji profilu zalogowanego użytkownika. Umożliwia modyfikację zgody na przetwarzanie danych przez AI (`privacyConsent`) oraz przywracanie soft-deleted profilu (`restore`). Jest to częściowa aktualizacja (PATCH), więc nie wszystkie pola muszą być przesłane.

### Charakterystyka
- **Metoda HTTP**: PATCH
- **Ścieżka**: `/api/v1/profile`
- **Uwierzytelnianie**: Wymagane (Supabase JWT w nagłówku Authorization)
- **Autoryzacja**: Użytkownik może zaktualizować tylko swój własny profil
- **Idempotentność**: Tak (wielokrotne wywołanie z tymi samymi danymi daje ten sam rezultat)

### Przypadki użycia

1. **Akceptacja zgody na prywatność**:
   - Użytkownik akceptuje przetwarzanie danych przez AI
   - Request: `{ "privacyConsent": true }`

2. **Cofnięcie zgody na prywatność**:
   - Użytkownik cofa zgodę na AI
   - Request: `{ "privacyConsent": false }`

3. **Przywrócenie usuniętego konta**:
   - Użytkownik przywraca soft-deleted profil
   - Request: `{ "restore": true }`

4. **Kombinacja operacji**:
   - Użytkownik przywraca konto i akceptuje zgodę
   - Request: `{ "restore": true, "privacyConsent": true }`

## 2. Szczegóły żądania

### Metoda HTTP
`PATCH`

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
**Content-Type**: `application/json`

**Schema**:
```typescript
{
  "privacyConsent"?: boolean,  // Opcjonalne: zgoda na przetwarzanie przez AI
  "restore"?: boolean          // Opcjonalne: przywrócenie soft-deleted profilu
}
```

**Constraints**:
- Co najmniej jedno pole musi być przesłane
- `privacyConsent`: musi być boolean (true/false)
- `restore`: musi być boolean; tylko `true` jest dozwolone (false nie ma sensu)
- Nie można przesłać innych pól (id, createdAt, updatedAt, deletedAt)

### Nagłówki wymagane
```
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

### Przykłady żądań

#### Przykład 1: Akceptacja zgody na prywatność
```http
PATCH /api/v1/profile HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "privacyConsent": true
}
```

#### Przykład 2: Przywrócenie usuniętego konta
```http
PATCH /api/v1/profile HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "restore": true
}
```

#### Przykład 3: Kombinacja operacji
```http
PATCH /api/v1/profile HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "restore": true,
  "privacyConsent": true
}
```

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

#### UpdateProfileCommand
```typescript
// Już zdefiniowany w src/types.ts
export interface UpdateProfileCommand {
  privacyConsent?: boolean;
  restore?: boolean; // When true, sets deletedAt to null
}
```

#### ProfileDTO
```typescript
// Już zdefiniowany w src/types.ts
export interface ProfileDTO {
  id: string;
  privacyConsent: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Zod Schemas (walidacja)

#### UpdateProfileSchema
```typescript
// Do utworzenia w src/pages/api/v1/profile.ts lub osobnym pliku schemas
import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  privacyConsent: z.boolean().optional(),
  restore: z.boolean().optional(),
})
  .refine(
    (data) => data.privacyConsent !== undefined || data.restore !== undefined,
    {
      message: 'At least one field (privacyConsent or restore) must be provided',
    }
  )
  .refine(
    (data) => data.restore === undefined || data.restore === true,
    {
      message: 'restore field can only be true',
      path: ['restore'],
    }
  );
```

### Typy pomocnicze

#### DbProfile
```typescript
// Już zdefiniowany w src/types.ts
export type DbProfile = Tables<'profiles'>;
```

#### UpdateProfileData
```typescript
// Wewnętrzny typ dla update query
interface UpdateProfileData {
  privacy_consent?: boolean;
  deleted_at?: string | null;
  updated_at?: string; // Automatycznie przez trigger, ale można ustawić
}
```

### Typy błędów

#### ValidationErrorResponse
```typescript
// Do dodania w src/types.ts
interface ValidationErrorResponse {
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    errors: Array<{
      field: string;
      message: string;
    }>;
  }
}
```

#### ConflictErrorResponse
```typescript
// Do dodania w src/types.ts
interface ConflictErrorResponse {
  error: {
    code: 'CONFLICT';
    message: string;
    details?: string;
  }
}
```

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

#### Status HTTP
`200 OK`

#### Response Body
Zaktualizowany profil w formacie ProfileDTO:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "privacyConsent": true,
  "deletedAt": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T15:30:45.000Z"
}
```

#### Nagłówki odpowiedzi
```
Content-Type: application/json
Cache-Control: no-cache, no-store, must-revalidate
```

### Błędy

#### 400 Bad Request - Nieprawidłowa walidacja
**Przyczyna**: Błędne dane wejściowe (np. niepoprawny typ, brak pól)

**Scenariusz 1**: Brak pól do aktualizacji
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "errors": [
      {
        "field": "_root",
        "message": "At least one field (privacyConsent or restore) must be provided"
      }
    ]
  }
}
```

**Scenariusz 2**: Nieprawidłowy typ danych
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "errors": [
      {
        "field": "privacyConsent",
        "message": "Expected boolean, received string"
      }
    ]
  }
}
```

**Scenariusz 3**: `restore: false` (niedozwolone)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "errors": [
      {
        "field": "restore",
        "message": "restore field can only be true"
      }
    ]
  }
}
```

**Scenariusz 4**: Nieprawidłowy JSON
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid JSON in request body"
  }
}
```

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

#### 409 Conflict
**Przyczyna**: Konflikt stanu - np. próba restore profilu który nie jest usunięty

**Scenariusz**: Restore na aktywnym profilu
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Cannot restore profile that is not deleted",
    "details": "Profile is already active (deletedAt is null)"
  }
}
```

#### 422 Unprocessable Entity
**Przyczyna**: Dane są poprawne syntaktycznie, ale niepoprawne semantycznie

**Scenariusz**: Próba zmiany `privacyConsent` na usuniętym profilu (opcjonalnie, zależnie od logiki biznesowej)
```json
{
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Cannot update privacy consent on deleted profile",
    "details": "Please restore the profile first before updating privacy settings"
  }
}
```

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
       │ PATCH /api/v1/profile + JWT + UpdateProfileCommand
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
│  API Route Handler (PATCH)              │
│  (src/pages/api/v1/profile.ts)          │
│  - Sprawdzenie autentykacji             │
│  - Parse request body                   │
│  - Walidacja z Zod                      │
└──────┬──────────────────────────────────┘
       │ Validated UpdateProfileCommand
       │
       ▼
┌─────────────────────────────────────────┐
│  ProfileService.updateProfile()         │
│  (src/lib/services/profile.service.ts)  │
│  - Pobranie obecnego profilu            │
│  - Walidacja stanu (conflict checks)    │
│  - Przygotowanie danych do update       │
└──────┬──────────────────────────────────┘
       │ UpdateProfileData (snake_case)
       │
       ▼
┌─────────────────────────────────────────┐
│  Supabase Update Query                  │
│  UPDATE public.profiles                 │
│  SET privacy_consent = ?,               │
│      deleted_at = ?,                    │
│      updated_at = NOW()                 │
│  WHERE id = ?                           │
│  RETURNING *                            │
└──────┬──────────────────────────────────┘
       │ Updated DbProfile
       │
       ▼
┌─────────────────────────────────────────┐
│  Mapowanie danych                       │
│  - mapProfileToDTO(dbProfile)           │
│  - Konwersja snake_case → camelCase     │
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
Identyczny jak w GET /api/v1/profile:
- Middleware pobiera token JWT z nagłówka `Authorization`
- Tworzy klienta Supabase: `context.locals.supabase`
- Wywołuje `supabase.auth.getUser()` aby zweryfikować użytkownika

#### Krok 2: Parsowanie i walidacja (Handler)
1. **Parse request body**:
   ```typescript
   const body = await request.json();
   ```

2. **Walidacja z Zod**:
   ```typescript
   const result = UpdateProfileSchema.safeParse(body);
   if (!result.success) {
     // Zwróć 400 z błędami walidacji
   }
   ```

3. **Sprawdzenie autentykacji**:
   ```typescript
   const { data: { user } } = await locals.supabase.auth.getUser();
   if (!user) return 401;
   ```

#### Krok 3: Logika biznesowa (Service)
1. **Pobranie obecnego profilu**:
   ```typescript
   const currentProfile = await getProfile(userId, supabase);
   if (!currentProfile) return null; // → 404
   ```

2. **Walidacja stanu (conflict checks)**:
   ```typescript
   // Jeśli restore=true, sprawdź czy profil jest usunięty
   if (command.restore && !currentProfile.deletedAt) {
     throw new ConflictError('Profile is already active');
   }
   
   // Jeśli zmiana privacyConsent, sprawdź czy profil nie jest usunięty
   // (opcjonalna reguła biznesowa)
   if (command.privacyConsent !== undefined && currentProfile.deletedAt) {
     throw new UnprocessableError('Cannot update deleted profile');
   }
   ```

3. **Przygotowanie danych do update**:
   ```typescript
   const updateData: UpdateProfileData = {};
   
   if (command.privacyConsent !== undefined) {
     updateData.privacy_consent = command.privacyConsent;
   }
   
   if (command.restore === true) {
     updateData.deleted_at = null;
   }
   ```

#### Krok 4: Update w bazie danych
```typescript
const { data, error } = await supabase
  .from('profiles')
  .update(updateData)
  .eq('id', userId)
  .select()
  .single();
```

**Uwaga**: Trigger `update_updated_at_column` automatycznie ustawi `updated_at = NOW()`.

#### Krok 5: Mapowanie i odpowiedź
- Konwertuje `DbProfile` na `ProfileDTO` (snake_case → camelCase)
- Zwraca JSON response z kodem 200

### Scenariusze brzegowe

#### Scenariusz 1: Restore + privacyConsent w jednym request
```json
{
  "restore": true,
  "privacyConsent": true
}
```
**Logika**:
1. Sprawdź czy profil jest usunięty (deletedAt !== null)
2. Jeśli tak: ustaw `deleted_at = null` i `privacy_consent = true`
3. Jeśli nie: zwróć 409 Conflict

#### Scenariusz 2: Aktualizacja tego samego stanu (idempotentność)
```json
{
  "privacyConsent": true
}
```
Gdzie `privacyConsent` już jest `true`.

**Logika**: Aktualizacja przejdzie (200 OK), ale wartości się nie zmienią. To jest poprawne zachowanie (idempotentność PATCH).

#### Scenariusz 3: Pusty body
```json
{}
```
**Logika**: Zwróć 400 Bad Request z błędem walidacji (brak pól do aktualizacji).

## 6. Względy bezpieczeństwa

### Uwierzytelnianie (Authentication)
Identyczne jak w GET /api/v1/profile:
- Supabase JWT w nagłówku Authorization
- Weryfikacja przez `supabase.auth.getUser()`

### Autoryzacja (Authorization)
- Użytkownik może aktualizować **tylko swój własny profil**
- User ID pochodzi z tokenu JWT (nigdy z parametrów!)
- RLS policies wymuszają `auth.uid() = id`

### Row Level Security (RLS)

#### Wymagane polityki RLS
```sql
-- Polityka UPDATE: użytkownik może aktualizować tylko swój profil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);
```

**Uwaga**: Polityka SELECT (z GET endpoint) również jest potrzebna do pobrania obecnego profilu w ramach update operation.

### Walidacja danych wejściowych

#### Walidacja typów (Zod)
```typescript
UpdateProfileSchema.safeParse(body);
```
- Chroni przed nieprawidłowymi typami (string zamiast boolean)
- Wymusza obecność co najmniej jednego pola
- Blokuje `restore: false`

#### Walidacja logiki biznesowej
```typescript
// Nie można restore profilu który nie jest usunięty
if (restore && !currentProfile.deletedAt) {
  throw new ConflictError();
}

// Nie można zmieniać privacyConsent na usuniętym profilu (opcjonalnie)
if (privacyConsent !== undefined && currentProfile.deletedAt && !restore) {
  throw new UnprocessableError();
}
```

#### Whitelist pól
Tylko dozwolone pola mogą być aktualizowane:
- `privacyConsent` → `privacy_consent`
- `restore` → `deleted_at = null`

Inne pola (`id`, `created_at`, `updated_at`) są **ignorowane lub zabronione**.

### Ochrona przed atakami

#### SQL Injection
- **Chronione**: Supabase client używa parametryzowanych zapytań
- Wszystkie wartości są escapowane automatycznie

#### Mass Assignment
- **Chronione**: Whitelist pól w Zod schema
- Tylko `privacyConsent` i `restore` są przetwarzane
- Próba przesłania `id`, `createdAt` etc. jest ignorowana (lub zwraca błąd walidacji)

#### Race Conditions
**Problem**: Równoczesne aktualizacje tego samego profilu mogą prowadzić do konfliktów.

**Rozwiązanie**:
1. **Optymistic locking** (opcjonalnie): Dodaj pole `version` do tabeli
2. **Database constraints**: CHECK constraints w PostgreSQL
3. **Read-Update-Write pattern**: Czytamy aktualny stan przed update

**W MVP**: Najprostsze rozwiązanie to polegać na atomowości UPDATE query w PostgreSQL.

#### CSRF (Cross-Site Request Forgery)
- **Chronione**: JWT token w nagłówku (nie w cookie)
- Same-Origin Policy przeglądarek

### Logowanie (audyt)

#### Co logować
- **INFO**: Pomyślne aktualizacje (opcjonalnie, dla audytu)
  ```typescript
  console.info('[PATCH /api/v1/profile]', {
    userId,
    changes: { privacyConsent, restore },
    timestamp: new Date().toISOString()
  });
  ```

- **WARN**: Próby restore już aktywnego profilu
  ```typescript
  console.warn('[PATCH /api/v1/profile] Restore attempt on active profile:', userId);
  ```

- **ERROR**: Wszystkie błędy 500, 404 (profile not found)

#### Czego NIE logować
- Zawartości tokenu JWT
- Kompletnych danych profilu (GDPR)

## 7. Obsługa błędów

### Macierz błędów

| Scenariusz | Kod HTTP | Kod błędu | Komunikat | Akcja |
|------------|----------|-----------|-----------|-------|
| Brak tokenu JWT | 401 | UNAUTHORIZED | "Authentication required" | Zwróć 401 |
| Token nieprawidłowy | 401 | UNAUTHORIZED | "Invalid or expired token" | Zwróć 401 |
| Pusty body | 400 | VALIDATION_ERROR | "At least one field must be provided" | Zwróć 400 z details |
| Nieprawidłowy typ | 400 | VALIDATION_ERROR | "Expected boolean, received..." | Zwróć 400 z details |
| `restore: false` | 400 | VALIDATION_ERROR | "restore can only be true" | Zwróć 400 z details |
| Nieprawidłowy JSON | 400 | BAD_REQUEST | "Invalid JSON in request body" | Zwróć 400 |
| Profil nie istnieje | 404 | PROFILE_NOT_FOUND | "User profile not found" | Zwróć 404, loguj |
| Restore aktywnego profilu | 409 | CONFLICT | "Profile is already active" | Zwróć 409 |
| Update usuniętego profilu | 422 | UNPROCESSABLE_ENTITY | "Cannot update deleted profile" | Zwróć 422 |
| Błąd połączenia z DB | 500 | DATABASE_ERROR | "Database error" | Zwróć 500, loguj |
| Nieobsłużony wyjątek | 500 | INTERNAL_SERVER_ERROR | "Unexpected error" | Zwróć 500, loguj stack |

### Strategia obsługi błędów

#### Walidacja (Zod)
```typescript
const result = UpdateProfileSchema.safeParse(body);

if (!result.success) {
  const errors = result.error.errors.map(err => ({
    field: err.path.join('.') || '_root',
    message: err.message
  }));

  return new Response(JSON.stringify({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors
    }
  }), { status: 400 });
}
```

#### Logika biznesowa (Service)
```typescript
// Custom error classes
class ConflictError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

class UnprocessableError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = 'UnprocessableError';
  }
}

// W service
if (command.restore && !currentProfile.deletedAt) {
  throw new ConflictError(
    'Cannot restore profile that is not deleted',
    'Profile is already active'
  );
}
```

#### Handler (catch block)
```typescript
catch (error) {
  if (error instanceof ConflictError) {
    return new Response(JSON.stringify({
      error: {
        code: 'CONFLICT',
        message: error.message,
        details: error.details
      }
    }), { status: 409 });
  }

  if (error instanceof UnprocessableError) {
    return new Response(JSON.stringify({
      error: {
        code: 'UNPROCESSABLE_ENTITY',
        message: error.message,
        details: error.details
      }
    }), { status: 422 });
  }

  // Inne błędy → 500
  console.error('[PATCH /api/v1/profile]', error);
  return new Response(JSON.stringify({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  }), { status: 500 });
}
```

### Formatowanie błędów walidacji

#### Zod error formatting
```typescript
function formatZodErrors(zodError: ZodError) {
  return zodError.errors.map(err => ({
    field: err.path.length > 0 ? err.path.join('.') : '_root',
    message: err.message
  }));
}

// Użycie
if (!result.success) {
  const errors = formatZodErrors(result.error);
  // ...
}
```

## 8. Rozważania dotyczące wydajności

### Optymalizacje zapytań

#### Pattern: Read-Update-Return
Aktualne podejście wymaga dwóch zapytań:
1. SELECT (sprawdzenie stanu) - opcjonalne, ale zalecane
2. UPDATE ... RETURNING (aktualizacja + zwrócenie)

**Optymalizacja**: Można połączyć w jedno zapytanie UPDATE z walidacją w SQL:
```sql
UPDATE public.profiles
SET 
  privacy_consent = COALESCE($2, privacy_consent),
  deleted_at = CASE WHEN $3 THEN NULL ELSE deleted_at END
WHERE id = $1
  AND ($3 = false OR deleted_at IS NOT NULL) -- Walidacja restore
RETURNING *;
```

**Zaleta**: Jedno zapytanie zamiast dwóch (atomowość)
**Wada**: Trudniejsza do debugowania logika w SQL

**Rekomendacja dla MVP**: Użyj dwóch zapytań (prostsze, czytelniejsze). Optymalizuj później jeśli potrzeba.

### Transaction handling

#### Kiedy używać transakcji?
- **Nie potrzeba dla prostych UPDATE**: Single UPDATE jest atomowy
- **Potrzebne dla złożonych operacji**: Np. update profilu + insert do audyt log

**W MVP**: Nie używamy transakcji (prosty UPDATE wystarczy).

### Caching

#### Strategia cachowania
**Nie cachować odpowiedzi PATCH** - to operacja mutująca.

**Cache invalidation**: Po update profilu:
- Invalidate cache dla GET /api/v1/profile (jeśli był cachowany)
- W przyszłości: użyć Redis/Upstash dla distributed cache

### Wydajność zapytań

#### Index usage
- UPDATE po PK (`id`) wykorzystuje primary key index → bardzo szybkie (O(log n))
- Trigger `update_updated_at_column` działa w ramach tego samego zapytania → minimalny overhead

**Oczekiwany czas**: 5-10ms dla UPDATE query

### Rate limiting

**Rekomendowane limity**:
- **Per user**: 10 req/min (update profilu jest rzadki)
- **Per IP**: 50 req/min

**Uzasadnienie**: Zmiana ustawień profilu nie jest częstą operacją.

### Potencjalne wąskie gardła

#### 1. Walidacja stanu (SELECT przed UPDATE)
**Problem**: Dodatkowe zapytanie SELECT

**Rozwiązanie**:
- Cache rezultatu SELECT w pamięci (w ramach jednego request)
- Lub użyj SQL CASE + constraints zamiast SELECT

#### 2. Trigger updated_at
**Problem**: Minimalny overhead

**Rozwiązanie**: Nie wymaga optymalizacji (trigger jest bardzo szybki)

#### 3. Równoczesne aktualizacje
**Problem**: Dwa użytkowników aktualizuje ten sam profil jednocześnie (mało prawdopodobne)

**Rozwiązacja**: PostgreSQL's MVCC (Multi-Version Concurrency Control) automatycznie zarządza

### Metryki wydajności do monitorowania

| Metryka | Docelowa wartość | Alert przy |
|---------|------------------|------------|
| Response time (p50) | < 150ms | > 500ms |
| Response time (p95) | < 300ms | > 1000ms |
| Database query time | < 20ms | > 100ms |
| Error rate | < 0.1% | > 2% |
| Validation errors | < 5% | > 20% |

## 9. Etapy wdrożenia

### Faza 1: Przygotowanie (jeśli nie zrobione w GET endpoint)

#### 1.1. Dodanie polityk RLS
**Plik**: `supabase/migrations/[timestamp]_add_profiles_rls_policies.sql`

```sql
-- Polityka UPDATE: użytkownik może aktualizować swój profil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);
```

Uruchom migrację:
```bash
npx supabase db push
```

### Faza 2: Rozszerzenie ProfileService

#### 2.1. Dodanie metody updateProfile
**Plik**: `src/lib/services/profile.service.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbProfile, ProfileDTO, UpdateProfileCommand } from '@/types';

// Custom error classes
export class ConflictError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class UnprocessableError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = 'UnprocessableError';
  }
}

export class ProfileService {
  // ... existing getProfile method ...

  /**
   * Aktualizuje profil użytkownika
   * @param userId - UUID użytkownika (z JWT tokenu)
   * @param command - Dane do aktualizacji (UpdateProfileCommand)
   * @param supabase - Klient Supabase powiązany z żądaniem
   * @returns Zaktualizowany ProfileDTO
   * @throws ConflictError - Gdy próba restore aktywnego profilu
   * @throws UnprocessableError - Gdy próba update usuniętego profilu bez restore
   * @throws Error - Inne błędy bazy danych
   */
  static async updateProfile(
    userId: string,
    command: UpdateProfileCommand,
    supabase: SupabaseClient
  ): Promise<ProfileDTO> {
    // Krok 1: Pobierz obecny profil (walidacja stanu)
    const currentProfile = await this.getProfile(userId, supabase);

    if (!currentProfile) {
      throw new Error('Profile not found');
    }

    // Krok 2: Walidacja logiki biznesowej
    this.validateUpdateCommand(command, currentProfile);

    // Krok 3: Przygotuj dane do update (snake_case)
    const updateData: Partial<DbProfile> = {};

    if (command.privacyConsent !== undefined) {
      updateData.privacy_consent = command.privacyConsent;
    }

    if (command.restore === true) {
      updateData.deleted_at = null;
    }

    // Krok 4: Wykonaj update
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      throw new Error('Update failed: no data returned');
    }

    // Krok 5: Zwróć zmapowany DTO
    return this.mapProfileToDTO(data);
  }

  /**
   * Waliduje command względem obecnego stanu profilu
   * @throws ConflictError, UnprocessableError
   */
  private static validateUpdateCommand(
    command: UpdateProfileCommand,
    currentProfile: ProfileDTO
  ): void {
    // Walidacja 1: Restore tylko dla usuniętych profili
    if (command.restore === true && currentProfile.deletedAt === null) {
      throw new ConflictError(
        'Cannot restore profile that is not deleted',
        'Profile is already active (deletedAt is null)'
      );
    }

    // Walidacja 2: Nie można zmieniać privacyConsent na usuniętym profilu
    // (bez równoczesnego restore)
    if (
      command.privacyConsent !== undefined &&
      currentProfile.deletedAt !== null &&
      command.restore !== true
    ) {
      throw new UnprocessableError(
        'Cannot update privacy consent on deleted profile',
        'Please restore the profile first or include "restore": true in the request'
      );
    }
  }

  // ... existing mapProfileToDTO method ...
}
```

#### 2.2. Unit tests dla updateProfile
**Plik**: `src/lib/services/profile.service.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ProfileService, ConflictError, UnprocessableError } from './profile.service';

describe('ProfileService.updateProfile', () => {
  it('should update privacyConsent successfully', async () => {
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
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  id: '123',
                  privacy_consent: true,
                  deleted_at: null,
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T01:00:00Z',
                },
                error: null,
              })),
            })),
          })),
        })),
      })),
    };

    const result = await ProfileService.updateProfile(
      '123',
      { privacyConsent: true },
      mockSupabase as any
    );

    expect(result.privacyConsent).toBe(true);
    expect(result.updatedAt).toBe('2024-01-01T01:00:00Z');
  });

  it('should throw ConflictError when trying to restore active profile', async () => {
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
      })),
    };

    await expect(
      ProfileService.updateProfile('123', { restore: true }, mockSupabase as any)
    ).rejects.toThrow(ConflictError);
  });

  it('should throw UnprocessableError when updating deleted profile without restore', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: '123',
                privacy_consent: false,
                deleted_at: '2024-01-10T00:00:00Z', // Deleted profile
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    await expect(
      ProfileService.updateProfile(
        '123',
        { privacyConsent: true }, // Without restore
        mockSupabase as any
      )
    ).rejects.toThrow(UnprocessableError);
  });

  it('should successfully restore and update privacyConsent together', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: '123',
                privacy_consent: false,
                deleted_at: '2024-01-10T00:00:00Z', // Deleted
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
                  id: '123',
                  privacy_consent: true,
                  deleted_at: null, // Restored
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-15T00:00:00Z',
                },
                error: null,
              })),
            })),
          })),
        })),
      })),
    };

    const result = await ProfileService.updateProfile(
      '123',
      { restore: true, privacyConsent: true },
      mockSupabase as any
    );

    expect(result.deletedAt).toBeNull();
    expect(result.privacyConsent).toBe(true);
  });
});
```

### Faza 3: Implementacja Zod Schema

#### 3.1. Utworzenie validation schemas
**Plik**: `src/lib/validation/profile.schemas.ts` (nowy plik)

```typescript
import { z } from 'zod';

/**
 * Schema walidacji dla PATCH /api/v1/profile
 */
export const UpdateProfileSchema = z
  .object({
    privacyConsent: z
      .boolean({
        invalid_type_error: 'privacyConsent must be a boolean',
      })
      .optional(),

    restore: z
      .boolean({
        invalid_type_error: 'restore must be a boolean',
      })
      .optional(),
  })
  .strict() // Nie pozwól na dodatkowe pola
  .refine(
    (data) => data.privacyConsent !== undefined || data.restore !== undefined,
    {
      message: 'At least one field (privacyConsent or restore) must be provided',
    }
  )
  .refine(
    (data) => data.restore === undefined || data.restore === true,
    {
      message: 'restore field can only be true (or omitted)',
      path: ['restore'],
    }
  );

/**
 * Type inferred from schema
 */
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
```

#### 3.2. Helper do formatowania błędów Zod
**Plik**: `src/lib/utils/zod-errors.ts` (nowy plik)

```typescript
import type { ZodError } from 'zod';

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Formatuje błędy Zod do przyjaznego formatu API
 */
export function formatZodErrors(zodError: ZodError): ValidationError[] {
  return zodError.errors.map((err) => ({
    field: err.path.length > 0 ? err.path.join('.') : '_root',
    message: err.message,
  }));
}
```

### Faza 4: Implementacja PATCH handler

#### 4.1. Rozszerzenie route handler
**Plik**: `src/pages/api/v1/profile.ts`

Dodaj do istniejącego pliku (który ma GET handler):

```typescript
import type { APIRoute } from 'astro';
import { ProfileService, ConflictError, UnprocessableError } from '@/lib/services/profile.service';
import { UpdateProfileSchema } from '@/lib/validation/profile.schemas';
import { formatZodErrors } from '@/lib/utils/zod-errors';

// ... existing GET handler ...

/**
 * PATCH /api/v1/profile
 * Aktualizuje profil zalogowanego użytkownika
 */
export const PATCH: APIRoute = async ({ request, locals }) => {
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

    // Krok 2: Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid JSON in request body',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Krok 3: Walidacja z Zod
    const validationResult = UpdateProfileSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = formatZodErrors(validationResult.error);

      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors,
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Krok 4: Wykonaj update przez service
    const updatedProfile = await ProfileService.updateProfile(
      user.id,
      validationResult.data,
      locals.supabase
    );

    // Krok 5: Logowanie (opcjonalnie)
    console.info('[PATCH /api/v1/profile] Profile updated:', {
      userId: user.id,
      changes: validationResult.data,
      timestamp: new Date().toISOString(),
    });

    // Krok 6: Sukces - zwróć zaktualizowany profil
    return new Response(JSON.stringify(updatedProfile), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    // Obsługa błędów logiki biznesowej
    if (error instanceof ConflictError) {
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

    if (error instanceof UnprocessableError) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: error.message,
            details: error.details,
          },
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Obsługa błędu "Profile not found"
    if (error instanceof Error && error.message === 'Profile not found') {
      console.error('[PATCH /api/v1/profile] Profile not found for user:', user?.id);

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
    console.error('[PATCH /api/v1/profile] Unexpected error:', error);

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

// Wyłącz prerendering (już jest z GET handler)
export const prerender = false;
```

### Faza 5: Testowanie

#### 5.1. Testy jednostkowe
```bash
# Test ProfileService
npm run test src/lib/services/profile.service.test.ts

# Test Zod schemas (opcjonalnie)
npm run test src/lib/validation/profile.schemas.test.ts
```

#### 5.2. Testy integracyjne

**Test 1: Aktualizacja privacyConsent**
```bash
curl -X PATCH http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{"privacyConsent": true}'

# Expected: 200 OK + ProfileDTO z privacyConsent=true
```

**Test 2: Restore profilu**
```bash
# Najpierw soft-delete profilu (przez DELETE endpoint)
curl -X DELETE http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>"

# Następnie restore
curl -X PATCH http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{"restore": true}'

# Expected: 200 OK + ProfileDTO z deletedAt=null
```

**Test 3: Restore + privacyConsent razem**
```bash
curl -X PATCH http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{"restore": true, "privacyConsent": true}'

# Expected: 200 OK + ProfileDTO z deletedAt=null i privacyConsent=true
```

**Test 4: Pusty body (błąd walidacji)**
```bash
curl -X PATCH http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 400 Bad Request + validation error
```

**Test 5: Nieprawidłowy typ (błąd walidacji)**
```bash
curl -X PATCH http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{"privacyConsent": "yes"}'

# Expected: 400 Bad Request + "Expected boolean, received string"
```

**Test 6: Restore aktywnego profilu (409 Conflict)**
```bash
# Profil jest już aktywny
curl -X PATCH http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{"restore": true}'

# Expected: 409 Conflict + "Profile is already active"
```

**Test 7: Update usuniętego profilu bez restore (422)**
```bash
# Najpierw soft-delete profilu
curl -X DELETE http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>"

# Próba update bez restore
curl -X PATCH http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{"privacyConsent": true}'

# Expected: 422 Unprocessable Entity
```

**Test 8: Brak tokenu (401)**
```bash
curl -X PATCH http://localhost:4321/api/v1/profile \
  -H "Content-Type: application/json" \
  -d '{"privacyConsent": true}'

# Expected: 401 Unauthorized
```

**Test 9: Dodatkowe pola (błąd walidacji)**
```bash
curl -X PATCH http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{"privacyConsent": true, "id": "fake-id"}'

# Expected: 400 Bad Request (strict mode Zod)
```

**Test 10: restore=false (błąd walidacji)**
```bash
curl -X PATCH http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{"restore": false}'

# Expected: 400 Bad Request + "restore can only be true"
```

#### 5.3. Testy idempotentności

**Test**: Wielokrotne wywołanie z tymi samymi danymi
```bash
# Wywołaj 3 razy
for i in {1..3}; do
  curl -X PATCH http://localhost:4321/api/v1/profile \
    -H "Authorization: Bearer <valid_token>" \
    -H "Content-Type: application/json" \
    -d '{"privacyConsent": true}'
  echo ""
done

# Expected: Każde wywołanie zwraca 200 OK z tym samym rezultatem
```

### Faza 6: Dokumentacja

#### 6.1. Przykłady użycia w docs
Dodać do dokumentacji API:

**Plik**: `docs/api/profile/update-profile.md` (jeśli istnieje)

```markdown
## Update Profile

### Endpoint
`PATCH /api/v1/profile`

### Examples

#### Accept Privacy Consent
```bash
curl -X PATCH https://api.example.com/api/v1/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"privacyConsent": true}'
```

#### Restore Deleted Profile
```bash
curl -X PATCH https://api.example.com/api/v1/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"restore": true}'
```
```

#### 6.2. Changelog
```markdown
## [Unreleased]

### Added
- PATCH /api/v1/profile - Endpoint do aktualizacji profilu użytkownika
- UpdateProfileCommand i UpdateProfileSchema (Zod validation)
- ConflictError i UnprocessableError classes
- Profile restoration functionality (soft-delete undo)
```

### Faza 7: Code Review Checklist

Przed mergem PR, sprawdź:

- [ ] RLS policies dodane i przetestowane
- [ ] Wszystkie testy jednostkowe przechodzą
- [ ] Wszystkie 10 testów integracyjnych przechodzą
- [ ] Walidacja Zod pokrywa wszystkie edge cases
- [ ] Logika biznesowa w service (nie w handler)
- [ ] Proper error handling (401, 400, 404, 409, 422, 500)
- [ ] Logging dla audytu (INFO level)
- [ ] TypeScript kompiluje bez błędów
- [ ] Linter nie zgłasza błędów
- [ ] Dokumentacja zaktualizowana
- [ ] Early returns dla błędów (clean code)
- [ ] Nie ma mass assignment vulnerabilities
- [ ] User ID zawsze z tokenu JWT
- [ ] Environment variables ustawione

### Faza 8: Deployment

#### 8.1. Pre-deployment checklist
- [ ] Wszystkie punkty z Code Review Checklist ✓
- [ ] Smoke tests w staging przeszły
- [ ] Performance tests przeszły (response time < 300ms p95)
- [ ] Security audit przeprowadzony

#### 8.2. Deployment do staging
```bash
git checkout feature/profile-patch-endpoint
git push origin feature/profile-patch-endpoint
# Otwórz PR, poczekaj na approval
```

#### 8.3. Deployment do production
```bash
git checkout main
git pull origin main
npm run deploy
```

#### 8.4. Post-deployment verification

**Smoke test**:
```bash
# Test update privacyConsent w produkcji
curl -X PATCH https://api.production.com/api/v1/profile \
  -H "Authorization: Bearer <production_token>" \
  -H "Content-Type: application/json" \
  -d '{"privacyConsent": true}'

# Expected: 200 OK
```

**Monitoring**:
- Sprawdź logi w Supabase Dashboard
- Monitoruj error rate (powinien być < 1%)
- Sprawdź response times (p95 < 300ms)
- Verify validation errors nie są zbyt częste (< 5%)

### Faza 9: Monitoring i utrzymanie

#### 9.1. Metryki do śledzenia

**Application metrics**:
- Request rate (req/s)
- Response time distribution (p50, p95, p99)
- Error rate (ogólny i per error code)
- Validation error rate (% requestów z błędami walidacji)

**Database metrics**:
- UPDATE query performance
- Connection pool utilization
- RLS policy execution time

**Business metrics**:
- Privacy consent acceptance rate
- Profile restoration rate
- Most common validation errors

#### 9.2. Alerty

Skonfigurować alerty dla:
- Error rate > 2%
- p95 response time > 500ms
- Validation error rate > 20% (może wskazywać na problemy z API docs)
- Database query time > 100ms
- Profile not found errors (każdy przypadek wymaga investigacji)

#### 9.3. Utrzymanie

**Co tydzień**:
- Przejrzyj logi błędów
- Sprawdź trendy w validation errors
- Analyze most common update operations

**Co miesiąc**:
- Review performance metrics
- Optimize jeśli potrzeba
- Update dokumentacji jeśli pojawiły się nowe use cases

---

## Podsumowanie

Ten plan wdrożenia zapewnia kompleksowe wskazówki dla implementacji endpointu PATCH /api/v1/profile. Kluczowe punkty:

1. **Walidacja**: Zod schema z refine dla złożonych reguł
2. **Logika biznesowa**: Service layer z custom error classes
3. **Bezpieczeństwo**: RLS + whitelist pól + JWT auth
4. **Error handling**: 6 różnych kodów statusu dla różnych scenariuszy
5. **Testowalność**: 10 testów integracyjnych + unit tests

**Szacowany czas implementacji**: 3-5 godzin (więcej niż GET ze względu na walidację i logikę biznesową)

**Priorytet**: WYSOKI (podstawowy endpoint dla zarządzania profilem)

**Zależności**: GET /api/v1/profile, polityki RLS, Zod library

**Następny krok**: DELETE /api/v1/profile (soft delete profilu)

