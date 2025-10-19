# API Endpoint Implementation Plan: GET /api/v1/decks/{deckId}

## 1. Przegląd punktu końcowego

### Cel
Endpoint zwraca szczegóły pojedynczej talii fiszek należącej do zalogowanego użytkownika.

### Funkcjonalność
- Uwierzytelnienie użytkownika poprzez Supabase JWT
- Walidacja formatu UUID dla deckId
- Sprawdzenie czy użytkownik jest właścicielem talii (ownership verification)
- Pobranie szczegółów talii z bazy danych
- Security przez obscurity: 404 dla nieistniejących talii i talii innych użytkowników
- Zwrócenie pełnych danych talii

---

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
/api/v1/decks/{deckId}
```

### Parametry

#### Wymagane parametry

| Parametr | Typ | Lokalizacja | Walidacja | Opis |
|----------|-----|-------------|-----------|------|
| `deckId` | string (UUID) | Path | Valid UUID format | Unikalny identyfikator talii |
| Authorization | string (JWT) | Header | Valid Bearer token | Token uwierzytelniający |

#### Przykłady żądań

**Podstawowe żądanie:**
```http
GET /api/v1/decks/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGc...
```

**W JavaScript/TypeScript:**
```typescript
const response = await fetch(`/api/v1/decks/${deckId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Request Headers
```
Authorization: Bearer <jwt_token>
```

### Request Body
Nie dotyczy (metoda GET)

### Query Parameters
Brak

---

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

#### DeckDTO
```typescript
// src/types.ts (już zdefiniowany)
export interface DeckDTO {
  id: string;
  name: string;
  createdByAi: boolean;
  createdAt: string;      // ISO-8601
  updatedAt: string;      // ISO-8601
}
```

### Typy błędów

#### ErrorResponse
```typescript
// src/types.ts (już zdefiniowany)
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
  }
}
```

### Typy wewnętrzne

#### Path Parameter Validation
```typescript
// Nowy schema do stworzenia
const DeckIdParamSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID format')
});
```

#### DbDeck
```typescript
// src/types.ts (już zdefiniowany)
export type DbDeck = Tables<'decks'>;
```

---

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

#### Struktura odpowiedzi
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Geografia świata",
  "createdByAi": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Błąd walidacji (400 Bad Request)

**Scenariusz: Invalid UUID format**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid deck ID format",
    "details": "Deck ID must be a valid UUID"
  }
}
```

**Przykłady invalid UUID:**
- `"123"` - za krótki
- `"not-a-uuid"` - nieprawidłowy format
- `"550e8400-e29b-41d4-a716"` - niepełny UUID
- `""` - pusty string

### Nieautoryzowany dostęp (401 Unauthorized)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Nie znaleziono (404 Not Found)

**Scenariusze (oba zwracają ten sam response):**
1. Talia nie istnieje w bazie danych
2. Talia istnieje ale należy do innego użytkownika (**security przez obscurity**)

```json
{
  "error": {
    "code": "DECK_NOT_FOUND",
    "message": "Deck not found"
  }
}
```

**Ważne:** Nie rozróżniamy między "nie istnieje" a "nie masz dostępu" aby nie ujawniać informacji o zasobach innych użytkowników.

### Błąd serwera (500 Internal Server Error)

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

---

## 5. Przepływ danych

### Diagram przepływu

```
Client Request (GET /api/v1/decks/{deckId})
    ↓
[1] Astro API Route Handler (src/pages/api/v1/decks/[deckId].ts)
    ↓
[2] Extract deckId z context.params
    ↓
[3] Walidacja UUID format (Zod schema)
    ├─ Invalid → 400 Bad Request
    └─ Valid → continue
    ↓
[4] Uwierzytelnienie (context.locals.supabase.auth.getUser())
    ├─ Błąd/Brak → 401 Unauthorized
    └─ OK → userId
    ↓
[5] DeckService.getDeckById(userId, deckId)
    ↓
[6] Supabase Query (z RLS)
    SELECT * FROM decks
    WHERE id = $deckId AND user_id = $userId
    ↓
[7] Check result
    ├─ null/empty → 404 Not Found
    └─ found → DbDeck
    ↓
[8] Mapowanie DbDeck → DeckDTO (snake_case → camelCase)
    ↓
[9] Return 200 OK + DeckDTO
    ↓
Client receives DeckDTO
```

### SQL Query

#### Select by ID query
```sql
SELECT id, user_id, name, created_by_ai, created_at, updated_at
FROM decks
WHERE id = $1 AND user_id = $2;
```

**Parametry:**
- `$1` - deckId (z path parameter)
- `$2` - userId (z auth.uid())

**Indeksy wykorzystane:**
- PRIMARY KEY index na `id` (automatic, B-tree)
- Potencjalnie `idx_decks_user_id` dla composite WHERE

**Wydajność:**
- Lookup by PRIMARY KEY: O(log n), typically < 10ms
- Single row fetch: minimal data transfer

### Row Level Security (RLS)

Supabase automatycznie egzekwuje RLS policy:
```sql
-- Policy dla SELECT
CREATE POLICY "Users can view own decks"
ON decks
FOR SELECT
USING (user_id = auth.uid());
```

**Jak to działa:**
- Query automatycznie dostaje `WHERE user_id = auth.uid()`
- Jeśli deck należy do innego użytkownika, zwraca 0 rows
- Dla klienta wygląda jak "deck not found"

**Używamy `context.locals.supabase`** (user-scoped), więc RLS jest automatyczny.

---

## 6. Względy bezpieczeństwa

### 1. Uwierzytelnienie (Authentication)

#### Implementacja
- Sprawdzenie tokenu JWT przez `context.locals.supabase.auth.getUser()`
- Token musi być prawidłowy i nie wygasły
- Zwrócenie 401 Unauthorized jeśli brak tokenu lub jest nieprawidłowy

#### Kod
```typescript
const { data: { user }, error: authError } = await context.locals.supabase.auth.getUser();

if (authError || !user) {
  return new Response(JSON.stringify({
    error: {
      code: ErrorCode.UNAUTHORIZED,
      message: 'Authentication required'
    }
  }), {
    status: HttpStatus.UNAUTHORIZED,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 2. Autoryzacja (Authorization)

#### Row Level Security (RLS)
- **Automatyczna ochrona**: RLS zapewnia, że użytkownik widzi tylko swoje talie
- **Policy**: `USING (user_id = auth.uid())`
- **Enforcement**: Przez user-scoped Supabase client

#### Ownership Verification
Query zawiera `WHERE id = deckId AND user_id = userId`, więc:
- ✅ Jeśli talia należy do użytkownika → zwraca wiersz
- ✅ Jeśli talia należy do innego użytkownika → zwraca null (jak "not found")
- ✅ Jeśli talia nie istnieje → zwraca null

### 3. Information Disclosure Protection

#### Security przez obscurity

**Problem:**
Jeśli zwracamy różne kody dla "not found" (404) i "forbidden" (403), ujawniamy informację czy zasób istnieje.

**Rozwiązanie:**
Zawsze zwracaj **404 Not Found** dla obu scenariuszy:
- Talia nie istnieje
- Talia istnieje ale należy do innego użytkownika

**Implementacja:**
```typescript
const deck = await deckService.getDeckById(user.id, deckId);

if (!deck) {
  // NIE sprawdzamy czy istnieje w ogóle - po prostu 404
  return new Response(JSON.stringify({
    error: {
      code: ErrorCode.DECK_NOT_FOUND,
      message: 'Deck not found'
    }
  }), {
    status: HttpStatus.NOT_FOUND,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**Co NIE robić:**
```typescript
// ❌ ZŁE - ujawnia informację
const deckExists = await checkIfDeckExists(deckId);
if (deckExists && !isOwner) {
  return 403; // Attacker wie że talia istnieje
}
```

### 4. UUID Validation

#### Ochrona przed injection i DoS

**Walidacja:**
```typescript
const DeckIdParamSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID format')
});
```

**Co to chroni:**
- SQL Injection attempts (choć Supabase używa prepared statements)
- Invalid format inputs (np. bardzo długie stringi)
- Type confusion attacks

**Przykłady rejected inputs:**
- `"'; DROP TABLE decks; --"` - SQL injection attempt
- `"../../../etc/passwd"` - path traversal attempt
- `"A".repeat(10000)` - DoS attempt
- `"<script>alert('xss')</script>"` - XSS attempt

### 5. Rate Limiting

#### Specyfikacja
- Globalny limit: 100 req/min per IP i per user
- GET single resource: standardowy limit (nie jest expensive operation)

#### Implementacja (opcjonalna dla MVP)
- Middleware w `src/middleware/index.ts`
- Zwrócenie 429 Too Many Requests przy przekroczeniu

### 6. Logging i Monitoring

#### Co logować (server-side only)
- Successful retrievals (user_id, deck_id)
- 404 responses (może wskazywać na brute-force attempts)
- 401 responses (unauthorized access attempts)
- 400 responses (invalid UUID - może być scanning)

#### Co monitorować
- Wysoki % 404 dla jednego użytkownika (może próbować zgadywać IDs)
- Pattern w invalid UUIDs (scanning/enumeration attempts)

#### Czego NIE logować
- Tokenów JWT
- Internal DB errors w response (tylko w server logs)

---

## 7. Obsługa błędów

### Strategia obsługi błędów

#### Zasady
1. **Early returns** - waliduj parametry na początku
2. **Guard clauses** - sprawdź auth przed DB access
3. **Consistent 404** - nie rozróżniaj "not found" vs "forbidden"
4. **Generic 500** - nie ujawniaj internal errors
5. **Specific validation errors** - pomóż użytkownikowi z invalid input

### Katalog błędów

#### 1. 400 Bad Request - Invalid UUID format

**Scenariusz:**
Path parameter `deckId` nie jest prawidłowym UUID.

**Przykłady invalid inputs:**
```typescript
// Too short
GET /api/v1/decks/123

// Invalid format
GET /api/v1/decks/not-a-uuid

// Incomplete UUID
GET /api/v1/decks/550e8400-e29b-41d4

// Empty
GET /api/v1/decks/

// Special characters
GET /api/v1/decks/<script>alert(1)</script>
```

**Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid deck ID format",
    "details": "Deck ID must be a valid UUID"
  }
}
```

**Implementacja:**
```typescript
const validationResult = DeckIdParamSchema.safeParse(context.params);

if (!validationResult.success) {
  return new Response(JSON.stringify({
    error: {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid deck ID format',
      details: 'Deck ID must be a valid UUID'
    }
  }), {
    status: HttpStatus.BAD_REQUEST,
    headers: { 'Content-Type': 'application/json' }
  });
}

const { deckId } = validationResult.data;
```

#### 2. 401 Unauthorized - Brak autoryzacji

**Scenariusze:**
- Brak tokenu JWT w header Authorization
- Token nieprawidłowy lub zmanipulowany
- Token wygasł
- Token został unieważniony (logout)

**Response:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Implementacja:**
```typescript
const { data: { user }, error: authError } = await context.locals.supabase.auth.getUser();

if (authError || !user) {
  return new Response(JSON.stringify({
    error: {
      code: ErrorCode.UNAUTHORIZED,
      message: 'Authentication required'
    }
  }), {
    status: HttpStatus.UNAUTHORIZED,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

#### 3. 404 Not Found - Talia nie znaleziona

**Scenariusze (oba zwracają ten sam response):**
1. **Deck nie istnieje** - podany UUID nie istnieje w bazie
2. **Deck należy do innego użytkownika** - UUID prawidłowy, deck istnieje, ale user nie jest owner

**Response:**
```json
{
  "error": {
    "code": "DECK_NOT_FOUND",
    "message": "Deck not found"
  }
}
```

**Implementacja:**
```typescript
const deck = await deckService.getDeckById(user.id, deckId);

if (!deck) {
  return new Response(JSON.stringify({
    error: {
      code: ErrorCode.DECK_NOT_FOUND,
      message: 'Deck not found'
    }
  }), {
    status: HttpStatus.NOT_FOUND,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**Ważne:** 
- NIE sprawdzamy osobno czy deck istnieje w ogóle
- NIE zwracamy 403 Forbidden dla not owner
- Konsekwentnie 404 dla obu przypadków (security przez obscurity)

#### 4. 500 Internal Server Error - Błędy serwera

**Scenariusze:**
- Błąd połączenia z bazą danych
- Database timeout
- Nieoczekiwany błąd w query
- Błąd w logice serwisu
- RLS policy violation (nie powinno się zdarzyć przy prawidłowej implementacji)

**Response:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

**Implementacja:**
```typescript
try {
  const deck = await deckService.getDeckById(user.id, deckId);
  
  if (!deck) {
    return /* 404 response */;
  }
  
  return new Response(JSON.stringify(deck), {
    status: HttpStatus.OK,
    headers: { 'Content-Type': 'application/json' }
  });
} catch (error) {
  // Log full error server-side
  console.error('Error getting deck:', error);
  
  // Return generic error to client
  return new Response(JSON.stringify({
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred'
    }
  }), {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

#### 5. Database-specific errors

**Obsługa w DeckService:**
```typescript
async getDeckById(userId: string, deckId: string): Promise<DeckDTO | null> {
  const { data, error } = await this.supabase
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .eq('user_id', userId)
    .maybeSingle(); // Returns null if not found, nie rzuca błędu
    
  if (error) {
    console.error('Database error in getDeckById:', error);
    throw new Error(`Failed to get deck: ${error.message}`);
  }
  
  // data może być null - to jest OK (not found)
  return data ? mapDeckToDTO(data) : null;
}
```

**Ważne:** Używamy `.maybeSingle()` zamiast `.single()`:
- `.single()` - rzuca błąd jeśli 0 rows (nie chcemy tego)
- `.maybeSingle()` - zwraca null jeśli 0 rows (OK dla "not found")

---

## 8. Rozważania dotyczące wydajności

### 1. SELECT by PRIMARY KEY

#### Charakterystyka
- **Najszybszy typ query**: O(log n) lookup w B-tree index
- **Index automatyczny**: PRIMARY KEY ma built-in index
- **Single row**: minimal data transfer
- **No table scan**: używa index scan

#### Typowy czas odpowiedzi
- < 10ms dla database query
- < 50ms total endpoint latency (local)
- < 100ms total endpoint latency (remote Supabase)

### 2. RLS Overhead

#### Impact
- RLS dodaje `WHERE user_id = auth.uid()` do query
- Minimal overhead (< 1ms) bo:
  - Używamy indexed field (user_id)
  - To jest AND condition z PRIMARY KEY lookup

#### Optimized query plan
```sql
EXPLAIN ANALYZE
SELECT * FROM decks
WHERE id = 'uuid-here' AND user_id = 'user-uuid';

-- Plan: Index Scan using decks_pkey (very fast)
-- Filter on user_id uses idx_decks_user_id
```

### 3. Caching Strategy

#### Dla MVP: Brak cachingu
- Single deck fetch jest już bardzo szybki (< 50ms)
- Premature optimization
- Dane mogą się zmieniać (PATCH operations)

#### Przyszła optymalizacja (jeśli potrzebna)

**Client-side caching:**
```typescript
// Cache w przeglądarce (HTTP headers)
Response Headers:
  Cache-Control: private, max-age=60
  ETag: "deck-version-hash"
```

**Server-side caching (Redis):**
```typescript
const cacheKey = `deck:${deckId}:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const deck = await db.query(...);
await redis.setex(cacheKey, 300, JSON.stringify(deck)); // 5 min TTL
```

**Cache invalidation:**
- Invalidate on PATCH /api/v1/decks/{deckId}
- Invalidate on DELETE /api/v1/decks/{deckId}

### 4. N+1 Problem

**Nie dotyczy** - pobieramy pojedynczy zasób bez related entities.

Gdyby w przyszłości chcieli zwracać cards count:
```typescript
// Opcjonalnie: include stats
interface DeckWithStatsDTO extends DeckDTO {
  stats: {
    totalCards: number;
    dueCards: number;
  }
}

// Query z subquery
SELECT 
  d.*,
  (SELECT COUNT(*) FROM cards WHERE deck_id = d.id) as total_cards,
  (SELECT COUNT(*) FROM cards WHERE deck_id = d.id AND next_review_date <= NOW()) as due_cards
FROM decks d
WHERE d.id = $1 AND d.user_id = $2;
```

### 5. Monitoring

#### Metryki do śledzenia
- **Latency**: P50, P95, P99 response time
- **Error rate**: % 404, 500
- **Cache hit rate**: Jeśli caching zostanie dodany
- **Database query time**: Separate od total latency

#### Alerts
- P95 latency > 200ms
- Error rate > 5%
- Database query time > 100ms

---

## 9. Etapy wdrożenia

### Etap 1: Przygotowanie struktury plików

**Pliki do stworzenia:**
```
src/
└── pages/
    └── api/
        └── v1/
            └── decks/
                ├── index.ts                    # GET list, POST (już istnieje)
                └── [deckId].ts                 # GET single (NOWY)
```

**Akcje:**
1. Utworzyć plik `src/pages/api/v1/decks/[deckId].ts`
2. Ten sam plik będzie obsługiwał GET, PATCH, DELETE (wszystkie operacje na pojedynczej talii)

**Uwagi:**
- `[deckId]` w nazwie pliku oznacza dynamic route parameter w Astro
- Access przez `context.params.deckId`

---

### Etap 2: Rozszerzenie DeckService o getDeckById()

**Plik:** `src/lib/services/deck.service.ts`

**Kod do dodania:**

```typescript
/**
 * Get a deck by ID for a specific user
 * Returns null if deck not found or user is not the owner
 */
async getDeckById(userId: string, deckId: string): Promise<DeckDTO | null> {
  // Query with ownership check
  const { data, error } = await this.supabase
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .eq('user_id', userId)
    .maybeSingle(); // Returns null if not found, doesn't throw
    
  if (error) {
    console.error('Database error in getDeckById:', error);
    throw new Error(`Failed to get deck: ${error.message}`);
  }
  
  // data is null if deck not found or not owned by user
  if (!data) {
    return null;
  }
  
  // Map to DTO
  return mapDeckToDTO(data);
}
```

**Uwagi:**
- Używamy `.maybeSingle()` zamiast `.single()` - nie rzuca błędu dla 0 rows
- `WHERE id = deckId AND user_id = userId` - ownership check
- Return `null` jeśli nie znaleziono (handler zrobi 404)
- Używamy istniejącej funkcji `mapDeckToDTO()`

---

### Etap 3: Implementacja Zod validation schema

**Plik:** `src/pages/api/v1/decks/[deckId].ts`

**Kod do stworzenia:**

```typescript
import { z } from 'zod';

/**
 * Validation schema for deck ID path parameter
 */
const DeckIdParamSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID format')
});

export type DeckIdParam = z.infer<typeof DeckIdParamSchema>;
```

**Uwagi:**
- Walidacja UUID format zapobiega invalid inputs
- Error message jest user-friendly
- Schema jest co-located z route handler

---

### Etap 4: Implementacja GET handler

**Plik:** `src/pages/api/v1/decks/[deckId].ts`

**Kompletny kod:**

```typescript
export const prerender = false;

import type { APIContext } from 'astro';
import { z } from 'zod';
import { DeckService } from '../../../../lib/services/deck.service';
import { 
  HttpStatus, 
  ErrorCode,
  type DeckDTO,
  type ErrorResponse 
} from '../../../types';

/**
 * Validation schema for deck ID path parameter
 */
const DeckIdParamSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID format')
});

/**
 * GET /api/v1/decks/{deckId}
 * Get a single deck by ID for authenticated user
 */
export async function GET(context: APIContext): Promise<Response> {
  try {
    // Step 1: Validate path parameter
    const validationResult = DeckIdParamSchema.safeParse(context.params);
    
    if (!validationResult.success) {
      const errorResponse: ErrorResponse = {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid deck ID format',
          details: 'Deck ID must be a valid UUID'
        }
      };
      
      return new Response(JSON.stringify(errorResponse), {
        status: HttpStatus.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { deckId } = validationResult.data;
    
    // Step 2: Authenticate user
    const { data: { user }, error: authError } = await context.locals.supabase.auth.getUser();
    
    if (authError || !user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Authentication required'
        }
      };
      
      return new Response(JSON.stringify(errorResponse), {
        status: HttpStatus.UNAUTHORIZED,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Step 3: Fetch deck using DeckService
    const deckService = new DeckService(context.locals.supabase);
    const deck = await deckService.getDeckById(user.id, deckId);
    
    // Step 4: Check if deck was found
    if (!deck) {
      const errorResponse: ErrorResponse = {
        error: {
          code: ErrorCode.DECK_NOT_FOUND,
          message: 'Deck not found'
        }
      };
      
      return new Response(JSON.stringify(errorResponse), {
        status: HttpStatus.NOT_FOUND,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Step 5: Return success response
    return new Response(JSON.stringify(deck), {
      status: HttpStatus.OK,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    // Step 6: Handle unexpected errors
    console.error('Error in GET /api/v1/decks/[deckId]:', error);
    
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred'
      }
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**Uwagi implementacyjne:**
- Handler jest prosty - głównie walidacja i error handling
- Używamy `context.params.deckId` dla path parameter
- Consistent 404 dla "not found" i "not owner"
- Używamy `context.locals.supabase` (user-scoped)
- Top-level try-catch dla unexpected errors

---

### Etap 5: Testowanie manualne

**Przygotowanie:**
1. Serwer działa (`npm run dev`)
2. JWT token dla test user
3. ID istniejącej talii użytkownika
4. ID talii innego użytkownika (do testów security)

**Test cases:**

**1. Basic successful fetch:**
```bash
# Get valid deck that belongs to authenticated user
curl -X GET "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK
# Response: DeckDTO with all fields
```

**2. Deck not found:**
```bash
# UUID that doesn't exist in database
curl -X GET "http://localhost:4321/api/v1/decks/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 404 Not Found
# Response: { error: { code: "DECK_NOT_FOUND", message: "Deck not found" } }
```

**3. Deck belongs to another user (security test):**
```bash
# Valid UUID but belongs to different user
curl -X GET "http://localhost:4321/api/v1/decks/OTHER_USER_DECK_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 404 Not Found (NOT 403!)
# Response: Same as "not found" - don't reveal deck exists
```

**4. Invalid UUID format:**
```bash
# Too short
curl -X GET "http://localhost:4321/api/v1/decks/123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 400 Bad Request
# Response: "Invalid deck ID format"
```

**5. Invalid UUID - not UUID at all:**
```bash
curl -X GET "http://localhost:4321/api/v1/decks/not-a-uuid" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 400 Bad Request
```

**6. Incomplete UUID:**
```bash
curl -X GET "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 400 Bad Request
```

**7. No authentication:**
```bash
curl -X GET "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000"

# Expected: 401 Unauthorized
```

**8. Invalid token:**
```bash
curl -X GET "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer invalid_token"

# Expected: 401 Unauthorized
```

**9. SQL injection attempt (should fail validation):**
```bash
curl -X GET "http://localhost:4321/api/v1/decks/'; DROP TABLE decks; --" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 400 Bad Request (invalid UUID format)
```

**10. XSS attempt (should fail validation):**
```bash
curl -X GET "http://localhost:4321/api/v1/decks/<script>alert(1)</script>" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 400 Bad Request
```

---

### Etap 6: Testy automatyczne

**Test file:** `src/pages/api/v1/decks/[deckId].test.ts`

**Testy dla GET endpoint:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './[deckId]';
import { createMockContext } from '../../../../../test/utils';

describe('GET /api/v1/decks/{deckId}', () => {
  describe('Authentication', () => {
    it('should return 401 if not authenticated', async () => {
      const context = createMockContext({ 
        authenticated: false,
        params: { deckId: '550e8400-e29b-41d4-a716-446655440000' }
      });
      
      const response = await GET(context);
      
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Validation', () => {
    it('should return 400 for invalid UUID format', async () => {
      const context = createMockContext({ 
        authenticated: true,
        params: { deckId: 'invalid-uuid' }
      });
      
      const response = await GET(context);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid deck ID format');
    });

    it('should return 400 for too short UUID', async () => {
      const context = createMockContext({ 
        authenticated: true,
        params: { deckId: '123' }
      });
      
      const response = await GET(context);
      expect(response.status).toBe(400);
    });

    it('should return 400 for incomplete UUID', async () => {
      const context = createMockContext({ 
        authenticated: true,
        params: { deckId: '550e8400-e29b-41d4' }
      });
      
      const response = await GET(context);
      expect(response.status).toBe(400);
    });
  });

  describe('Success cases', () => {
    it('should return deck for valid ID and owner', async () => {
      const deckId = '550e8400-e29b-41d4-a716-446655440000';
      const context = createMockContext({ 
        authenticated: true,
        userId: 'test-user-id',
        params: { deckId },
        mockDbData: {
          deck: {
            id: deckId,
            user_id: 'test-user-id',
            name: 'Test Deck',
            created_by_ai: false,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        }
      });
      
      const response = await GET(context);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('id', deckId);
      expect(body).toHaveProperty('name', 'Test Deck');
      expect(body).toHaveProperty('createdByAi', false);
      expect(body).toHaveProperty('createdAt');
      expect(body).toHaveProperty('updatedAt');
      expect(body).not.toHaveProperty('user_id'); // Should not expose user_id
    });
  });

  describe('Not found cases', () => {
    it('should return 404 for non-existent deck', async () => {
      const context = createMockContext({ 
        authenticated: true,
        userId: 'test-user-id',
        params: { deckId: '00000000-0000-0000-0000-000000000000' },
        mockDbData: { deck: null } // Deck doesn't exist
      });
      
      const response = await GET(context);
      
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('DECK_NOT_FOUND');
    });

    it('should return 404 (not 403) for deck owned by another user', async () => {
      const deckId = '550e8400-e29b-41d4-a716-446655440000';
      const context = createMockContext({ 
        authenticated: true,
        userId: 'test-user-id',
        params: { deckId },
        mockDbData: { deck: null } // RLS filters it out
      });
      
      const response = await GET(context);
      
      // Important: Should be 404, NOT 403 (security through obscurity)
      expect(response.status).toBe(404);
      expect(response.status).not.toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('DECK_NOT_FOUND');
    });
  });

  describe('Security', () => {
    it('should not expose that deck exists for other users', async () => {
      // This test verifies security through obscurity
      const context = createMockContext({ 
        authenticated: true,
        userId: 'user-A',
        params: { deckId: 'deck-owned-by-user-B' }
      });
      
      const response = await GET(context);
      const body = await response.json();
      
      // Should look identical to "deck doesn't exist"
      expect(response.status).toBe(404);
      expect(body.error.code).toBe('DECK_NOT_FOUND');
      expect(body.error.message).toBe('Deck not found');
      // Message should NOT hint at existence: "access denied", "forbidden", etc.
    });
  });
});
```

**Testy dla DeckService.getDeckById():**

```typescript
// src/lib/services/deck.service.test.ts
describe('DeckService.getDeckById', () => {
  it('should return deck for valid ID and owner', async () => {
    const mockSupabase = createMockSupabaseClient({
      selectResponse: {
        data: {
          id: 'deck-123',
          user_id: 'user-123',
          name: 'Test Deck',
          created_by_ai: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      },
    });

    const service = new DeckService(mockSupabase);
    const result = await service.getDeckById('user-123', 'deck-123');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('deck-123');
    expect(result?.name).toBe('Test Deck');
  });

  it('should return null if deck not found', async () => {
    const mockSupabase = createMockSupabaseClient({
      selectResponse: {
        data: null,
        error: null,
      },
    });

    const service = new DeckService(mockSupabase);
    const result = await service.getDeckById('user-123', 'non-existent');

    expect(result).toBeNull();
  });

  it('should return null if deck belongs to another user', async () => {
    // RLS would filter this out, so data is null
    const mockSupabase = createMockSupabaseClient({
      selectResponse: {
        data: null, // Filtered by RLS
        error: null,
      },
    });

    const service = new DeckService(mockSupabase);
    const result = await service.getDeckById('user-A', 'deck-owned-by-user-B');

    expect(result).toBeNull();
  });

  it('should throw error if database query fails', async () => {
    const mockSupabase = createMockSupabaseClient({
      selectResponse: {
        data: null,
        error: { message: 'Database connection error' },
      },
    });

    const service = new DeckService(mockSupabase);
    
    await expect(
      service.getDeckById('user-123', 'deck-123')
    ).rejects.toThrow('Failed to get deck');
  });
});
```

---

### Etap 7: Dokumentacja i code review

**Checklist przed code review:**
- [ ] Kod kompiluje się bez błędów
- [ ] Wszystkie testy unit przechodzą
- [ ] Wszystkie testy integration przechodzą
- [ ] Linter nie zgłasza błędów
- [ ] Format kodu jest poprawny
- [ ] JSDoc comments dla public methods
- [ ] Error handling jest kompletny
- [ ] Security przez obscurity (404, nie 403)
- [ ] UUID validation działa
- [ ] RLS jest używany (user-scoped client)

**Dokumentacja:**
- [ ] Plan implementacji jest aktualny
- [ ] API examples są poprawne
- [ ] Security considerations są udokumentowane

---

### Etap 8: Integration z innymi endpoints

**Plik będzie obsługiwał więcej metod:**
```typescript
// src/pages/api/v1/decks/[deckId].ts
export const prerender = false;

// GET - już zaimplementowane
export async function GET(context: APIContext): Promise<Response> {
  // ... (już gotowe)
}

// PATCH - do implementacji w kolejnym planie
export async function PATCH(context: APIContext): Promise<Response> {
  // TODO: Update deck
}

// DELETE - do implementacji w kolejnym planie
export async function DELETE(context: APIContext): Promise<Response> {
  // TODO: Delete deck
}
```

**Uwagi:**
- Wszystkie metody na pojedynczej talii w jednym pliku
- Dzielą validation schema dla deckId
- Dzielą auth logic pattern
- Każda metoda ma własną business logic

---

## 10. Checklist końcowy

### Przed rozpoczęciem implementacji
- [ ] Przeczytać cały plan
- [ ] Zrozumieć dynamic routes w Astro
- [ ] Zrozumieć security przez obscurity (404 vs 403)
- [ ] Przygotować test data (deck IDs)

### Podczas implementacji
- [ ] Rozszerzyć DeckService o getDeckById() (Etap 2)
- [ ] Stworzyć plik [deckId].ts (Etap 1)
- [ ] Zaimplementować Zod schema (Etap 3)
- [ ] Zaimplementować GET handler (Etap 4)
- [ ] Przeprowadzić testy manualne (Etap 5)
- [ ] Napisać testy automatyczne (Etap 6)

### Po implementacji
- [ ] Wszystkie testy przechodzą
- [ ] Security tests pass (404 for other user's deck)
- [ ] UUID validation działa
- [ ] Code review przeprowadzony
- [ ] Dokumentacja aktualna

### Production readiness
- [ ] RLS policies aktywne
- [ ] Monitoring skonfigurowane
- [ ] Error logging działa
- [ ] 404 responses are consistent

---

## Appendix A: Przykładowe SQL queries

### Primary Key lookup
```sql
-- Query wykonywany przez getDeckById
SELECT 
  id,
  user_id,
  name,
  created_by_ai,
  created_at,
  updated_at
FROM decks
WHERE id = '550e8400-e29b-41d4-a716-446655440000'
  AND user_id = 'auth-user-id';

-- Z RLS automatycznie dodane:
-- AND user_id = auth.uid()
```

### Query plan analysis
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM decks
WHERE id = '550e8400-e29b-41d4-a716-446655440000'
  AND user_id = 'auth-user-id';

-- Expected plan:
-- Index Scan using decks_pkey on decks (cost=0.15..8.17 rows=1)
--   Index Cond: (id = 'uuid')
--   Filter: (user_id = 'user-uuid')
```

---

## Appendix B: Astro Dynamic Routes

### Jak działa [deckId].ts

**File structure:**
```
src/pages/api/v1/decks/
├── index.ts           → /api/v1/decks (GET list, POST)
└── [deckId].ts        → /api/v1/decks/:deckId (GET, PATCH, DELETE)
```

**URL matching:**
```
/api/v1/decks/550e8400-e29b-41d4-a716-446655440000
                ↑
                This part goes into context.params.deckId
```

**Access parameter:**
```typescript
export async function GET(context: APIContext) {
  const deckId = context.params.deckId; // string
  // ...
}
```

**Multiple parameters (przykład):**
```
src/pages/api/v1/decks/[deckId]/cards/[cardId].ts

URL: /api/v1/decks/deck-123/cards/card-456
context.params = {
  deckId: 'deck-123',
  cardId: 'card-456'
}
```

---

**Koniec planu implementacji**

Ten dokument stanowi kompletny przewodnik do implementacji endpointu GET /api/v1/decks/{deckId}. Szczególną uwagę zwrócono na security considerations (404 vs 403) i UUID validation.

