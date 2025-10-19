# API Endpoint Implementation Plan: POST /api/v1/decks

## 1. Przegląd punktu końcowego

### Cel
Endpoint tworzy nową talię fiszek (deck) dla zalogowanego użytkownika.

### Funkcjonalność
- Uwierzytelnienie użytkownika poprzez Supabase JWT
- Walidacja nazwy talii (niepusta, max 255 znaków)
- Utworzenie nowej talii w bazie danych z automatycznym przypisaniem user_id
- Opcjonalne oznaczenie talii jako utworzonej przez AI
- Automatyczne ustawienie timestamps (created_at, updated_at)
- Zwrócenie pełnych danych utworzonej talii

---

## 2. Szczegóły żądania

### Metoda HTTP
`POST`

### Struktura URL
```
/api/v1/decks
```

### Parametry

#### Wymagane parametry
- **Uwierzytelnienie**: Token JWT w header `Authorization: Bearer <token>` (wymagane)

#### Request Body (JSON)

| Pole | Typ | Wymagane | Walidacja | Opis |
|------|-----|----------|-----------|------|
| `name` | string | **TAK** | non-empty (po trim), length ≤ 255 | Nazwa talii fiszek |
| `createdByAi` | boolean | NIE | boolean | Czy talia została utworzona przez AI (default: false) |

#### Przykłady żądań

**Podstawowe żądanie (minimalne):**
```http
POST /api/v1/decks
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "name": "Geografia świata"
}
```

**Żądanie z wszystkimi polami:**
```http
POST /api/v1/decks
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "name": "Matematyka - równania kwadratowe",
  "createdByAi": false
}
```

**Żądanie dla AI-generated deck:**
```http
POST /api/v1/decks
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "name": "Historia Polski - wygenerowane z notatek",
  "createdByAi": true
}
```

### Request Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## 3. Wykorzystywane typy

### Command Models

#### CreateDeckCommand
```typescript
// src/types.ts (już zdefiniowany)
export interface CreateDeckCommand {
  name: string;
  createdByAi?: boolean;
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

#### DbDeck
```typescript
// src/types.ts (już zdefiniowany)
export type DbDeck = Tables<'decks'>;
// Struktura z bazy (snake_case):
// {
//   id: string;
//   user_id: string;
//   name: string;
//   created_by_ai: boolean;
//   created_at: string;
//   updated_at: string;
// }
```

---

## 4. Szczegóły odpowiedzi

### Sukces (201 Created)

#### Struktura odpowiedzi
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Geografia świata",
  "createdByAi": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Uwagi:**
- Status: `201 Created`
- Header `Location` może opcjonalnie zawierać URL do nowo utworzonej talii: `/api/v1/decks/{deckId}`
- `id` jest generowane przez bazę danych (UUID)
- `createdAt` i `updatedAt` są automatycznie ustawiane przez bazę
- `createdByAi` domyślnie `false` jeśli nie podano

### Błąd walidacji (400 Bad Request)

**Scenariusz 1: Brak wymaganego pola `name`**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "errors": [
      {
        "field": "name",
        "message": "Required"
      }
    ]
  }
}
```

**Scenariusz 2: Nazwa pusta lub tylko whitespace**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "errors": [
      {
        "field": "name",
        "message": "String must contain at least 1 character(s)"
      }
    ]
  }
}
```

**Scenariusz 3: Nazwa za długa (> 255 znaków)**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "errors": [
      {
        "field": "name",
        "message": "String must contain at most 255 character(s)"
      }
    ]
  }
}
```

**Scenariusz 4: Nieprawidłowy typ dla `createdByAi`**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "errors": [
      {
        "field": "createdByAi",
        "message": "Expected boolean, received string"
      }
    ]
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

### Błąd przetwarzania encji (422 Unprocessable Entity)

**Scenariusz: Business logic violation (rzadkie)**
```json
{
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Cannot process the request",
    "details": "Deck name contains invalid characters"
  }
}
```

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
Client Request (POST + JSON body)
    ↓
[1] Astro API Route Handler (src/pages/api/v1/decks/index.ts)
    ↓
[2] Parse request body (await request.json())
    ↓
[3] Walidacja body (Zod schema)
    ├─ Błąd → 400 Bad Request
    └─ OK → CreateDeckCommand
    ↓
[4] Uwierzytelnienie (context.locals.supabase.auth.getUser())
    ├─ Błąd/Brak → 401 Unauthorized
    └─ OK → userId
    ↓
[5] DeckService.createDeck(userId, command)
    ↓
[6] Supabase INSERT (z RLS)
    INSERT INTO decks (user_id, name, created_by_ai)
    VALUES ($userId, $name, $createdByAi)
    RETURNING *
    ↓
[7] Database zwraca nowy wiersz (DbDeck)
    ↓
[8] Mapowanie DbDeck → DeckDTO (snake_case → camelCase)
    ↓
[9] Return 201 Created + DeckDTO + Location header
    ↓
Client receives DeckDTO
```

### SQL Query

#### Insert query
```sql
INSERT INTO decks (user_id, name, created_by_ai)
VALUES ($1, $2, $3)
RETURNING id, user_id, name, created_by_ai, created_at, updated_at;
```

**Parametry:**
- `$1` - userId (z auth.uid())
- `$2` - name (po walidacji)
- `$3` - createdByAi (default false jeśli nie podano)

**Co dzieje się automatycznie:**
- `id` - generowane przez `gen_random_uuid()`
- `created_at` - ustawiane przez `DEFAULT NOW()`
- `updated_at` - ustawiane przez `DEFAULT NOW()`

**Indeksy aktualizowane:**
- `idx_decks_user_id` - B-tree index (minimal overhead)

### Row Level Security (RLS)

Supabase automatycznie egzekwuje RLS policy dla INSERT:
```sql
-- Policy dla INSERT
CREATE POLICY "Users can insert own decks" ON decks
FOR INSERT WITH CHECK (user_id = auth.uid());
```

**Jak to działa:**
- INSERT musi zawierać `user_id` równe `auth.uid()` z tokenu JWT
- Jeśli próbujemy wstawić z innym `user_id`, query zostanie zablokowane
- Używamy `context.locals.supabase` (user-scoped), więc RLS jest automatyczny

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
- **Automatyczna ochrona**: RLS zapewnia, że talia jest tworzona z prawidłowym user_id
- **Policy**: `WITH CHECK (user_id = auth.uid())`
- **Enforcement**: Przez user-scoped Supabase client (`context.locals.supabase`)

#### Ważne zasady
- ✅ **ZAWSZE** używaj `context.locals.supabase` (NIE globalnego klienta)
- ✅ RLS automatycznie weryfikuje że user_id = auth.uid()
- ✅ Nie można utworzyć talii dla innego użytkownika
- ✅ user_id jest ustawiany w DeckService, nie przyjmowany z request body

### 3. Walidacja danych wejściowych

#### Ochrona przed atakami
- **SQL Injection**: Supabase używa prepared statements (bezpieczne)
- **XSS**: Name jest stored as-is, sanityzacja po stronie frontend przy renderowaniu
- **Buffer overflow**: Max 255 chars dla name zapobiega DoS
- **Type coercion attacks**: Zod validation z strict typami

#### Schema walidacyjne
```typescript
const CreateDeckSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Deck name is required')
    .max(255, 'Deck name must not exceed 255 characters'),
  
  createdByAi: z.boolean()
    .optional()
    .default(false),
});
```

**Walidacja krok po kroku:**
1. `z.string()` - musi być string
2. `.trim()` - usuwa whitespace z początku i końca
3. `.min(1)` - po trim musi mieć co najmniej 1 znak
4. `.max(255)` - max 255 znaków (zgodnie z VARCHAR(255) w DB)
5. `createdByAi` - opcjonalne, domyślnie false

### 4. Rate Limiting

#### Specyfikacja
- Globalny limit: 100 req/min per IP i per user
- Dla tworzenia talii: standardowy limit

#### Implementacja (opcjonalna dla MVP)
- Middleware w `src/middleware/index.ts`
- Zwrócenie 429 Too Many Requests przy przekroczeniu
- Rozważyć niższy limit dla CREATE operations (np. 20 req/min)

### 5. Business Logic Validation

#### Dodatkowe sprawdzenia (opcjonalne)
```typescript
// Sprawdzenie czy użytkownik nie ma już talii o tej nazwie
const existingDeck = await supabase
  .from('decks')
  .select('id')
  .eq('user_id', userId)
  .eq('name', command.name)
  .maybeSingle();

if (existingDeck.data) {
  // Zwróć 409 Conflict lub pozwól na duplikaty
  // Dla MVP: pozwalamy na duplikaty
}
```

**Dla MVP: Nie blokujemy duplikatów nazw** - użytkownik może mieć wiele talii o tej samej nazwie.

### 6. Input Sanitization

#### Co NIE robimy
- ❌ HTML escaping w API (to odpowiedzialność frontend)
- ❌ Usuwanie "niebezpiecznych" znaków (może być część nazwy)

#### Co robimy
- ✅ Trim whitespace
- ✅ Sprawdzenie długości
- ✅ Type validation

**Zasada**: API przechowuje dane "as-is", frontend jest odpowiedzialny za safe rendering.

### 7. Logging i Monitoring

#### Co logować (server-side only)
- Udane utworzenie talii (user_id, deck_id, timestamp)
- Błędy walidacji (IP, user_id jeśli dostępne)
- Błędy bazy danych (pełny stack trace)
- Próby bez autoryzacji

#### Czego NIE logować
- Tokenów JWT
- Pełnej zawartości request body (może zawierać wrażliwe dane w przyszłości)

---

## 7. Obsługa błędów

### Strategia obsługi błędów

#### Zasady
1. **Early returns** - sprawdzaj błędy na początku
2. **Guard clauses** - walidacja przed główną logiką
3. **Specific error codes** - używaj ErrorCode enum
4. **User-friendly messages** - zrozumiałe komunikaty
5. **Server-side logging** - pełne szczegóły tylko w logach

### Katalog błędów

#### 1. 400 Bad Request - Błędy walidacji

**Scenariusz 1: Brak wymaganego pola**
```typescript
// Request body: {}
// lub
// Request body: { "createdByAi": true }

Response: {
  error: {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Invalid request body',
    errors: [
      { field: 'name', message: 'Required' }
    ]
  }
}
```

**Scenariusz 2: Pusty string lub whitespace**
```typescript
// Request body: { "name": "" }
// lub
// Request body: { "name": "   " }

Response: {
  error: {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Invalid request body',
    errors: [
      { field: 'name', message: 'String must contain at least 1 character(s)' }
    ]
  }
}
```

**Scenariusz 3: Nazwa za długa**
```typescript
// Request body: { "name": "A".repeat(256) }

Response: {
  error: {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Invalid request body',
    errors: [
      { field: 'name', message: 'String must contain at most 255 character(s)' }
    ]
  }
}
```

**Scenariusz 4: Nieprawidłowy typ**
```typescript
// Request body: { "name": 123 }
// lub
// Request body: { "name": "Test", "createdByAi": "yes" }

Response: {
  error: {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Invalid request body',
    errors: [
      { field: 'name', message: 'Expected string, received number' },
      { field: 'createdByAi', message: 'Expected boolean, received string' }
    ]
  }
}
```

**Scenariusz 5: Nieprawidłowy JSON**
```typescript
// Request body: { invalid json }

Response: {
  error: {
    code: ErrorCode.BAD_REQUEST,
    message: 'Invalid JSON in request body'
  }
}
```

**Implementacja:**
```typescript
// Parse JSON
let body;
try {
  body = await context.request.json();
} catch (error) {
  return new Response(JSON.stringify({
    error: {
      code: ErrorCode.BAD_REQUEST,
      message: 'Invalid JSON in request body'
    }
  }), {
    status: HttpStatus.BAD_REQUEST,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Validate with Zod
const validationResult = CreateDeckSchema.safeParse(body);

if (!validationResult.success) {
  const errors = validationResult.error.errors.map(err => ({
    field: err.path.join('.') || 'unknown',
    message: err.message,
  }));
  
  return new Response(JSON.stringify({
    error: {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid request body',
      errors
    }
  }), {
    status: HttpStatus.BAD_REQUEST,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

#### 2. 401 Unauthorized - Brak autoryzacji

**Scenariusze:**
- Brak tokenu JWT w header Authorization
- Token nieprawidłowy lub zmanipulowany
- Token wygasł
- Token został unieważniony (logout)

**Response:**
```typescript
{
  error: {
    code: ErrorCode.UNAUTHORIZED,
    message: 'Authentication required'
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

#### 3. 422 Unprocessable Entity - Business logic errors

**Scenariusze (opcjonalne dla MVP):**
- Użytkownik osiągnął limit talii (jeśli wprowadzony)
- Nazwa zawiera zabronione słowa (jeśli wprowadzony filtr)
- Soft-deleted user próbuje utworzyć talię

**Response:**
```typescript
{
  error: {
    code: ErrorCode.UNPROCESSABLE_ENTITY,
    message: 'Cannot create deck',
    details: 'User has reached maximum deck limit'
  }
}
```

**Dla MVP: Zazwyczaj nie używane** - proste tworzenie bez złożonych business rules.

#### 4. 500 Internal Server Error - Błędy serwera

**Scenariusze:**
- Błąd połączenia z bazą danych
- Database constraint violation (nieoczekiwany)
- Timeout bazy danych
- Błąd w logice serwisu
- RLS policy violation (nie powinno się zdarzyć)

**Response:**
```typescript
{
  error: {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    message: 'An unexpected error occurred'
  }
}
```

**Implementacja:**
```typescript
try {
  const deck = await deckService.createDeck(user.id, command);
  
  return new Response(JSON.stringify(deck), {
    status: HttpStatus.CREATED,
    headers: { 
      'Content-Type': 'application/json',
      'Location': `/api/v1/decks/${deck.id}`
    }
  });
} catch (error) {
  // Log full error server-side
  console.error('Error creating deck:', error);
  
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
async createDeck(userId: string, command: CreateDeckCommand): Promise<DeckDTO> {
  const { data, error } = await this.supabase
    .from('decks')
    .insert({
      user_id: userId,
      name: command.name,
      created_by_ai: command.createdByAi ?? false,
    })
    .select()
    .single();
    
  if (error) {
    console.error('Database error in createDeck:', error);
    throw new Error(`Failed to create deck: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('No data returned from database');
  }
  
  return mapDeckToDTO(data);
}
```

### Error Response Helper

```typescript
// Reuse from GET endpoint or create shared utility
// src/lib/utils/api-error.ts
export function createErrorResponse(
  status: HttpStatus,
  code: ErrorCode,
  message: string,
  details?: string | ValidationError[]
): Response {
  const body = Array.isArray(details)
    ? { error: { code, message, errors: details } }
    : { error: { code, message, details } };
    
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

## 8. Rozważania dotyczące wydajności

### 1. Operacja INSERT

#### Charakterystyka
- **Bardzo szybka**: Pojedynczy INSERT to prosta operacja
- **Atomic**: Automatycznie w transakcji
- **Index update**: idx_decks_user_id jest aktualizowany (minimal overhead)

#### Typowy czas odpowiedzi
- < 50ms dla lokalnej bazy
- < 200ms dla zdalnej bazy (Supabase hosted)

### 2. RETURNING clause

#### Optymalizacja
```sql
INSERT INTO decks (user_id, name, created_by_ai)
VALUES ($1, $2, $3)
RETURNING *;
```

**Korzyści:**
- Pojedyncze query (INSERT + SELECT w jednym)
- Nie trzeba wykonywać dodatkowego SELECT po INSERT
- Otrzymujemy wszystkie pola włącznie z generated id i timestamps

**Alternatywa (wolniejsza):**
```sql
-- Dwa queries zamiast jednego
INSERT INTO decks (...) VALUES (...); -- 1
SELECT * FROM decks WHERE id = $last_inserted_id; -- 2
```

### 3. UUID generation

#### PostgreSQL gen_random_uuid()
- Generowane po stronie bazy danych
- Bardzo szybkie (< 1ms)
- Bezpieczne kryptograficznie
- Brak kolizji (praktycznie)

### 4. Concurrent INSERTs

#### Scenariusz
Wielu użytkowników tworzy talie jednocześnie.

#### Zachowanie
- ✅ Każdy INSERT jest niezależny
- ✅ Brak lock contention (różni użytkownicy)
- ✅ Index updates są szybkie (B-tree)
- ✅ Skaluje się liniowo

**Brak problemów z wydajnością dla MVP.**

### 5. Database connection pooling

#### Supabase
- Automatycznie zarządzane przez Supabase
- Connection pooling włączony domyślnie (PgBouncer)
- Dla MVP: brak dodatkowej konfiguracji

### 6. Monitoring

#### Metryki do śledzenia
- **Latency**: Czas odpowiedzi endpoint (target < 200ms)
- **Success rate**: % requests 201 vs 400/500
- **Database INSERT time**: Czas wykonania INSERT query
- **Error rate**: % błędów 500

#### Narzędzia
- Supabase Dashboard (built-in metrics)
- Application logs
- APM (np. Sentry) - opcjonalnie

---

## 9. Etapy wdrożenia

### Etap 1: Rozszerzenie DeckService o metodę createDeck()

**Plik:** `src/lib/services/deck.service.ts`

**Kod do dodania:**

```typescript
/**
 * Create a new deck for a user
 */
async createDeck(userId: string, command: CreateDeckCommand): Promise<DeckDTO> {
  // Prepare data for insert (snake_case for DB)
  const insertData = {
    user_id: userId,
    name: command.name,
    created_by_ai: command.createdByAi ?? false,
  };

  // Execute INSERT with RETURNING
  const { data, error } = await this.supabase
    .from('decks')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Database error in createDeck:', error);
    throw new Error(`Failed to create deck: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from database after insert');
  }

  // Map to DTO
  return mapDeckToDTO(data);
}
```

**Import do dodania:**
```typescript
import type { CreateDeckCommand } from '../../../types';
```

**Uwagi:**
- Używamy `??` operator dla default value `createdByAi`
- `.single()` zwraca pojedynczy obiekt zamiast array
- Error handling z logowaniem
- Mapowanie przez istniejącą funkcję `mapDeckToDTO()`

---

### Etap 2: Implementacja Zod validation schema

**Plik:** `src/pages/api/v1/decks/index.ts`

**Kod do dodania:**

```typescript
import { z } from 'zod';

/**
 * Validation schema for POST /api/v1/decks request body
 */
const CreateDeckSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Deck name is required')
    .max(255, 'Deck name must not exceed 255 characters'),
  
  createdByAi: z.boolean()
    .optional()
    .default(false),
});

export type CreateDeckBody = z.infer<typeof CreateDeckSchema>;
```

**Uwagi:**
- Schema jest co-located z route handler
- `.trim()` jest kluczowy - usuwa whitespace przed walidacją min length
- Messages są user-friendly
- `CreateDeckBody` type dla type-safety

---

### Etap 3: Implementacja POST handler w API route

**Plik:** `src/pages/api/v1/decks/index.ts`

**Kod do dodania (obok istniejącego GET handler):**

```typescript
/**
 * POST /api/v1/decks
 * Create a new deck for authenticated user
 */
export async function POST(context: APIContext): Promise<Response> {
  try {
    // Step 1: Parse request body
    let body;
    try {
      body = await context.request.json();
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: {
          code: ErrorCode.BAD_REQUEST,
          message: 'Invalid JSON in request body',
        },
      };
      
      return new Response(JSON.stringify(errorResponse), {
        status: HttpStatus.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Step 2: Validate request body
    const validationResult = CreateDeckSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.') || 'unknown',
        message: err.message,
      }));
      
      const errorResponse: ValidationErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          errors,
        },
      };
      
      return new Response(JSON.stringify(errorResponse), {
        status: HttpStatus.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const command = validationResult.data;
    
    // Step 3: Authenticate user
    const { data: { user }, error: authError } = await context.locals.supabase.auth.getUser();
    
    if (authError || !user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Authentication required',
        },
      };
      
      return new Response(JSON.stringify(errorResponse), {
        status: HttpStatus.UNAUTHORIZED,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Step 4: Create deck using DeckService
    const deckService = new DeckService(context.locals.supabase);
    const deck = await deckService.createDeck(user.id, command);
    
    // Step 5: Return success response with Location header
    return new Response(JSON.stringify(deck), {
      status: HttpStatus.CREATED,
      headers: { 
        'Content-Type': 'application/json',
        'Location': `/api/v1/decks/${deck.id}`
      }
    });
    
  } catch (error) {
    // Step 6: Handle unexpected errors
    console.error('Error in POST /api/v1/decks:', error);
    
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
      },
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

**Imports potrzebne:**
```typescript
import type { CreateDeckCommand } from '../../../types';
```

**Uwagi implementacyjne:**
- Handler zwraca `201 Created` (nie `200 OK`)
- Header `Location` wskazuje na nowo utworzony zasób
- Separate try-catch dla JSON parsing (lepsze error messages)
- Używamy validated `command` (nie raw `body`)

---

### Etap 4: Testowanie manualne

**Przygotowanie:**
1. Upewnić się że serwer działa (`npm run dev`)
2. Mieć JWT token dla test user
3. Przygotować test cases

**Test cases:**

**1. Basic create (minimalne dane):**
```bash
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Geografia Polski"}'

# Expected: 201 Created
# Response body: DeckDTO z id, name="Geografia Polski", createdByAi=false
# Response header: Location: /api/v1/decks/{id}
```

**2. Create with all fields:**
```bash
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Historia - AI generated",
    "createdByAi": true
  }'

# Expected: 201 Created
# Response: createdByAi=true
```

**3. Validation error - missing name:**
```bash
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"createdByAi": false}'

# Expected: 400 Bad Request
# Response: VALIDATION_ERROR, field="name", message="Required"
```

**4. Validation error - empty name:**
```bash
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":""}'

# Expected: 400 Bad Request
# Response: VALIDATION_ERROR, "at least 1 character"
```

**5. Validation error - whitespace only:**
```bash
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"   "}'

# Expected: 400 Bad Request (trimmed to empty string)
```

**6. Validation error - too long name:**
```bash
# Generate 256 character string
LONG_NAME=$(printf 'A%.0s' {1..256})

curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$LONG_NAME\"}"

# Expected: 400 Bad Request
# Response: "at most 255 characters"
```

**7. Validation error - invalid type:**
```bash
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": 123}'

# Expected: 400 Bad Request
# Response: "Expected string, received number"
```

**8. Invalid JSON:**
```bash
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{invalid json}'

# Expected: 400 Bad Request
# Response: "Invalid JSON in request body"
```

**9. No authentication:**
```bash
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'

# Expected: 401 Unauthorized
```

**10. Invalid token:**
```bash
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'

# Expected: 401 Unauthorized
```

**11. Name with special characters (should work):**
```bash
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Математика & Physics (2024) - żółć!"}'

# Expected: 201 Created
# Special characters powinny być zachowane
```

**12. Unicode name (should work):**
```bash
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"日本語 한국어 العربية"}'

# Expected: 201 Created
# Unicode powinien być prawidłowo przechowany
```

**13. Duplicate names (should work):**
```bash
# Create first deck
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Deck"}'

# Create second deck with same name
curl -X POST "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Deck"}'

# Expected: Both should return 201 Created with different IDs
# Duplikaty nazw są dozwolone
```

---

### Etap 5: Testy automatyczne

**Test file:** `src/pages/api/v1/decks/index.test.ts`

**Testy dla POST endpoint:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './index';
import { createMockContext } from '../../../../../test/utils';

describe('POST /api/v1/decks', () => {
  describe('Authentication', () => {
    it('should return 401 if not authenticated', async () => {
      const context = createMockContext({ 
        authenticated: false,
        method: 'POST',
        body: { name: 'Test Deck' }
      });
      
      const response = await POST(context);
      
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Validation', () => {
    it('should return 400 if name is missing', async () => {
      const context = createMockContext({ 
        authenticated: true,
        method: 'POST',
        body: { createdByAi: false }
      });
      
      const response = await POST(context);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.errors[0].field).toBe('name');
    });

    it('should return 400 if name is empty string', async () => {
      const context = createMockContext({ 
        authenticated: true,
        method: 'POST',
        body: { name: '' }
      });
      
      const response = await POST(context);
      expect(response.status).toBe(400);
    });

    it('should return 400 if name is only whitespace', async () => {
      const context = createMockContext({ 
        authenticated: true,
        method: 'POST',
        body: { name: '   ' }
      });
      
      const response = await POST(context);
      expect(response.status).toBe(400);
    });

    it('should return 400 if name exceeds 255 characters', async () => {
      const context = createMockContext({ 
        authenticated: true,
        method: 'POST',
        body: { name: 'A'.repeat(256) }
      });
      
      const response = await POST(context);
      expect(response.status).toBe(400);
    });

    it('should return 400 if name is not a string', async () => {
      const context = createMockContext({ 
        authenticated: true,
        method: 'POST',
        body: { name: 123 }
      });
      
      const response = await POST(context);
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid JSON', async () => {
      const context = createMockContext({ 
        authenticated: true,
        method: 'POST',
        body: 'invalid json',
        rawBody: true
      });
      
      const response = await POST(context);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.message).toContain('Invalid JSON');
    });
  });

  describe('Success cases', () => {
    it('should create deck with minimum data', async () => {
      const context = createMockContext({ 
        authenticated: true,
        userId: 'test-user-id',
        method: 'POST',
        body: { name: 'Test Deck' }
      });
      
      const response = await POST(context);
      
      expect(response.status).toBe(201);
      expect(response.headers.get('Location')).toMatch(/\/api\/v1\/decks\/.+/);
      
      const body = await response.json();
      expect(body).toHaveProperty('id');
      expect(body.name).toBe('Test Deck');
      expect(body.createdByAi).toBe(false);
      expect(body).toHaveProperty('createdAt');
      expect(body).toHaveProperty('updatedAt');
    });

    it('should create deck with all fields', async () => {
      const context = createMockContext({ 
        authenticated: true,
        userId: 'test-user-id',
        method: 'POST',
        body: { 
          name: 'AI Deck',
          createdByAi: true
        }
      });
      
      const response = await POST(context);
      
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.name).toBe('AI Deck');
      expect(body.createdByAi).toBe(true);
    });

    it('should trim whitespace from name', async () => {
      const context = createMockContext({ 
        authenticated: true,
        userId: 'test-user-id',
        method: 'POST',
        body: { name: '  Trimmed Deck  ' }
      });
      
      const response = await POST(context);
      
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.name).toBe('Trimmed Deck');
    });

    it('should allow special characters in name', async () => {
      const context = createMockContext({ 
        authenticated: true,
        userId: 'test-user-id',
        method: 'POST',
        body: { name: 'Math & Physics (2024) - żółć!' }
      });
      
      const response = await POST(context);
      
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.name).toBe('Math & Physics (2024) - żółć!');
    });

    it('should allow duplicate deck names', async () => {
      const context1 = createMockContext({ 
        authenticated: true,
        userId: 'test-user-id',
        method: 'POST',
        body: { name: 'Duplicate' }
      });
      
      const response1 = await POST(context1);
      expect(response1.status).toBe(201);
      
      const context2 = createMockContext({ 
        authenticated: true,
        userId: 'test-user-id',
        method: 'POST',
        body: { name: 'Duplicate' }
      });
      
      const response2 = await POST(context2);
      expect(response2.status).toBe(201);
      
      const body1 = await response1.json();
      const body2 = await response2.json();
      expect(body1.id).not.toBe(body2.id);
    });
  });
});
```

**Testy dla DeckService.createDeck():**

```typescript
// src/lib/services/deck.service.test.ts
describe('DeckService.createDeck', () => {
  it('should create deck with correct data', async () => {
    const mockSupabase = createMockSupabaseClient({
      insertResponse: {
        data: {
          id: 'new-id',
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
    const result = await service.createDeck('user-123', {
      name: 'Test Deck',
    });

    expect(result.id).toBe('new-id');
    expect(result.name).toBe('Test Deck');
    expect(result.createdByAi).toBe(false);
  });

  it('should use default createdByAi=false if not provided', async () => {
    // ... test implementation
  });

  it('should throw error if database insert fails', async () => {
    const mockSupabase = createMockSupabaseClient({
      insertResponse: {
        data: null,
        error: { message: 'Database error' },
      },
    });

    const service = new DeckService(mockSupabase);
    
    await expect(
      service.createDeck('user-123', { name: 'Test' })
    ).rejects.toThrow('Failed to create deck');
  });
});
```

---

### Etap 6: Integracja z istniejącym GET endpoint

**Plik:** `src/pages/api/v1/decks/index.ts`

**Struktura finalna:**
```typescript
export const prerender = false;

import type { APIContext } from 'astro';
import { z } from 'zod';
import { DeckService } from '../../../../lib/services/deck.service';
import { 
  HttpStatus, 
  ErrorCode,
  // ... types
} from '../../../types';

// ============= GET ENDPOINT =============
const ListDecksQuerySchema = z.object({
  // ... (już zaimplementowane)
});

export async function GET(context: APIContext): Promise<Response> {
  // ... (już zaimplementowane)
}

// ============= POST ENDPOINT =============
const CreateDeckSchema = z.object({
  // ... (nowa implementacja)
});

export async function POST(context: APIContext): Promise<Response> {
  // ... (nowa implementacja)
}
```

**Uwagi:**
- Oba handlery w tym samym pliku
- Dzielą te same importy
- Każdy ma swoją własną validation schema
- Oba używają tego samego DeckService

---

### Etap 7: Dokumentacja i code review

**Checklist przed code review:**
- [ ] Kod kompiluje się bez błędów
- [ ] Wszystkie testy unit przechodzą
- [ ] Wszystkie testy integration przechodzą
- [ ] Linter nie zgłasza błędów
- [ ] Format kodu jest poprawny (prettier)
- [ ] JSDoc comments są aktualne
- [ ] Error handling jest kompletny
- [ ] Security checks są na miejscu (auth, validation, RLS)
- [ ] Logging jest odpowiedni
- [ ] Types są poprawne

**Dokumentacja:**
- [ ] Plan implementacji jest aktualny
- [ ] API examples są poprawne
- [ ] Edge cases są udokumentowane

---

### Etap 8: Deployment

**Pre-deployment checklist:**
- [ ] Testy na staging environment
- [ ] RLS policies są aktywne w production DB
- [ ] HTTPS jest wymuszone
- [ ] CORS jest poprawnie skonfigurowany
- [ ] Monitoring jest skonfigurowany
- [ ] Error logging działa

**Deployment steps:**
1. Merge do feature branch
2. Code review i approval
3. Merge do main/master
4. Deploy do staging
5. Smoke tests na staging
6. Deploy do production
7. Weryfikacja w production (create test deck)
8. Monitor logs przez 24h

**Smoke test na production:**
```bash
# Create test deck
curl -X POST "https://api.example.com/api/v1/decks" \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Production Test Deck"}'

# Verify created (GET list)
curl -X GET "https://api.example.com/api/v1/decks" \
  -H "Authorization: Bearer $PROD_TOKEN"

# Clean up - delete test deck
curl -X DELETE "https://api.example.com/api/v1/decks/$TEST_DECK_ID" \
  -H "Authorization: Bearer $PROD_TOKEN"
```

---

## 10. Checklist końcowy

### Przed rozpoczęciem implementacji
- [ ] Przeczytać cały plan
- [ ] Zrozumieć przepływ danych
- [ ] Zrozumieć security requirements
- [ ] Przygotować środowisko testowe

### Podczas implementacji
- [ ] Rozszerzyć DeckService o createDeck() (Etap 1)
- [ ] Zaimplementować Zod schema (Etap 2)
- [ ] Zaimplementować POST handler (Etap 3)
- [ ] Przeprowadzić testy manualne (Etap 4)
- [ ] Napisać testy automatyczne (Etap 5)
- [ ] Zintegrować z GET endpoint (Etap 6)

### Po implementacji
- [ ] Wszystkie testy przechodzą
- [ ] Code review przeprowadzony
- [ ] Dokumentacja aktualna
- [ ] Ready for deployment (Etap 7-8)

### Production readiness
- [ ] HTTPS skonfigurowane
- [ ] CORS skonfigurowany
- [ ] Rate limiting wdrożone (opcjonalne)
- [ ] Monitoring aktywny
- [ ] Error logging działa
- [ ] RLS policies aktywne

---

## Appendix A: Przykładowe SQL queries

### Insert query z RETURNING
```sql
INSERT INTO decks (user_id, name, created_by_ai)
VALUES (
  'auth-user-id-uuid',
  'Geografia świata',
  false
)
RETURNING 
  id,
  user_id,
  name,
  created_by_ai,
  created_at,
  updated_at;
```

### Weryfikacja RLS policy (dla testów)
```sql
-- Jako admin sprawdź czy policy istnieje
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'decks' AND cmd = 'INSERT';

-- Expected result:
-- policyname: "Users can insert own decks"
-- cmd: INSERT
-- with_check: (user_id = auth.uid())
```

---

## Appendix B: Supabase RLS Policy

```sql
-- Policy dla INSERT (musi być utworzona przed production)
CREATE POLICY "Users can insert own decks"
ON decks
FOR INSERT
WITH CHECK (user_id = auth.uid());
```

**Jak działa:**
- `WITH CHECK` sprawdza warunek PRZED wstawieniem wiersza
- `user_id` w INSERT musi równać się `auth.uid()` z JWT token
- Jeśli warunek nie jest spełniony, INSERT jest odrzucony z błędem permission denied

**Test policy:**
```sql
-- Set JWT context (simulate authenticated user)
SET request.jwt.claims TO '{"sub": "test-user-id"}';

-- This should work
INSERT INTO decks (user_id, name) VALUES ('test-user-id', 'Test');

-- This should fail
INSERT INTO decks (user_id, name) VALUES ('other-user-id', 'Test');
-- ERROR: new row violates row-level security policy
```

---

**Koniec planu implementacji**

Ten dokument stanowi kompletny przewodnik do implementacji endpointu POST /api/v1/decks. Wszystkie sekcje są szczegółowe i gotowe do użycia przez zespół programistów.

