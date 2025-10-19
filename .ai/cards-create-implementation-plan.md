# API Endpoint Implementation Plan: POST /api/v1/decks/{deckId}/cards

## 1. Przegląd punktu końcowego

Endpoint `POST /api/v1/decks/{deckId}/cards` umożliwia utworzenie nowej fiszki w określonej talii. Karta jest tworzona z domyślnymi wartościami algorytmu SM-2 (SuperMemo 2) i automatycznie przypisywana do talii użytkownika.

**Główne funkcjonalności:**
- Tworzenie nowej fiszki z pytaniem i odpowiedzią
- Automatyczne ustawienie domyślnych wartości SM-2
- Weryfikacja własności talii (użytkownik może dodawać karty tylko do swoich talii)
- Walidacja treści pytania i odpowiedzi
- Zwracanie pełnych danych utworzonej karty

**Kluczowe założenia:**
- Wymaga autentykacji (Bearer token Supabase)
- Weryfikuje własność talii przez `deck.user_id`
- Domyślne wartości SM-2: easeFactor=2.50, intervalDays=1, repetitions=0, nextReviewDate=now()
- Walidacja długości treści (max 10,000 znaków)
- Trimowanie i walidacja pustych wartości

## 2. Szczegóły żądania

### Metoda HTTP
`POST`

### Struktura URL
```
POST /api/v1/decks/{deckId}/cards
```

### Headers
```
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

### Parametry

#### Path Parameters:
- **deckId** (string, UUID, wymagany)
  - ID talii, do której dodajemy kartę
  - Walidacja: musi być prawidłowym UUID
  - Przykład: `550e8400-e29b-41d4-a716-446655440000`

#### Query Parameters:
Brak

### Request Body Schema

```typescript
{
  "question": string,  // WYMAGANE
  "answer": string     // WYMAGANE
}
```

### Parametry Request Body

#### Wymagane:
- **question** (string)
  - Treść pytania fiszki
  - Walidacja: trimmed, non-empty, długość 1-10,000 znaków
  - Przykład: "What is closure in JavaScript?"

- **answer** (string)
  - Treść odpowiedzi fiszki
  - Walidacja: trimmed, non-empty, długość 1-10,000 znaków
  - Przykład: "A closure is a function that has access to its own scope, the outer function's scope, and the global scope."

### Przykładowe żądanie

```http
POST /api/v1/decks/550e8400-e29b-41d4-a716-446655440000/cards
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "question": "What is closure in JavaScript?",
  "answer": "A closure is a function that has access to its own scope, the outer function's scope, and the global scope."
}
```

### Domyślne wartości SM-2

Po utworzeniu karty, automatycznie ustawiane są następujące wartości:
- **easeFactor**: 2.50 (domyślny współczynnik łatwości)
- **intervalDays**: 1 (następna powtórka za 1 dzień)
- **repetitions**: 0 (brak powtórzeń)
- **nextReviewDate**: now() (następna powtórka od razu)

## 3. Wykorzystywane typy

### Command Models

**CreateCardCommand** (Request) - już zdefiniowany w `src/types.ts`:
```typescript
export interface CreateCardCommand {
  question: string;
  answer: string;
}
```

### Response DTOs

**CardDTO** (Response) - już zdefiniowany w `src/types.ts`:
```typescript
export interface CardDTO {
  id: string;
  deckId: string;
  question: string;
  answer: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewDate: string; // ISO-8601
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}
```

### Error Response Types

**ValidationErrorResponse** - dla błędów 400:
```typescript
export interface ValidationErrorResponse {
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    errors: Array<{ field: string; message: string; }>;
  }
}
```

**ErrorResponse** - dla błędów 401, 403, 404, 422, 500:
```typescript
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
  }
}
```

### Internal Service Types

**CreateCardData** - używany wewnętrznie w CardService:
```typescript
interface CreateCardData {
  deck_id: string;
  question: string;
  answer: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
}
```

### Database Types
Wykorzystywane typy z `src/db/database.types.ts`:
- `DbCard` = `Tables<'cards'>`
- `DbDeck` = `Tables<'decks'>`

## 4. Szczegóły odpowiedzi

### Success Response (201 Created)

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "deckId": "550e8400-e29b-41d4-a716-446655440000",
  "question": "What is closure in JavaScript?",
  "answer": "A closure is a function that has access to its own scope, the outer function's scope, and the global scope.",
  "easeFactor": 2.50,
  "intervalDays": 1,
  "repetitions": 0,
  "nextReviewDate": "2025-10-15T10:30:00.000Z",
  "createdAt": "2025-10-15T10:30:00.000Z",
  "updatedAt": "2025-10-15T10:30:00.000Z"
}
```

### Error Responses

#### 400 Bad Request (Validation Error)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "errors": [
      {
        "field": "question",
        "message": "Question is required and must not be empty"
      },
      {
        "field": "answer",
        "message": "Answer must not exceed 10000 characters"
      }
    ]
  }
}
```

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 403 Forbidden
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied to this deck"
  }
}
```

#### 404 Not Found
```json
{
  "error": {
    "code": "DECK_NOT_FOUND",
    "message": "Deck not found"
  }
}
```

#### 422 Unprocessable Entity
```json
{
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Failed to create card",
    "details": "Database constraint violation"
  }
}
```

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to create card",
    "details": "Database connection error"
  }
}
```

## 5. Przepływ danych

### Architektura wysokiego poziomu

```
Client Request (POST /api/v1/decks/{deckId}/cards)
    ↓
API Route Handler (src/pages/api/v1/decks/[deckId]/cards.ts)
    ↓
[1] Authentication Check
    ↓
[2] Request Body Validation (Zod)
    ↓
[3] Deck Ownership Verification
    ↓
[4] Create Card in Database
    ↓
[5] Map Database Result to DTO
    ↓
[6] Return CardDTO (201 Created)
```

### Szczegółowy przepływ krok po kroku

#### KROK 1: Authentication Check
1. Middleware sprawdza `Authorization` header
2. Pobiera użytkownika przez `context.locals.supabase.auth.getUser()`
3. Jeśli brak/invalid token → **401 Unauthorized**

#### KROK 2: Request Body Validation
1. Parser `request.json()` do `CreateCardCommand`
2. Zod schema waliduje:
   ```typescript
   const schema = z.object({
     question: z.string().trim().min(1).max(10000),
     answer: z.string().trim().min(1).max(10000)
   });
   ```
3. Jeśli walidacja niepowodzenie → **400 Bad Request** z field-level errors

#### KROK 3: Deck Ownership Verification
1. Wykonaj query: `SELECT id FROM decks WHERE id = $1 AND user_id = $2`
2. Jeśli deck nie istnieje → **404 Not Found**
3. Jeśli deck nie należy do użytkownika → **403 Forbidden**

#### KROK 4: Create Card in Database
```sql
INSERT INTO cards (
  deck_id, question, answer, 
  ease_factor, interval_days, repetitions, next_review_date,
  created_at, updated_at
) VALUES (
  $1, $2, $3,
  2.50, 1, 0, NOW(),
  NOW(), NOW()
) RETURNING *;
```

#### KROK 5: Map to DTO
1. Konwertuj `DbCard` → `CardDTO` (snake_case → camelCase)
2. Zwróć response z statusem 201 Created

#### KROK 6: Return Response
```typescript
return new Response(
  JSON.stringify(cardDTO),
  {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  }
);
```

## 6. Względy bezpieczeństwa

### 6.1 Autentykacja
- **Wymagania**: Bearer token (Supabase JWT) w `Authorization` header
- **Weryfikacja**: Middleware wywołuje `context.locals.supabase.auth.getUser()`
- **Token validation**: Automatyczna przez Supabase SDK

### 6.2 Autoryzacja
- **Deck ownership**: Sprawdzenie `decks.user_id = auth.uid()`
- **RLS policies**: 
  - `decks`: `SELECT` policy wymaga `user_id = auth.uid()`
  - `cards`: `INSERT` policy wymaga `deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid())`
- **Enforcement**: Podwójna ochrona - aplikacja + RLS

### 6.3 Input Validation & Sanitization
- **Zod schema walidacja**: Wszystkie pola walidowane przed przetwarzaniem
- **trim()** dla stringów usuwa whitespace
- **Length limits** zapobiegają DoS attacks
- **Type coercion** wyłączona (strict mode)

### 6.4 Data Privacy
- **No cross-user data**: Użytkownik może tworzyć karty tylko w swoich taliach
- **No sensitive fields**: Brak user_id w response
- **Audit trail**: Logowanie tworzenia kart

## 7. Obsługa błędów

### 7.1 Scenariusze błędów i kody statusu

#### 400 Bad Request - Validation Errors
**Przypadki:**
1. `question` pusty lub za długi (>10,000 chars)
2. `answer` pusty lub za długi (>10,000 chars)
3. Malformed JSON w request body
4. Missing required fields

**Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "errors": [
      {
        "field": "question",
        "message": "Question is required and must not be empty"
      }
    ]
  }
}
```

#### 401 Unauthorized - Authentication Failure
**Przypadki:**
1. Brak `Authorization` header
2. Invalid/expired JWT token
3. Token signature verification failed

**Response:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 403 Forbidden - Access Denied
**Przypadki:**
1. Deck istnieje, ale nie należy do użytkownika
2. Deck jest soft-deleted przez właściciela

**Response:**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied to this deck"
  }
}
```

#### 404 Not Found - Deck Not Found
**Przypadki:**
1. Deck z podanym ID nie istnieje
2. Invalid UUID format w deckId

**Response:**
```json
{
  "error": {
    "code": "DECK_NOT_FOUND",
    "message": "Deck not found"
  }
}
```

#### 422 Unprocessable Entity - Business Logic Errors
**Przypadki:**
1. Database constraint violation
2. Foreign key constraint failure
3. Unique constraint violation

**Response:**
```json
{
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Failed to create card",
    "details": "Database constraint violation"
  }
}
```

#### 500 Internal Server Error - System Failures
**Przypadki:**
1. Database connection error
2. Query timeout
3. Unhandled exception

**Response:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to create card",
    "details": "Database connection error"
  }
}
```

### 7.2 Error Logging Strategy
- **Log all errors** do application logger
- **Include context**: deckId, userId, card data
- **No sensitive data** w logach
- **Monitor error rates** dla alerting

## 8. Rozważania dotyczące wydajności

### 8.1 Wąskie gardła

1. **Database Insert** ⚠️ GŁÓWNE WĄSKIE GARDŁO
   - Czas: 20-100ms dla typowych inserts
   - Throughput: Ograniczony przez Supabase connection pool
   - Koszt: Minimalny (single INSERT)

2. **Request Body Parsing**
   - JSON parsing: 1-5ms dla typowych payloads
   - Zod validation: 1-2ms

3. **Response Serialization**
   - JSON serialization: 1-2ms

### 8.2 Optymalizacje

#### 8.2.1 Database Optimization
**Indexes (już istnieją w schemacie):**
- `idx_cards_deck_id` - dla foreign key constraint
- `idx_decks_user_id` - dla ownership verification

**Query Optimization:**
```sql
-- Użyj prepared statements (automatyczne w Supabase)
INSERT INTO cards (...) VALUES (...);
```

#### 8.2.2 Validation Optimization
**Early validation:**
```typescript
// Waliduj przed database calls
const validated = schema.parse(requestBody);
// Dopiero potem sprawdź deck ownership
```

#### 8.2.3 Response Size Optimization
**Minimal response:**
- Zwracamy tylko utworzoną kartę
- Brak dodatkowych metadanych
- Compression: Astro automatycznie włącza gzip

### 8.3 Monitoring Metrics
- Response time (p50, p95, p99)
- Database insert time
- Validation time
- Error rate by type
- Cards created per minute

## 9. Etapy wdrożenia

### Krok 1: Stworzenie API Route Handler

**Plik**: `src/pages/api/v1/decks/[deckId]/cards.ts`

```typescript
import type { APIRoute } from 'astro';
import { z } from 'zod';
import type { CardDTO, CreateCardCommand, ErrorResponse, ValidationErrorResponse } from '../../../types';

// Validation schema
const createCardSchema = z.object({
  question: z.string()
    .trim()
    .min(1, 'Question is required and must not be empty')
    .max(10000, 'Question must not exceed 10000 characters'),
  answer: z.string()
    .trim()
    .min(1, 'Answer is required and must not be empty')
    .max(10000, 'Answer must not exceed 10000 characters')
});

/**
 * POST /api/v1/decks/{deckId}/cards
 * Create a new card in the deck
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    // STEP 1: Authentication
    const { data: { user }, error: authError } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        } satisfies ErrorResponse),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // STEP 2: Parse and validate request body
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid JSON in request body'
          }
        } satisfies ErrorResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let validated: CreateCardCommand;
    try {
      validated = createCardSchema.parse(requestBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              errors: error.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message
              }))
            }
          } satisfies ValidationErrorResponse),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // STEP 3: Verify deck ownership
    const { data: deck, error: deckError } = await locals.supabase
      .from('decks')
      .select('id')
      .eq('id', params.deckId)
      .eq('user_id', user.id)
      .single();

    if (deckError || !deck) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'DECK_NOT_FOUND',
            message: 'Deck not found'
          }
        } satisfies ErrorResponse),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // STEP 4: Create card in database
    const now = new Date().toISOString();
    const { data: card, error: cardError } = await locals.supabase
      .from('cards')
      .insert({
        deck_id: params.deckId,
        question: validated.question,
        answer: validated.answer,
        ease_factor: 2.50,
        interval_days: 1,
        repetitions: 0,
        next_review_date: now
      })
      .select()
      .single();

    if (cardError) {
      console.error('Failed to create card:', cardError);
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Failed to create card',
            details: 'Database constraint violation'
          }
        } satisfies ErrorResponse),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // STEP 5: Map to DTO
    const cardDTO: CardDTO = {
      id: card.id,
      deckId: card.deck_id,
      question: card.question,
      answer: card.answer,
      easeFactor: card.ease_factor,
      intervalDays: card.interval_days,
      repetitions: card.repetitions,
      nextReviewDate: card.next_review_date,
      createdAt: card.created_at,
      updatedAt: card.updated_at
    };

    return new Response(
      JSON.stringify(cardDTO),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('POST /api/v1/decks/[deckId]/cards failed:', error);

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create card',
          details: 'Unexpected error occurred'
        }
      } satisfies ErrorResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Disable prerendering for API route
export const prerender = false;
```

---

### Krok 2: Testy jednostkowe

**Plik**: `src/pages/api/v1/decks/[deckId]/cards.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './cards';

// Mock Astro context
const createMockContext = (deckId: string, requestBody: any, supabaseMock: any) => ({
  params: { deckId },
  request: {
    json: vi.fn().mockResolvedValue(requestBody)
  },
  locals: {
    supabase: supabaseMock
  }
});

describe('POST /api/v1/decks/[deckId]/cards', () => {
  let mockSupabase: any;
  const mockUser = { id: 'user-123' };

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: vi.fn()
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis()
    };
  });

  it('should create card successfully', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    // Mock deck ownership check
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'deck-123' },
      error: null
    });

    // Mock card creation
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: 'card-123',
        deck_id: 'deck-123',
        question: 'Test question',
        answer: 'Test answer',
        ease_factor: 2.5,
        interval_days: 1,
        repetitions: 0,
        next_review_date: '2025-10-15T10:30:00.000Z',
        created_at: '2025-10-15T10:30:00.000Z',
        updated_at: '2025-10-15T10:30:00.000Z'
      },
      error: null
    });

    const context = createMockContext('deck-123', {
      question: 'Test question',
      answer: 'Test answer'
    }, mockSupabase);

    const response = await POST(context as any);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBe('card-123');
    expect(data.question).toBe('Test question');
    expect(data.answer).toBe('Test answer');
    expect(data.easeFactor).toBe(2.5);
  });

  it('should return 400 for validation errors', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    const context = createMockContext('deck-123', {
      question: '', // Invalid: empty
      answer: 'Test answer'
    }, mockSupabase);

    const response = await POST(context as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.errors).toHaveLength(1);
    expect(data.error.errors[0].field).toBe('question');
  });

  it('should return 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated')
    });

    const context = createMockContext('deck-123', {
      question: 'Test question',
      answer: 'Test answer'
    }, mockSupabase);

    const response = await POST(context as any);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 404 when deck not found', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' }
    });

    const context = createMockContext('deck-123', {
      question: 'Test question',
      answer: 'Test answer'
    }, mockSupabase);

    const response = await POST(context as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe('DECK_NOT_FOUND');
  });
});
```

---

### Krok 3: Testy integracyjne

**Plik**: `tests/api/cards-create.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('POST /api/v1/decks/{deckId}/cards', () => {
  let authToken: string;
  let deckId: string;

  beforeAll(async () => {
    // Setup: Get auth token and create test deck
    // (implementation depends on test setup)
  });

  it('should create card successfully', async () => {
    const response = await fetch(`http://localhost:4321/api/v1/decks/${deckId}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: 'What is JavaScript?',
        answer: 'JavaScript is a programming language.'
      })
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('deckId', deckId);
    expect(data).toHaveProperty('question', 'What is JavaScript?');
    expect(data).toHaveProperty('answer', 'JavaScript is a programming language.');
    expect(data).toHaveProperty('easeFactor', 2.5);
    expect(data).toHaveProperty('intervalDays', 1);
    expect(data).toHaveProperty('repetitions', 0);
  });

  it('should return 400 for validation errors', async () => {
    const response = await fetch(`http://localhost:4321/api/v1/decks/${deckId}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: '', // Invalid: empty
        answer: 'Test answer'
      })
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 for non-existent deck', async () => {
    const response = await fetch('http://localhost:4321/api/v1/decks/00000000-0000-0000-0000-000000000000/cards', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: 'Test question',
        answer: 'Test answer'
      })
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe('DECK_NOT_FOUND');
  });

  it('should return 401 without authentication', async () => {
    const response = await fetch(`http://localhost:4321/api/v1/decks/${deckId}/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: 'Test question',
        answer: 'Test answer'
      })
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe('UNAUTHORIZED');
  });
});
```

---

### Krok 4: Dokumentacja i deployment checklist

**Plik**: `.ai/cards-create-implementation-checklist.md`

```markdown
# Cards Create Implementation Checklist

## Development
- [x] API route handler implemented
- [x] Request body validation (Zod)
- [x] Deck ownership verification
- [x] Database insert with SM-2 defaults
- [x] Error handling for all scenarios
- [x] Unit tests for handler
- [x] Integration tests for endpoint
- [x] Manual testing with curl/Postman

## Configuration
- [ ] Verify database constraints exist
- [ ] Test SM-2 default values
- [ ] Verify foreign key constraints
- [ ] Test validation limits

## Security
- [ ] Authentication middleware tested
- [ ] Deck ownership verification tested
- [ ] Input validation tested
- [ ] No sensitive data in response
- [ ] SQL injection protection verified

## Performance
- [ ] Response time < 100ms (p95)
- [ ] Database insert optimized
- [ ] Validation performance tested
- [ ] Load testing completed

## Production Deployment
- [ ] API endpoint accessible
- [ ] Database constraints created
- [ ] Error tracking configured
- [ ] Monitoring metrics logged
- [ ] Documentation updated

## Post-Deployment
- [ ] Endpoint returns 201 Created
- [ ] Cards created with correct SM-2 values
- [ ] Validation works correctly
- [ ] No errors in logs
- [ ] Performance metrics acceptable
```

---

## 10. Podsumowanie implementacji

### Utworzone pliki:
1. `src/pages/api/v1/decks/[deckId]/cards.ts` - główny handler API (POST method)
2. `src/pages/api/v1/decks/[deckId]/cards.test.ts` - testy jednostkowe
3. `tests/api/cards-create.test.ts` - testy integracyjne
4. `.ai/cards-create-implementation-checklist.md` - checklist deployment

### Kluczowe cechy implementacji:
- ✅ Pełna walidacja request body (Zod)
- ✅ Deck ownership verification
- ✅ SM-2 default values (easeFactor=2.50, intervalDays=1, repetitions=0)
- ✅ Comprehensive error handling
- ✅ Type-safe z TypeScript
- ✅ Zgodność z API specification
- ✅ Security best practices
- ✅ Performance optimizations

### Następne kroki:
1. Przetestuj wszystkie scenariusze (success + errors)
2. Zweryfikuj SM-2 default values
3. Testuj validation limits
4. Deploy do production
5. Monitor performance metrics
