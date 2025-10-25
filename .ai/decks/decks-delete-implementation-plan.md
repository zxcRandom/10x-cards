# API Endpoint Implementation Plan: DELETE /api/v1/decks/{deckId}

## 1. Przegląd punktu końcowego

### Cel
Endpoint usuwa talię fiszek należącą do zalogowanego użytkownika wraz ze wszystkimi kartami (CASCADE delete).

### Funkcjonalność
- Uwierzytelnienie użytkownika poprzez Supabase JWT
- Walidacja formatu UUID dla deckId
- Sprawdzenie czy użytkownik jest właścicielem talii (ownership verification)
- **Physical deletion** z bazy danych (hard delete, nie soft delete)
- **Automatic CASCADE**: usunięcie talii automatycznie usuwa wszystkie karty z tej talii
- Security przez obscurity: 404 dla nieistniejących talii i talii innych użytkowników
- Zwrócenie potwierdzenia usunięcia

---

## 2. Szczegóły żądania

### Metoda HTTP
`DELETE`

### Struktura URL
```
/api/v1/decks/{deckId}
```

### Parametry

#### Wymagane parametry

| Parametr | Typ | Lokalizacja | Walidacja | Opis |
|----------|-----|-------------|-----------|------|
| `deckId` | string (UUID) | Path | Valid UUID format | Unikalny identyfikator talii do usunięcia |
| Authorization | string (JWT) | Header | Valid Bearer token | Token uwierzytelniający |

#### Przykłady żądań

**Podstawowe żądanie:**
```http
DELETE /api/v1/decks/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGc...
```

**W JavaScript/TypeScript:**
```typescript
const response = await fetch(`/api/v1/decks/${deckId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

if (response.ok) {
  const result = await response.json();
  console.log(result.status); // "deleted"
}
```

### Request Headers
```
Authorization: Bearer <jwt_token>
```

### Request Body
**Brak** - metoda DELETE nie przyjmuje request body.

---

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

#### DeckDeletedDTO
```typescript
// src/types.ts (już zdefiniowany)
export type DeckDeletedDTO = DeletedDTO;

// Rozwija się do:
export interface DeletedDTO {
  status: 'deleted';
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

#### Path Parameter Validation (reuse)
```typescript
// Z GET i PATCH - już zdefiniowany
const DeckIdParamSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID format')
});
```

---

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

#### Struktura odpowiedzi
```json
{
  "status": "deleted"
}
```

**Uwagi:**
- Status code: `200 OK` (zgodnie ze specyfikacją API)
- Alternatywny standard REST to `204 No Content` z pustym body, ale używamy 200 dla konsystencji
- Prosta struktura potwierdza operację

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
3. Talia została już usunięta wcześniej (**idempotent DELETE**)

```json
{
  "error": {
    "code": "DECK_NOT_FOUND",
    "message": "Deck not found"
  }
}
```

**Ważne:** DELETE jest idempotent w praktyce - drugi DELETE na tym samym ID zwraca 404.

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
Client Request (DELETE /api/v1/decks/{deckId})
    ↓
[1] Astro API Route Handler (src/pages/api/v1/decks/[deckId].ts)
    ↓
[2] Extract deckId z context.params
    ↓
[3] Walidacja UUID format (Zod schema - reuse)
    ├─ Invalid → 400 Bad Request
    └─ Valid → continue
    ↓
[4] Uwierzytelnienie (context.locals.supabase.auth.getUser())
    ├─ Błąd/Brak → 401 Unauthorized
    └─ OK → userId
    ↓
[5] DeckService.deleteDeck(userId, deckId)
    ↓
[6] Supabase DELETE (z RLS)
    DELETE FROM decks
    WHERE id = $deckId AND user_id = $userId
    ↓
[7] Database CASCADE delete
    Automatycznie usuwa:
    - Wszystkie cards WHERE deck_id = $deckId
    - Wszystkie reviews dla tych cards (CASCADE chain)
    ↓
[8] Check result (count affected rows)
    ├─ 0 rows → false → 404 Not Found
    └─ 1 row → true → success
    ↓
[9] Return 200 OK + { status: "deleted" }
    ↓
Client receives confirmation
```

### SQL Queries

#### Main DELETE query
```sql
DELETE FROM decks
WHERE id = $1 AND user_id = $2;
```

**Parametry:**
- `$1` - deckId (z path parameter)
- `$2` - userId (z auth.uid())

**Co dzieje się automatycznie (CASCADE):**

#### Cascade DELETE do cards
```sql
-- Automatycznie wykonywane przez foreign key constraint:
DELETE FROM cards
WHERE deck_id = $deckId;
-- Dzieje się automatycznie gdy usuwamy deck
```

#### Cascade DELETE do reviews
```sql
-- Automatycznie wykonywane gdy cards są usuwane:
DELETE FROM reviews
WHERE card_id IN (SELECT id FROM cards WHERE deck_id = $deckId);
-- Dzieje się automatycznie w łańcuchu CASCADE
```

#### AI Generation Logs - SET NULL (nie CASCADE)
```sql
-- deck_id jest ustawiane na NULL, logs pozostają:
UPDATE ai_generation_logs
SET deck_id = NULL
WHERE deck_id = $deckId;
-- ON DELETE SET NULL constraint
```

### CASCADE Chain Summary

```
DELETE deck
    ↓
DELETE cards (CASCADE)
    ↓
DELETE reviews (CASCADE)

ai_generation_logs.deck_id → SET NULL
```

**Indeksy wykorzystane:**
- PRIMARY KEY index na `decks.id`
- Foreign key index na `cards.deck_id` (dla CASCADE)
- Foreign key index na `reviews.card_id` (dla CASCADE chain)

**Wydajność:**
- DELETE deck: < 10ms (PRIMARY KEY lookup)
- CASCADE to cards: O(n) gdzie n = liczba kart (zwykle < 100)
- CASCADE to reviews: O(m) gdzie m = liczba review (zwykle < 1000)
- Total time: Zwykle < 100ms dla typowej talii

### Row Level Security (RLS)

Supabase automatycznie egzekwuje RLS policy:
```sql
-- Policy dla DELETE
CREATE POLICY "Users can delete own decks"
ON decks
FOR DELETE
USING (user_id = auth.uid());
```

**Jak to działa:**
- DELETE może być wykonany tylko na wierszach WHERE `user_id = auth.uid()`
- Jeśli deck należy do innego użytkownika, DELETE zwraca 0 rows
- Dla klienta wygląda jak "deck not found"

**CASCADE też respektuje RLS:**
- CASCADE DELETE do cards działa tylko na cards belonging to deleted deck
- RLS na cards NIE blokuje CASCADE (to jest foreign key operation)

**Używamy `context.locals.supabase`** (user-scoped), więc RLS jest automatyczny.

---

## 6. Względy bezpieczeństwa

### 1. Uwierzytelnienie (Authentication)

Identyczne jak w poprzednich endpoints - sprawdzenie JWT tokenu.

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

**Policy enforcement:**
- `USING (user_id = auth.uid())` - tylko owner może usunąć
- Jeśli user nie jest owner, DELETE zwraca 0 rows (wygląda jak "not found")

#### CASCADE Security

**Automatyczna ochrona:**
- CASCADE DELETE usuwa tylko cards z usuwanej talii
- RLS na cards NIE jest sprawdzane dla CASCADE operations (bezpieczne, bo działa w context FK constraint)
- User nie może przypadkowo usunąć cards z talii innych użytkowników

**Weryfikacja ownership:**
```sql
-- User może usunąć tylko swoje talie
DELETE FROM decks WHERE id = $id AND user_id = $userId;

-- CASCADE automatycznie usuwa tylko cards z tej talii
-- Nie ma ryzyka usunięcia cudzych danych
```

### 3. Information Disclosure Protection

#### Security przez obscurity

**Consistent z GET i PATCH:**
- Zawsze zwracaj **404 Not Found** dla:
  - Talia nie istnieje
  - Talia istnieje ale należy do innego użytkownika
  - Talia została już usunięta

**Implementacja:**
```typescript
const deleted = await deckService.deleteDeck(user.id, deckId);

if (!deleted) {
  // NIE sprawdzamy dlaczego - zawsze 404
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

### 4. Destructive Operation Safeguards

#### Obecnie: Brak dodatkowych safeguards (MVP)

**Dla przyszłości - opcjonalne safeguards:**

**1. Confirmation required (client-side):**
```typescript
// Frontend asks for confirmation
if (confirm(`Delete deck "${deckName}" and all ${cardCount} cards?`)) {
  await deleteDeck(deckId);
}
```

**2. Soft delete zamiast hard delete:**
```sql
-- Dodać pole deleted_at
ALTER TABLE decks ADD COLUMN deleted_at TIMESTAMPTZ;

-- UPDATE zamiast DELETE
UPDATE decks SET deleted_at = NOW() WHERE id = $id AND user_id = $userId;

-- Hide soft-deleted w queries
SELECT * FROM decks WHERE deleted_at IS NULL;
```

**3. Archive before delete:**
```sql
-- Backup do archive table
INSERT INTO decks_archive SELECT * FROM decks WHERE id = $id;
DELETE FROM decks WHERE id = $id;
```

**Dla MVP:** Proste hard delete bez dodatkowych safeguards.

### 5. Rate Limiting

#### Specyfikacja
- Globalny limit: 100 req/min per IP i per user
- DELETE operations: standardowy limit

#### Enhanced protection (opcjonalne)
- Niższy limit dla DELETE: np. 10 req/min (zapobiega mass deletion abuse)
- Alert jeśli użytkownik usuwa > 5 decks w minucie

### 6. Idempotency

#### DELETE Idempotency

**Behavior:**
```bash
# First DELETE
DELETE /api/v1/decks/{id}
Response: 200 OK, { status: "deleted" }

# Second DELETE (same ID)
DELETE /api/v1/decks/{id}
Response: 404 Not Found, { error: { code: "DECK_NOT_FOUND" } }
```

**Uwaga:** DELETE nie jest ściśle idempotent (różne response codes), ale praktycznie OK:
- Efekt jest idempotent: deck is gone
- Status code się różni (200 vs 404), ale end result jest ten sam

### 7. Concurrent Deletion

#### Scenariusz: Race Condition

**Problem:**
- Request A: DELETE deck X (start: 10:00:00)
- Request B: DELETE deck X (start: 10:00:01)
- Request A completes: 10:00:02 (200 OK)
- Request B completes: 10:00:03 (404 Not Found - already deleted)

**Rezultat:** OK - jeden succeeds, drugi dostaje 404.

**Atomic operation:** SQL DELETE jest atomic, więc nie ma risk niepełnego usunięcia.

### 8. Logging i Monitoring

#### Co logować (server-side only)
- Successful deletions (user_id, deck_id, timestamp)
- Failed deletions (404, 400)
- CASCADE stats (liczba usuniętych cards, opcjonalnie)
- Mass deletion patterns (alert jeśli > 5 decks w minucie)

#### Metryki
- Delete frequency per user
- Average time to delete (including CASCADE)
- % 404 responses (może wskazywać na bugs lub abuse)
- CASCADE impact (avg cards deleted per deck)

#### Alerts
- User deletes > 10 decks w krótkim czasie
- Unusual deletion patterns
- DELETE operations > 500ms (duże talie)

---

## 7. Obsługa błędów

### Strategia obsługi błędów

#### Zasady
1. **Early returns** - waliduj UUID na początku
2. **Guard clauses** - sprawdź auth przed DB access
3. **Consistent 404** - nie rozróżniaj "not found" vs "already deleted" vs "forbidden"
4. **Simple success** - tylko status: "deleted"
5. **Generic 500** - nie ujawniaj CASCADE errors

### Katalog błędów

#### 1. 400 Bad Request - Invalid UUID

**Scenariusz:** Path parameter `deckId` nie jest prawidłowym UUID.

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

**Przykłady:**
```bash
DELETE /api/v1/decks/123
DELETE /api/v1/decks/not-a-uuid
DELETE /api/v1/decks/<script>alert(1)</script>
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
```

#### 2. 401 Unauthorized

Identyczny jak w poprzednich endpoints.

#### 3. 404 Not Found

**Scenariusze:**
1. Deck nie istnieje w bazie
2. Deck istnieje ale należy do innego użytkownika
3. Deck został już usunięty przez poprzedni request (idempotency)

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
const deleted = await deckService.deleteDeck(user.id, deckId);

if (!deleted) {
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

#### 4. 500 Internal Server Error

**Scenariusze:**
- Błąd połączenia z bazą
- CASCADE operation failure (bardzo rzadkie)
- Foreign key constraint issues
- Database timeout (duża talia z tysiącami kart)

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
  const deleted = await deckService.deleteDeck(user.id, deckId);
  
  if (!deleted) {
    return /* 404 */;
  }
  
  return new Response(JSON.stringify({ status: 'deleted' }), {
    status: HttpStatus.OK,
    headers: { 'Content-Type': 'application/json' }
  });
} catch (error) {
  console.error('Error deleting deck:', error);
  
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

#### 5. CASCADE Failures (very rare)

**Możliwe problemy:**
- Foreign key constraint violation (nie powinno się zdarzyć jeśli schema jest OK)
- Timeout przy usuwaniu bardzo dużej talii (> 10k cards)
- Lock contention (concurrent access do cards)

**Handling:**
```typescript
// W DeckService
try {
  const { error, count } = await this.supabase
    .from('decks')
    .delete()
    .eq('id', deckId)
    .eq('user_id', userId);
    
  if (error) {
    // Log detailed error (może być CASCADE issue)
    console.error('Delete error:', error);
    throw new Error(`Failed to delete deck: ${error.message}`);
  }
  
  return count > 0;
} catch (error) {
  // Re-throw for route handler
  throw error;
}
```

---

## 8. Rozważania dotyczące wydajności

### 1. DELETE Performance

#### Typowa talia (< 100 cards)
- DELETE deck: < 10ms
- CASCADE to cards: < 50ms
- CASCADE to reviews: < 50ms
- **Total: < 100ms**

#### Duża talia (1000+ cards)
- DELETE deck: < 10ms
- CASCADE to cards: 200-500ms
- CASCADE to reviews: 500ms-2s
- **Total: 1-3 seconds**

#### Bardzo duża talia (10k+ cards) - edge case
- Total time: 10-30 seconds
- Risk timeout (default HTTP timeout: 30s)
- Potrzebne async deletion lub timeout zwiększenie

### 2. CASCADE Optimization

#### Database level

**Indeksy dla CASCADE:**
```sql
-- Zapewnij indeksy na foreign keys
CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_reviews_card_id ON reviews(card_id);
```

**Query plan:**
```sql
EXPLAIN ANALYZE DELETE FROM decks WHERE id = 'uuid';
-- Shows CASCADE operations and their costs
```

### 3. Async Deletion (przyszłość)

**Dla bardzo dużych talii:**

**Opcja 1: Background job**
```typescript
// Mark for deletion
UPDATE decks SET delete_scheduled_at = NOW() WHERE id = $id;
// Return 202 Accepted immediately

// Background worker (cron job)
DELETE FROM decks WHERE delete_scheduled_at IS NOT NULL AND delete_scheduled_at < NOW() - INTERVAL '1 minute';
```

**Opcja 2: Soft delete**
```typescript
// Immediate response
UPDATE decks SET deleted_at = NOW() WHERE id = $id;
// Return 200 OK { status: "deleted" }

// Background cleanup (optional)
DELETE FROM decks WHERE deleted_at < NOW() - INTERVAL '30 days';
```

**Dla MVP:** Synchronous delete (wystarczające dla małych-średnich talii).

### 4. Lock Contention

#### Problem
Jeśli inne operations (GET, UPDATE cards) działają na tej samej talii podczas DELETE, mogą wystąpić locks.

#### Mitigation
- PostgreSQL używa MVCC - reads nie blokują deletes
- Writes (INSERT/UPDATE cards) podczas DELETE mogą failować
- Dla MVP: akceptowalne - rare case

### 5. Transaction Isolation

#### CASCADE w transakcji
```sql
BEGIN;
DELETE FROM decks WHERE id = 'uuid';
-- CASCADE operations happen in same transaction
COMMIT;
-- All or nothing - atomic
```

**Korzyści:**
- Atomic operation - either all deleted or nothing
- No partial state (deck deleted but cards remain)

### 6. Monitoring

#### Metryki do śledzenia
- **Delete latency**: P50, P95, P99, P99.9
- **CASCADE impact**: Average cards deleted per deck
- **Slow deletes**: Operations > 1s
- **Timeout rate**: % operations that timeout

#### Alerts
- P95 latency > 500ms
- Any operation > 5s (may indicate very large deck)
- Timeout rate > 1%

---

## 9. Etapy wdrożenia

### Etap 1: Rozszerzenie DeckService o deleteDeck()

**Plik:** `src/lib/services/deck.service.ts`

**Kod do dodania:**

```typescript
/**
 * Delete a deck for a specific user
 * Returns true if deck was deleted, false if not found/not owner
 * CASCADE automatically deletes all cards and reviews
 */
async deleteDeck(userId: string, deckId: string): Promise<boolean> {
  // Execute DELETE with ownership check
  const { error, count } = await this.supabase
    .from('decks')
    .delete()
    .eq('id', deckId)
    .eq('user_id', userId);
    
  if (error) {
    console.error('Database error in deleteDeck:', error);
    throw new Error(`Failed to delete deck: ${error.message}`);
  }
  
  // count === 0 means deck not found or not owned by user
  // count === 1 means deck was successfully deleted (with CASCADE)
  return count > 0;
}
```

**Uwagi:**
- Używamy `count` do sprawdzenia czy usunięto wiersz
- `WHERE id = deckId AND user_id = userId` - ownership check
- CASCADE dzieje się automatycznie (foreign key constraints)
- Return `false` jeśli nie znaleziono (handler zrobi 404)
- Nie używamy `.select()` - DELETE nie zwraca danych (tylko count)

**Alternatywna implementacja (z RETURNING):**
```typescript
// Jeśli chcemy zwrócić usunięte dane
const { data, error } = await this.supabase
  .from('decks')
  .delete()
  .eq('id', deckId)
  .eq('user_id', userId)
  .select()
  .maybeSingle();

return data !== null;
```

---

### Etap 2: Implementacja DELETE handler

**Plik:** `src/pages/api/v1/decks/[deckId].ts`

**Kod do dodania (obok GET i PATCH handlers):**

```typescript
/**
 * DELETE /api/v1/decks/{deckId}
 * Delete a deck and all its cards (CASCADE) for authenticated user
 */
export async function DELETE(context: APIContext): Promise<Response> {
  try {
    // Step 1: Validate path parameter (reuse from GET/PATCH)
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
    
    // Step 3: Delete deck using DeckService
    const deckService = new DeckService(context.locals.supabase);
    const deleted = await deckService.deleteDeck(user.id, deckId);
    
    // Step 4: Check if deck was found and deleted
    if (!deleted) {
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
    const successResponse: DeckDeletedDTO = {
      status: 'deleted'
    };
    
    return new Response(JSON.stringify(successResponse), {
      status: HttpStatus.OK,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    // Step 6: Handle unexpected errors
    console.error('Error in DELETE /api/v1/decks/[deckId]:', error);
    
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

**Imports:**
```typescript
import type { DeckDeletedDTO } from '../../../types';
```

**Uwagi:**
- Najprostszy handler ze wszystkich (brak body validation)
- Reuse DeckIdParamSchema z GET/PATCH
- Consistent 404 dla not found i not owner
- Zwraca 200 OK (nie 204 No Content - zgodnie ze spec)
- Simple response: `{ status: "deleted" }`

---

### Etap 3: Weryfikacja CASCADE behavior

**Przed implementacją - sprawdź schema:**

```sql
-- Sprawdź czy foreign key ma ON DELETE CASCADE
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'cards'
  AND kcu.column_name = 'deck_id';

-- Expected result:
-- delete_rule: CASCADE
```

**Test CASCADE w development:**
```sql
-- Create test deck
INSERT INTO decks (id, user_id, name) VALUES ('test-uuid', 'user-uuid', 'Test Deck');

-- Create test cards
INSERT INTO cards (deck_id, question, answer) VALUES ('test-uuid', 'Q1', 'A1');
INSERT INTO cards (deck_id, question, answer) VALUES ('test-uuid', 'Q2', 'A2');

-- Check cards exist
SELECT COUNT(*) FROM cards WHERE deck_id = 'test-uuid'; -- Should be 2

-- Delete deck
DELETE FROM decks WHERE id = 'test-uuid';

-- Check cards are gone (CASCADE worked)
SELECT COUNT(*) FROM cards WHERE deck_id = 'test-uuid'; -- Should be 0
```

---

### Etap 4: Testowanie manualne

**Przygotowanie:**
1. Utworzyć test deck z kilkoma kartami
2. Sprawdzić że deck i cards istnieją
3. Wykonać DELETE
4. Zweryfikować że deck i cards są usunięte

**Test cases:**

**1. Successful deletion:**
```bash
# First, verify deck exists
curl -X GET "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Expected: 200 OK with deck data

# Delete the deck
curl -X DELETE "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK
# Response: { "status": "deleted" }

# Verify deck is gone
curl -X GET "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Expected: 404 Not Found
```

**2. Verify CASCADE (cards deleted):**
```bash
# Before delete: Get cards in deck
curl -X GET "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000/cards" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Note the card IDs

# Delete deck
curl -X DELETE "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Try to get a card that should be deleted
curl -X GET "http://localhost:4321/api/v1/cards/CARD_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Expected: 404 Not Found (CASCADE worked)
```

**3. Idempotent DELETE:**
```bash
# First delete
curl -X DELETE "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Expected: 200 OK

# Second delete (same ID)
curl -X DELETE "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Expected: 404 Not Found (already deleted)
```

**4. Deck not found:**
```bash
curl -X DELETE "http://localhost:4321/api/v1/decks/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 404 Not Found
```

**5. Deck belongs to another user:**
```bash
curl -X DELETE "http://localhost:4321/api/v1/decks/OTHER_USER_DECK_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 404 Not Found (NOT 403)
```

**6. Invalid UUID:**
```bash
curl -X DELETE "http://localhost:4321/api/v1/decks/invalid-uuid" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 400 Bad Request
```

**7. No authentication:**
```bash
curl -X DELETE "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000"

# Expected: 401 Unauthorized
```

**8. Large deck performance test (if available):**
```bash
# Create deck with many cards (e.g., 500)
# Then time the deletion
time curl -X DELETE "http://localhost:4321/api/v1/decks/LARGE_DECK_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: < 500ms for 500 cards
# If > 2s, consider optimization
```

---

### Etap 5: Testy automatyczne

**Test file:** `src/pages/api/v1/decks/[deckId].test.ts`

**Dodać testy dla DELETE:**

```typescript
describe('DELETE /api/v1/decks/{deckId}', () => {
  describe('Authentication', () => {
    it('should return 401 if not authenticated', async () => {
      const context = createMockContext({
        authenticated: false,
        method: 'DELETE',
        params: { deckId: '550e8400-e29b-41d4-a716-446655440000' }
      });
      
      const response = await DELETE(context);
      expect(response.status).toBe(401);
    });
  });

  describe('Validation', () => {
    it('should return 400 for invalid UUID', async () => {
      const context = createMockContext({
        authenticated: true,
        method: 'DELETE',
        params: { deckId: 'invalid-uuid' }
      });
      
      const response = await DELETE(context);
      expect(response.status).toBe(400);
    });
  });

  describe('Success cases', () => {
    it('should delete deck successfully', async () => {
      const deckId = '550e8400-e29b-41d4-a716-446655440000';
      const context = createMockContext({
        authenticated: true,
        userId: 'test-user-id',
        method: 'DELETE',
        params: { deckId },
        mockDbData: {
          deleteCount: 1 // Deck was deleted
        }
      });
      
      const response = await DELETE(context);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: 'deleted' });
    });
  });

  describe('Not found cases', () => {
    it('should return 404 for non-existent deck', async () => {
      const context = createMockContext({
        authenticated: true,
        userId: 'test-user-id',
        method: 'DELETE',
        params: { deckId: '00000000-0000-0000-0000-000000000000' },
        mockDbData: {
          deleteCount: 0 // Deck not found
        }
      });
      
      const response = await DELETE(context);
      expect(response.status).toBe(404);
    });

    it('should return 404 for deck owned by another user', async () => {
      const context = createMockContext({
        authenticated: true,
        userId: 'user-A',
        method: 'DELETE',
        params: { deckId: 'deck-owned-by-user-B' },
        mockDbData: {
          deleteCount: 0 // RLS prevents deletion
        }
      });
      
      const response = await DELETE(context);
      expect(response.status).toBe(404);
      expect(response.status).not.toBe(403);
    });
  });

  describe('Idempotency', () => {
    it('should return 404 on second DELETE (already deleted)', async () => {
      const deckId = '550e8400-e29b-41d4-a716-446655440000';
      
      // First delete
      const context1 = createMockContext({
        authenticated: true,
        userId: 'test-user-id',
        method: 'DELETE',
        params: { deckId },
        mockDbData: { deleteCount: 1 }
      });
      
      const response1 = await DELETE(context1);
      expect(response1.status).toBe(200);
      
      // Second delete (deck already gone)
      const context2 = createMockContext({
        authenticated: true,
        userId: 'test-user-id',
        method: 'DELETE',
        params: { deckId },
        mockDbData: { deleteCount: 0 } // Already deleted
      });
      
      const response2 = await DELETE(context2);
      expect(response2.status).toBe(404);
    });
  });
});
```

**Testy dla DeckService.deleteDeck():**

```typescript
describe('DeckService.deleteDeck', () => {
  it('should return true when deck is deleted', async () => {
    const mockSupabase = createMockSupabaseClient({
      deleteResponse: {
        count: 1,
        error: null,
      },
    });

    const service = new DeckService(mockSupabase);
    const result = await service.deleteDeck('user-123', 'deck-123');

    expect(result).toBe(true);
  });

  it('should return false when deck not found', async () => {
    const mockSupabase = createMockSupabaseClient({
      deleteResponse: {
        count: 0,
        error: null,
      },
    });

    const service = new DeckService(mockSupabase);
    const result = await service.deleteDeck('user-123', 'non-existent');

    expect(result).toBe(false);
  });

  it('should return false when user is not owner', async () => {
    const mockSupabase = createMockSupabaseClient({
      deleteResponse: {
        count: 0, // RLS prevents deletion
        error: null,
      },
    });

    const service = new DeckService(mockSupabase);
    const result = await service.deleteDeck('user-A', 'deck-owned-by-user-B');

    expect(result).toBe(false);
  });

  it('should throw error when database deletion fails', async () => {
    const mockSupabase = createMockSupabaseClient({
      deleteResponse: {
        count: 0,
        error: { message: 'Database error' },
      },
    });

    const service = new DeckService(mockSupabase);
    
    await expect(
      service.deleteDeck('user-123', 'deck-123')
    ).rejects.toThrow('Failed to delete deck');
  });
});
```

**Integration test - CASCADE behavior:**
```typescript
describe('CASCADE deletion (integration)', () => {
  it('should delete cards when deck is deleted', async () => {
    // This requires real DB or comprehensive mock
    const deckId = await createTestDeck();
    await createTestCard(deckId, 'Question 1', 'Answer 1');
    await createTestCard(deckId, 'Question 2', 'Answer 2');
    
    // Verify cards exist
    const cardsBefore = await getCardsForDeck(deckId);
    expect(cardsBefore).toHaveLength(2);
    
    // Delete deck
    await deckService.deleteDeck(userId, deckId);
    
    // Verify cards are gone
    const cardsAfter = await getCardsForDeck(deckId);
    expect(cardsAfter).toHaveLength(0);
  });
});
```

---

## 10. Checklist końcowy

### Przed rozpoczęciem implementacji
- [ ] Przeczytać cały plan
- [ ] Zrozumieć CASCADE behavior
- [ ] Zweryfikować foreign key constraints w schema
- [ ] Przygotować test data (deck + cards)

### Podczas implementacji
- [ ] Rozszerzyć DeckService o deleteDeck() (Etap 1)
- [ ] Zaimplementować DELETE handler (Etap 2)
- [ ] Zweryfikować CASCADE (Etap 3)
- [ ] Przeprowadzić testy manualne (Etap 4)
- [ ] Napisać testy automatyczne (Etap 5)

### Po implementacji
- [ ] Wszystkie testy przechodzą
- [ ] CASCADE działa (cards są usuwane)
- [ ] Idempotency works (drugi DELETE → 404)
- [ ] Consistent 404 dla not owner
- [ ] Performance OK (< 500ms dla typowych talii)

### Production readiness
- [ ] RLS DELETE policy aktywna
- [ ] CASCADE constraints są poprawne
- [ ] Monitoring delete operations
- [ ] Error logging OK
- [ ] Alert dla mass deletions
- [ ] Backup strategy (opcjonalnie)

---

## Appendix A: CASCADE Verification

### Sprawdzenie foreign key constraints
```sql
-- Lista wszystkich foreign keys z CASCADE
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS references_table,
  ccu.column_name AS references_column,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name = 'cards' OR tc.table_name = 'reviews')
ORDER BY tc.table_name, kcu.column_name;

-- Expected results:
-- cards.deck_id → decks.id (delete_rule: CASCADE)
-- reviews.card_id → cards.id (delete_rule: CASCADE)
-- reviews.user_id → users.id (delete_rule: CASCADE)
```

### Test CASCADE chain
```sql
-- Setup
INSERT INTO decks (id, user_id, name) VALUES ('test-deck', 'test-user', 'Test');
INSERT INTO cards (id, deck_id, question, answer) VALUES ('test-card-1', 'test-deck', 'Q1', 'A1');
INSERT INTO cards (id, deck_id, question, answer) VALUES ('test-card-2', 'test-deck', 'Q2', 'A2');
INSERT INTO reviews (card_id, user_id, grade) VALUES ('test-card-1', 'test-user', 4);
INSERT INTO reviews (card_id, user_id, grade) VALUES ('test-card-2', 'test-user', 5);

-- Count before delete
SELECT COUNT(*) FROM decks WHERE id = 'test-deck'; -- 1
SELECT COUNT(*) FROM cards WHERE deck_id = 'test-deck'; -- 2
SELECT COUNT(*) FROM reviews WHERE card_id IN ('test-card-1', 'test-card-2'); -- 2

-- Delete deck
DELETE FROM decks WHERE id = 'test-deck';

-- Count after delete (all should be 0)
SELECT COUNT(*) FROM decks WHERE id = 'test-deck'; -- 0
SELECT COUNT(*) FROM cards WHERE deck_id = 'test-deck'; -- 0 (CASCADE worked)
SELECT COUNT(*) FROM reviews WHERE card_id IN ('test-card-1', 'test-card-2'); -- 0 (CASCADE chain worked)
```

---

## Appendix B: RLS Policy dla DELETE

```sql
-- Policy dla DELETE (musi być utworzona)
CREATE POLICY "Users can delete own decks"
ON decks
FOR DELETE
USING (user_id = auth.uid());
```

**Test policy:**
```sql
-- Set user context
SET request.jwt.claims TO '{"sub": "user-123"}';

-- This should work (own deck)
DELETE FROM decks WHERE id = 'deck-owned-by-user-123';
-- Success: 1 row deleted

-- This should fail (other user's deck)
DELETE FROM decks WHERE id = 'deck-owned-by-user-456';
-- Success: 0 rows deleted (RLS blocked it, looks like "not found")

-- Reset
RESET request.jwt.claims;
```

---

**Koniec planu implementacji**

Ten dokument stanowi kompletny przewodnik do implementacji endpointu DELETE /api/v1/decks/{deckId}. Szczególną uwagę zwrócono na CASCADE behavior i jego weryfikację.

