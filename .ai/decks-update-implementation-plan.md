# API Endpoint Implementation Plan: PATCH /api/v1/decks/{deckId}

## 1. Przegląd punktu końcowego

### Cel
Endpoint aktualizuje nazwę istniejącej talii fiszek należącej do zalogowanego użytkownika.

### Funkcjonalność
- Uwierzytelnienie użytkownika poprzez Supabase JWT
- Walidacja formatu UUID dla deckId
- Walidacja request body (partial update - wszystkie pola opcjonalne)
- Sprawdzenie czy użytkownik jest właścicielem talii (ownership verification)
- Aktualizacja tylko podanych pól (PATCH semantics)
- Automatyczna aktualizacja `updated_at` przez database trigger
- Security przez obscurity: 404 dla nieistniejących talii i talii innych użytkowników
- Zwrócenie zaktualizowanych danych talii

---

## 2. Szczegóły żądania

### Metoda HTTP
`PATCH`

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

#### Request Body (JSON)

Wszystkie pola są opcjonalne (PATCH = partial update):

| Pole | Typ | Wymagane | Walidacja | Opis |
|------|-----|----------|-----------|------|
| `name` | string | NIE | non-empty (po trim), length ≤ 255 | Nowa nazwa talii |

**Ważne:** 
- Przynajmniej jedno pole musi być podane (empty body → 400)
- Pola nie podane w body pozostają niezmienione
- Nie można zmienić `createdByAi` (przeznaczone tylko do odczytu)
- `user_id`, `created_at` są automatycznie chronione (nie można ich zmienić)

#### Przykłady żądań

**Aktualizacja nazwy:**
```http
PATCH /api/v1/decks/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "name": "Geografia Polski - zaktualizowana"
}
```

**W JavaScript/TypeScript:**
```typescript
const response = await fetch(`/api/v1/decks/${deckId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Nowa nazwa talii'
  })
});
```

### Request Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## 3. Wykorzystywane typy

### Command Models

#### UpdateDeckCommand
```typescript
// src/types.ts (już zdefiniowany)
export interface UpdateDeckCommand {
  name?: string;
}
```

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

#### ValidationErrorResponse
```typescript
// src/types.ts (już zdefiniowany)
export interface ValidationErrorResponse {
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    errors: ValidationError[];
  }
}
```

### Typy wewnętrzne

#### Path Parameter Validation (reuse z GET)
```typescript
const DeckIdParamSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID format')
});
```

#### Request Body Validation
```typescript
// Nowy schema do stworzenia
const UpdateDeckSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Deck name cannot be empty')
    .max(255, 'Deck name must not exceed 255 characters')
    .optional()
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'Request body must contain at least one field to update' }
);
```

---

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

#### Struktura odpowiedzi
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Geografia Polski - zaktualizowana",
  "createdByAi": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-16T14:25:00.000Z"
}
```

**Uwagi:**
- Zwraca pełny DeckDTO (nie tylko zmienione pola)
- `updatedAt` jest automatycznie zaktualizowane przez database trigger
- Inne pola (`createdByAi`, `createdAt`) pozostają niezmienione

### Błąd walidacji (400 Bad Request)

**Scenariusz 1: Invalid UUID format**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid deck ID format",
    "details": "Deck ID must be a valid UUID"
  }
}
```

**Scenariusz 2: Empty request body**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body must contain at least one field to update"
  }
}
```

**Scenariusz 3: Empty name (po trim)**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "errors": [
      {
        "field": "name",
        "message": "Deck name cannot be empty"
      }
    ]
  }
}
```

**Scenariusz 4: Name za długa**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "errors": [
      {
        "field": "name",
        "message": "Deck name must not exceed 255 characters"
      }
    ]
  }
}
```

**Scenariusz 5: Invalid JSON**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid JSON in request body"
  }
}
```

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

### Conflict (409 Conflict) - opcjonalne

**Scenariusz: Optimistic locking conflict (jeśli zaimplementowane)**
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Deck was modified by another request",
    "details": "Please fetch the latest version and try again"
  }
}
```

**Dla MVP: Nie implementujemy** - last write wins.

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
Client Request (PATCH /api/v1/decks/{deckId} + JSON body)
    ↓
[1] Astro API Route Handler (src/pages/api/v1/decks/[deckId].ts)
    ↓
[2] Extract deckId z context.params
    ↓
[3] Walidacja UUID format (Zod schema - reuse z GET)
    ├─ Invalid → 400 Bad Request
    └─ Valid → continue
    ↓
[4] Parse request body (await request.json())
    ├─ Invalid JSON → 400 Bad Request
    └─ Valid → continue
    ↓
[5] Walidacja body (Zod schema)
    ├─ Empty body → 400 Bad Request
    ├─ Invalid fields → 400 Bad Request
    └─ Valid → UpdateDeckCommand
    ↓
[6] Uwierzytelnienie (context.locals.supabase.auth.getUser())
    ├─ Błąd/Brak → 401 Unauthorized
    └─ OK → userId
    ↓
[7] DeckService.updateDeck(userId, deckId, command)
    ↓
[8] Supabase UPDATE (z RLS)
    UPDATE decks
    SET name = $name, updated_at = NOW()
    WHERE id = $deckId AND user_id = $userId
    RETURNING *
    ↓
[9] Check result
    ├─ null/empty → 404 Not Found (deck not found OR not owner)
    └─ updated row → DbDeck
    ↓
[10] Mapowanie DbDeck → DeckDTO (snake_case → camelCase)
    ↓
[11] Return 200 OK + DeckDTO
    ↓
Client receives updated DeckDTO
```

### SQL Query

#### Update query
```sql
UPDATE decks
SET 
  name = $1,
  updated_at = NOW()
WHERE id = $2 AND user_id = $3
RETURNING id, user_id, name, created_by_ai, created_at, updated_at;
```

**Parametry:**
- `$1` - name (nowa wartość z command)
- `$2` - deckId (z path parameter)
- `$3` - userId (z auth.uid())

**Co dzieje się automatycznie:**
- `updated_at` - ustawiane przez trigger lub explicit `NOW()`
- Jeśli pole nie jest w SET, pozostaje niezmienione

**Indeksy wykorzystane:**
- PRIMARY KEY index na `id`
- Potencjalnie `idx_decks_user_id` dla composite WHERE

**Wydajność:**
- UPDATE by PRIMARY KEY: O(log n), typically < 10ms
- Trigger execution: < 1ms
- Total query time: < 20ms

### Row Level Security (RLS)

Supabase automatycznie egzekwuje RLS policy:
```sql
-- Policy dla UPDATE
CREATE POLICY "Users can update own decks"
ON decks
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

**Jak to działa:**
- `USING` - warunek dla SELECT części (która talia może być aktualizowana)
- `WITH CHECK` - warunek dla nowych wartości (zapobiega zmianie user_id)
- Jeśli deck należy do innego użytkownika, UPDATE zwraca 0 rows
- Dla klienta wygląda jak "deck not found"

**Używamy `context.locals.supabase`** (user-scoped), więc RLS jest automatyczny.

---

## 6. Względy bezpieczeństwa

### 1. Uwierzytelnienie (Authentication)

#### Implementacja
Identyczna jak w GET i POST - sprawdzenie JWT tokenu.

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
- `USING (user_id = auth.uid())` - tylko owner może aktualizować
- `WITH CHECK (user_id = auth.uid())` - user_id nie może być zmieniony

#### Ownership Verification
Query zawiera `WHERE id = deckId AND user_id = userId`, więc:
- ✅ Jeśli talia należy do użytkownika → aktualizuje
- ✅ Jeśli talia należy do innego użytkownika → zwraca null (jak "not found")
- ✅ Jeśli talia nie istnieje → zwraca null

### 3. Information Disclosure Protection

#### Security przez obscurity

**Konsekwentna implementacja z GET:**
- Zawsze zwracaj **404 Not Found** dla obu scenariuszy:
  - Talia nie istnieje
  - Talia istnieje ale należy do innego użytkownika

**Implementacja:**
```typescript
const deck = await deckService.updateDeck(user.id, deckId, command);

if (!deck) {
  // NIE sprawdzamy czy istnieje - po prostu 404
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

### 4. Field-level Protection

#### Pola których NIE można zmienić

**Chronione przez RLS:**
- `user_id` - RLS WITH CHECK zapobiega zmianie
- `id` - PRIMARY KEY nie może być zmieniony

**Chronione przez API:**
- `createdByAi` - nie akceptujemy w UpdateDeckCommand
- `created_at` - nie akceptujemy w body
- `updated_at` - automatycznie ustawiane przez trigger

**Implementacja:**
```typescript
// UpdateDeckCommand zawiera TYLKO name
// Inne pola są ignorowane nawet jeśli klient je wyśle
const UpdateDeckSchema = z.object({
  name: z.string().trim().min(1).max(255).optional()
  // NIE ma: createdByAi, created_at, updated_at, user_id
});
```

**Co jeśli klient wyśle dodatkowe pola?**
```typescript
// Request body: { name: "New name", createdByAi: true, hacker: "field" }

// Zod .safeParse() ignoruje unknown fields (default behavior)
// Tylko 'name' jest przetwarzane
```

**Strict mode (opcjonalnie):**
```typescript
const UpdateDeckSchema = z.object({
  name: z.string().trim().min(1).max(255).optional()
}).strict(); // Rzuca błąd jeśli są unknown fields
```

### 5. UUID Validation

Reuse z GET endpoint - walidacja UUID format zapobiega injection attempts.

### 6. Rate Limiting

#### Specyfikacja
- Globalny limit: 100 req/min per IP i per user
- UPDATE operations: standardowy limit

#### Implementacja (opcjonalna dla MVP)
- Middleware w `src/middleware/index.ts`
- Rozważyć niższy limit dla PATCH (np. 30 req/min) aby zapobiec abuse

### 7. Idempotency

#### PATCH semantics

**Idempotent operation:**
```bash
# First PATCH
PATCH /api/v1/decks/{id}
Body: { name: "New Name" }
Response: 200 OK, updated_at: "2024-01-15T10:00:00Z"

# Second PATCH (same data)
PATCH /api/v1/decks/{id}
Body: { name: "New Name" }
Response: 200 OK, updated_at: "2024-01-15T10:01:00Z" (changed!)
```

**Uwaga:** `updated_at` będzie różne, ale to jest OK - reprezentuje "last modified time".

### 8. Concurrent Updates

#### Last Write Wins (MVP)

**Scenariusz:**
- Request A: PATCH name = "Name A" (start: 10:00:00)
- Request B: PATCH name = "Name B" (start: 10:00:01)
- Request A completes: 10:00:02
- Request B completes: 10:00:03
- Final name: "Name B" (last write)

**Dla MVP:** Akceptowalne - większość użytkowników nie edytuje jednocześnie.

#### Optimistic Locking (przyszłość)

**Jeśli potrzebne:**
```typescript
// Dodać version field do schema
ALTER TABLE decks ADD COLUMN version INTEGER DEFAULT 1;

// W request body
interface UpdateDeckCommand {
  name?: string;
  version?: number; // Expected version
}

// W service
UPDATE decks
SET name = $1, version = version + 1, updated_at = NOW()
WHERE id = $2 AND user_id = $3 AND version = $4
RETURNING *;

// Jeśli version nie pasuje → 0 rows → 409 Conflict
```

### 9. Logging i Monitoring

#### Co logować (server-side only)
- Successful updates (user_id, deck_id, changed fields)
- Failed updates (404, 400) - może wskazywać na abuse
- Concurrent update conflicts (jeśli optimistic locking)

#### Metryki
- Update frequency per user
- % empty body requests (possible client bug)
- Average update latency

---

## 7. Obsługa błędów

### Strategia obsługi błędów

#### Zasady
1. **Early returns** - waliduj UUID i body na początku
2. **Guard clauses** - sprawdź auth przed DB access
3. **Consistent 404** - nie rozróżniaj "not found" vs "forbidden"
4. **Partial update validation** - sprawdź czy przynajmniej jedno pole
5. **Generic 500** - nie ujawniaj internal errors

### Katalog błędów

#### 1. 400 Bad Request - Validation errors

**Scenariusz 1: Invalid UUID format**
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
PATCH /api/v1/decks/123
PATCH /api/v1/decks/not-a-uuid
```

**Scenariusz 2: Empty request body**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body must contain at least one field to update"
  }
}
```

**Przykład:**
```bash
PATCH /api/v1/decks/{id}
Body: {}
```

**Scenariusz 3: Empty name after trim**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "errors": [
      {
        "field": "name",
        "message": "Deck name cannot be empty"
      }
    ]
  }
}
```

**Przykłady:**
```bash
Body: { "name": "" }
Body: { "name": "   " }
```

**Scenariusz 4: Name too long**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "errors": [
      {
        "field": "name",
        "message": "Deck name must not exceed 255 characters"
      }
    ]
  }
}
```

**Scenariusz 5: Invalid JSON**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid JSON in request body"
  }
}
```

**Implementacja:**
```typescript
// 1. Parse JSON
let body;
try {
  body = await context.request.json();
} catch (error) {
  return /* 400 Invalid JSON */;
}

// 2. Validate body
const validationResult = UpdateDeckSchema.safeParse(body);
if (!validationResult.success) {
  return /* 400 Validation Error */;
}

// 3. Check if empty (caught by .refine() in schema)
// No additional check needed if schema has .refine()
```

#### 2. 401 Unauthorized

Identyczny jak w GET i POST.

#### 3. 404 Not Found

**Scenariusze:**
1. Deck nie istnieje
2. Deck należy do innego użytkownika

**Implementacja:**
```typescript
const deck = await deckService.updateDeck(user.id, deckId, command);

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

#### 4. 409 Conflict (opcjonalne)

**Tylko jeśli optimistic locking jest zaimplementowane:**
```typescript
// W DeckService
if (result.rowCount === 0) {
  // Sprawdź czy istnieje ale version się nie zgadza
  const exists = await checkIfExists(deckId, userId);
  if (exists) {
    throw new ConflictError('Version mismatch');
  }
  return null; // Not found
}
```

**Dla MVP: Nie implementujemy.**

#### 5. 500 Internal Server Error

Identyczny handling jak w GET i POST.

---

## 8. Rozważania dotyczące wydajności

### 1. UPDATE Performance

#### Charakterystyka
- **By PRIMARY KEY**: O(log n) lookup
- **Single row update**: Minimal data transfer
- **Index updates**: Tylko jeśli indexed field się zmieni
- **Trigger execution**: `updated_at` trigger < 1ms

#### Typowy czas odpowiedzi
- < 20ms dla database UPDATE
- < 80ms total endpoint latency

### 2. Trigger Overhead

#### updated_at Trigger
```sql
CREATE TRIGGER update_decks_updated_at
BEFORE UPDATE ON decks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Performance impact:** < 1ms (bardzo szybkie)

### 3. Optimistic Locking Overhead

**Jeśli zaimplementowane (przyszłość):**
- Dodatkowe `WHERE version = $expected`
- Minimal overhead (index lookup)
- Dodatkowy SELECT jeśli conflict (sprawdzenie czy istnieje)

**Dla MVP:** Brak - not implemented.

### 4. No-op Updates

**Scenariusz:** Update z tą samą wartością
```typescript
// Current name: "Test Deck"
// PATCH body: { name: "Test Deck" }
```

**Behavior:**
- SQL UPDATE wykonuje się
- updated_at zmienia się (trigger)
- Zwraca 200 OK (idempotent)

**Optymalizacja (opcjonalna):**
```typescript
// Przed UPDATE, sprawdź czy wartość się zmienia
const current = await getDeckById(userId, deckId);
if (current.name === command.name) {
  return current; // Return bez UPDATE
}
```

**Dla MVP:** Nie optymalizujemy - prostsze.

### 5. Monitoring

#### Metryki
- **Update latency**: P50, P95, P99
- **Update frequency**: Updates per minute
- **Error rate**: % 404, 400, 500
- **No-op updates**: % updates that don't change data

---

## 9. Etapy wdrożenia

### Etap 1: Rozszerzenie DeckService o updateDeck()

**Plik:** `src/lib/services/deck.service.ts`

**Kod do dodania:**

```typescript
/**
 * Update a deck for a specific user
 * Returns updated deck or null if not found/not owner
 */
async updateDeck(
  userId: string, 
  deckId: string, 
  command: UpdateDeckCommand
): Promise<DeckDTO | null> {
  // Prepare update data (only fields provided in command)
  const updateData: Partial<DbDeck> = {};
  
  if (command.name !== undefined) {
    updateData.name = command.name;
  }
  
  // Execute UPDATE with ownership check
  const { data, error } = await this.supabase
    .from('decks')
    .update(updateData)
    .eq('id', deckId)
    .eq('user_id', userId)
    .select()
    .maybeSingle(); // Returns null if not found or not owner
    
  if (error) {
    console.error('Database error in updateDeck:', error);
    throw new Error(`Failed to update deck: ${error.message}`);
  }
  
  // data is null if deck not found or not owned by user
  if (!data) {
    return null;
  }
  
  // Map to DTO
  return mapDeckToDTO(data);
}
```

**Import:**
```typescript
import type { UpdateDeckCommand } from '../../types';
```

**Uwagi:**
- Używamy `.maybeSingle()` - nie rzuca błędu dla 0 rows
- `WHERE id = deckId AND user_id = userId` - ownership check
- Tylko pola z command są aktualizowane (partial update)
- `updated_at` jest automatycznie ustawiane przez trigger
- Return `null` jeśli nie znaleziono (handler zrobi 404)

---

### Etap 2: Implementacja Zod validation schema

**Plik:** `src/pages/api/v1/decks/[deckId].ts`

**Kod do dodania:**

```typescript
import { z } from 'zod';

/**
 * Validation schema for PATCH /api/v1/decks/{deckId} request body
 */
const UpdateDeckSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Deck name cannot be empty')
    .max(255, 'Deck name must not exceed 255 characters')
    .optional()
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'Request body must contain at least one field to update' }
);

export type UpdateDeckBody = z.infer<typeof UpdateDeckSchema>;
```

**Uwagi:**
- Wszystkie pola są `.optional()` (PATCH semantics)
- `.refine()` sprawdza czy przynajmniej jedno pole jest podane
- `.trim()` jest kluczowy - usuwa whitespace przed walidacją
- Nie akceptujemy `createdByAi` ani innych pól

---

### Etap 3: Implementacja PATCH handler

**Plik:** `src/pages/api/v1/decks/[deckId].ts`

**Kod do dodania (obok istniejącego GET handler):**

```typescript
/**
 * PATCH /api/v1/decks/{deckId}
 * Update a deck for authenticated user
 */
export async function PATCH(context: APIContext): Promise<Response> {
  try {
    // Step 1: Validate path parameter (reuse from GET)
    const pathValidationResult = DeckIdParamSchema.safeParse(context.params);
    
    if (!pathValidationResult.success) {
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
    
    const { deckId } = pathValidationResult.data;
    
    // Step 2: Parse request body
    let body;
    try {
      body = await context.request.json();
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: {
          code: ErrorCode.BAD_REQUEST,
          message: 'Invalid JSON in request body'
        }
      };
      
      return new Response(JSON.stringify(errorResponse), {
        status: HttpStatus.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Step 3: Validate request body
    const bodyValidationResult = UpdateDeckSchema.safeParse(body);
    
    if (!bodyValidationResult.success) {
      const errors = bodyValidationResult.error.errors.map(err => ({
        field: err.path.join('.') || 'unknown',
        message: err.message,
      }));
      
      const errorResponse: ValidationErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.length === 1 && !errors[0].field 
            ? errors[0].message 
            : 'Invalid request body',
          errors: errors.length === 1 && !errors[0].field ? [] : errors,
        }
      };
      
      return new Response(JSON.stringify(errorResponse), {
        status: HttpStatus.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const command = bodyValidationResult.data;
    
    // Step 4: Authenticate user
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
    
    // Step 5: Update deck using DeckService
    const deckService = new DeckService(context.locals.supabase);
    const deck = await deckService.updateDeck(user.id, deckId, command);
    
    // Step 6: Check if deck was found and updated
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
    
    // Step 7: Return success response
    return new Response(JSON.stringify(deck), {
      status: HttpStatus.OK,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    // Step 8: Handle unexpected errors
    console.error('Error in PATCH /api/v1/decks/[deckId]:', error);
    
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
import type { UpdateDeckCommand } from '../../../../types';
```

**Uwagi:**
- Reuse DeckIdParamSchema z GET
- Osobne try-catch dla JSON parsing
- Specjalna obsługa .refine() error (no field path)
- Consistent 404 dla not found i not owner
- Zwraca 200 OK (nie 201 Created - to jest UPDATE)

---

### Etap 4: Testowanie manualne

**Test cases:**

**1. Successful update:**
```bash
curl -X PATCH "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Deck Name"}'

# Expected: 200 OK
# Response: DeckDTO z nową nazwą i updated updatedAt
```

**2. Empty body:**
```bash
curl -X PATCH "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 400 Bad Request
# "Request body must contain at least one field to update"
```

**3. Empty name:**
```bash
curl -X PATCH "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":""}'

# Expected: 400 Bad Request
# "Deck name cannot be empty"
```

**4. Whitespace only name:**
```bash
curl -X PATCH "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"   "}'

# Expected: 400 Bad Request
```

**5. Name too long:**
```bash
LONG_NAME=$(printf 'A%.0s' {1..256})
curl -X PATCH "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$LONG_NAME\"}"

# Expected: 400 Bad Request
```

**6. Deck not found:**
```bash
curl -X PATCH "http://localhost:4321/api/v1/decks/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Name"}'

# Expected: 404 Not Found
```

**7. Deck belongs to another user:**
```bash
curl -X PATCH "http://localhost:4321/api/v1/decks/OTHER_USER_DECK_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Name"}'

# Expected: 404 Not Found (NOT 403)
```

**8. Invalid UUID:**
```bash
curl -X PATCH "http://localhost:4321/api/v1/decks/invalid-uuid" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Name"}'

# Expected: 400 Bad Request
```

**9. No authentication:**
```bash
curl -X PATCH "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Name"}'

# Expected: 401 Unauthorized
```

**10. Idempotent update (same value):**
```bash
# First update
curl -X PATCH "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Idempotent Name"}'

# Second update (same name)
curl -X PATCH "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Idempotent Name"}'

# Expected: Both return 200 OK
# updatedAt will be different (trigger updates it)
```

**11. Special characters:**
```bash
curl -X PATCH "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Math & Physics (2024) - żółć!"}'

# Expected: 200 OK
# Special characters should be preserved
```

**12. Extra fields (should be ignored):**
```bash
curl -X PATCH "http://localhost:4321/api/v1/decks/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Valid Name","createdByAi":true,"hacker":"field"}'

# Expected: 200 OK
# Only 'name' is updated, other fields ignored
# createdByAi remains unchanged
```

---

### Etap 5: Testy automatyczne

**Test file:** `src/pages/api/v1/decks/[deckId].test.ts`

**Dodać testy dla PATCH:**

```typescript
describe('PATCH /api/v1/decks/{deckId}', () => {
  describe('Validation', () => {
    it('should return 400 for empty body', async () => {
      const context = createMockContext({
        authenticated: true,
        method: 'PATCH',
        params: { deckId: '550e8400-e29b-41d4-a716-446655440000' },
        body: {}
      });
      
      const response = await PATCH(context);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.message).toContain('at least one field');
    });

    it('should return 400 for empty name', async () => {
      const context = createMockContext({
        authenticated: true,
        method: 'PATCH',
        params: { deckId: '550e8400-e29b-41d4-a716-446655440000' },
        body: { name: '' }
      });
      
      const response = await PATCH(context);
      expect(response.status).toBe(400);
    });

    it('should return 400 for whitespace-only name', async () => {
      const context = createMockContext({
        authenticated: true,
        method: 'PATCH',
        params: { deckId: '550e8400-e29b-41d4-a716-446655440000' },
        body: { name: '   ' }
      });
      
      const response = await PATCH(context);
      expect(response.status).toBe(400);
    });

    it('should return 400 for name exceeding 255 characters', async () => {
      const context = createMockContext({
        authenticated: true,
        method: 'PATCH',
        params: { deckId: '550e8400-e29b-41d4-a716-446655440000' },
        body: { name: 'A'.repeat(256) }
      });
      
      const response = await PATCH(context);
      expect(response.status).toBe(400);
    });
  });

  describe('Success cases', () => {
    it('should update deck name', async () => {
      const deckId = '550e8400-e29b-41d4-a716-446655440000';
      const context = createMockContext({
        authenticated: true,
        userId: 'test-user-id',
        method: 'PATCH',
        params: { deckId },
        body: { name: 'Updated Name' },
        mockDbData: {
          updatedDeck: {
            id: deckId,
            user_id: 'test-user-id',
            name: 'Updated Name',
            created_by_ai: false,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z'
          }
        }
      });
      
      const response = await PATCH(context);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Updated Name');
      expect(body.updatedAt).toBe('2024-01-02T00:00:00Z');
    });

    it('should trim whitespace from name', async () => {
      const context = createMockContext({
        authenticated: true,
        userId: 'test-user-id',
        method: 'PATCH',
        params: { deckId: '550e8400-e29b-41d4-a716-446655440000' },
        body: { name: '  Trimmed  ' }
      });
      
      const response = await PATCH(context);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Trimmed');
    });

    it('should ignore extra fields in body', async () => {
      const context = createMockContext({
        authenticated: true,
        userId: 'test-user-id',
        method: 'PATCH',
        params: { deckId: '550e8400-e29b-41d4-a716-446655440000' },
        body: { 
          name: 'Valid Name',
          createdByAi: true, // Should be ignored
          hacker: 'field' // Should be ignored
        }
      });
      
      const response = await PATCH(context);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Valid Name');
      expect(body.createdByAi).toBe(false); // Unchanged
    });
  });

  describe('Not found cases', () => {
    it('should return 404 for non-existent deck', async () => {
      const context = createMockContext({
        authenticated: true,
        userId: 'test-user-id',
        method: 'PATCH',
        params: { deckId: '00000000-0000-0000-0000-000000000000' },
        body: { name: 'New Name' },
        mockDbData: { updatedDeck: null }
      });
      
      const response = await PATCH(context);
      expect(response.status).toBe(404);
    });

    it('should return 404 for deck owned by another user', async () => {
      const context = createMockContext({
        authenticated: true,
        userId: 'user-A',
        method: 'PATCH',
        params: { deckId: 'deck-owned-by-user-B' },
        body: { name: 'New Name' },
        mockDbData: { updatedDeck: null } // RLS blocks
      });
      
      const response = await PATCH(context);
      expect(response.status).toBe(404);
      expect(response.status).not.toBe(403); // Security through obscurity
    });
  });
});
```

**Testy dla DeckService.updateDeck():**

```typescript
describe('DeckService.updateDeck', () => {
  it('should update deck with new name', async () => {
    const mockSupabase = createMockSupabaseClient({
      updateResponse: {
        data: {
          id: 'deck-123',
          user_id: 'user-123',
          name: 'Updated Name',
          created_by_ai: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
        error: null,
      },
    });

    const service = new DeckService(mockSupabase);
    const result = await service.updateDeck('user-123', 'deck-123', {
      name: 'Updated Name'
    });

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Updated Name');
    expect(result?.updatedAt).toBe('2024-01-02T00:00:00Z');
  });

  it('should return null if deck not found', async () => {
    const mockSupabase = createMockSupabaseClient({
      updateResponse: {
        data: null,
        error: null,
      },
    });

    const service = new DeckService(mockSupabase);
    const result = await service.updateDeck('user-123', 'non-existent', {
      name: 'New Name'
    });

    expect(result).toBeNull();
  });

  it('should throw error if database update fails', async () => {
    const mockSupabase = createMockSupabaseClient({
      updateResponse: {
        data: null,
        error: { message: 'Database error' },
      },
    });

    const service = new DeckService(mockSupabase);
    
    await expect(
      service.updateDeck('user-123', 'deck-123', { name: 'Name' })
    ).rejects.toThrow('Failed to update deck');
  });
});
```

---

## 10. Checklist końcowy

### Przed rozpoczęciem implementacji
- [ ] Przeczytać cały plan
- [ ] Zrozumieć PATCH semantics (partial update)
- [ ] Zrozumieć .refine() validation (empty body check)
- [ ] Przygotować test data

### Podczas implementacji
- [ ] Rozszerzyć DeckService o updateDeck() (Etap 1)
- [ ] Zaimplementować UpdateDeckSchema (Etap 2)
- [ ] Zaimplementować PATCH handler (Etap 3)
- [ ] Przeprowadzić testy manualne (Etap 4)
- [ ] Napisać testy automatyczne (Etap 5)

### Po implementacji
- [ ] Wszystkie testy przechodzą
- [ ] Empty body zwraca 400
- [ ] Extra fields są ignorowane
- [ ] updatedAt jest automatycznie aktualizowane
- [ ] Consistent 404 dla not owner
- [ ] Idempotency działa

### Production readiness
- [ ] RLS UPDATE policy aktywna
- [ ] updated_at trigger działa
- [ ] Monitoring update frequency
- [ ] Error logging OK

---

**Koniec planu implementacji**

Ten dokument stanowi kompletny przewodnik do implementacji endpointu PATCH /api/v1/decks/{deckId}. Szczególną uwagę zwrócono na partial update semantics i empty body validation.

