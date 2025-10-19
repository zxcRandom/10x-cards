# API Endpoint Implementation Plan: GET /api/v1/cards/{cardId}

## 1. Przegląd punktu końcowego

Endpoint `GET /api/v1/cards/{cardId}` umożliwia pobranie pełnych danych pojedynczej fiszki. Weryfikuje własność karty przez sprawdzenie, czy należy do talii użytkownika, i zwraca wszystkie pola SM-2 wraz z metadanymi.

**Główne funkcjonalności:**
- Pobranie pełnych danych pojedynczej karty
- Weryfikacja własności karty przez `deck.user_id`
- Zwracanie wszystkich pól SM-2 (easeFactor, intervalDays, repetitions, nextReviewDate)
- Zwracanie metadanych (createdAt, updatedAt)
- Bezpieczny dostęp tylko do własnych kart

**Kluczowe założenia:**
- Wymaga autentykacji (Bearer token Supabase)
- Weryfikuje własność karty przez JOIN z tabelą `decks`
- Zwraca wszystkie pola karty (question, answer, SM-2 fields, timestamps)
- Brak query parameters (prosty GET request)
- Własność określana przez `cards.deck_id → decks.user_id`

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
GET /api/v1/cards/{cardId}
```

### Headers
```
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

### Parametry

#### Path Parameters:
- **cardId** (string, UUID, wymagany)
  - ID karty do pobrania
  - Walidacja: musi być prawidłowym UUID
  - Przykład: `660e8400-e29b-41d4-a716-446655440001`

#### Query Parameters:
Brak

### Request Body
Brak (GET request)

### Przykładowe żądanie
```http
GET /api/v1/cards/660e8400-e29b-41d4-a716-446655440001
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. Wykorzystywane typy

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

**ErrorResponse** - dla błędów 401, 403, 404, 500:
```typescript
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
  }
}
```

### Internal Types

**CardWithDeck** - używany wewnętrznie do JOIN query:
```typescript
interface CardWithDeck {
  id: string;
  deck_id: string;
  question: string;
  answer: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
  created_at: string;
  updated_at: string;
  deck: {
    user_id: string;
  };
}
```

### Database Types
Wykorzystywane typy z `src/db/database.types.ts`:
- `DbCard` = `Tables<'cards'>`
- `DbDeck` = `Tables<'decks'>`

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

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
    "message": "Access denied to this card"
  }
}
```

#### 404 Not Found
```json
{
  "error": {
    "code": "CARD_NOT_FOUND",
    "message": "Card not found"
  }
}
```

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to retrieve card",
    "details": "Database connection error"
  }
}
```

## 5. Przepływ danych

### Architektura wysokiego poziomu

```
Client Request (GET /api/v1/cards/{cardId})
    ↓
API Route Handler (src/pages/api/v1/cards/[cardId].ts)
    ↓
[1] Authentication Check
    ↓
[2] Card ID Validation
    ↓
[3] Card Ownership Verification (JOIN with decks)
    ↓
[4] Map Database Result to DTO
    ↓
[5] Return CardDTO (200 OK)
```

### Szczegółowy przepływ krok po kroku

#### KROK 1: Authentication Check
1. Middleware sprawdza `Authorization` header
2. Pobiera użytkownika przez `context.locals.supabase.auth.getUser()`
3. Jeśli brak/invalid token → **401 Unauthorized**

#### KROK 2: Card ID Validation
1. Waliduj `cardId` (UUID format)
2. Jeśli invalid UUID → **404 Not Found**

#### KROK 3: Card Ownership Verification
1. Wykonaj JOIN query:
   ```sql
   SELECT cards.*, decks.user_id 
   FROM cards 
   INNER JOIN decks ON cards.deck_id = decks.id 
   WHERE cards.id = $1 AND decks.user_id = $2;
   ```
2. Jeśli card nie istnieje → **404 Not Found**
3. Jeśli card nie należy do użytkownika → **403 Forbidden**

#### KROK 4: Map to DTO
1. Konwertuj `DbCard` → `CardDTO` (snake_case → camelCase)
2. Zwróć response z statusem 200 OK

#### KROK 5: Return Response
```typescript
return new Response(
  JSON.stringify(cardDTO),
  {
    status: 200,
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
- **Card ownership**: Sprawdzenie przez JOIN `cards.deck_id → decks.user_id`
- **RLS policies**: 
  - `cards`: `SELECT` policy wymaga `deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid())`
  - `decks`: `SELECT` policy wymaga `user_id = auth.uid()`
- **Enforcement**: Podwójna ochrona - aplikacja + RLS

### 6.3 Input Validation
- **cardId**: UUID format validation
- **No query parameters**: Brak dodatkowych parametrów do walidacji
- **No request body**: Brak danych do sanityzacji

### 6.4 Data Privacy
- **No cross-user data**: Użytkownik widzi tylko swoje karty
- **No sensitive fields**: Brak user_id w response
- **Audit trail**: Logowanie dostępu do kart

## 7. Obsługa błędów

### 7.1 Scenariusze błędów i kody statusu

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
1. Card istnieje, ale nie należy do użytkownika
2. Card należy do soft-deleted deck

**Response:**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied to this card"
  }
}
```

#### 404 Not Found - Card Not Found
**Przypadki:**
1. Card z podanym ID nie istnieje
2. Invalid UUID format w cardId
3. Card należy do nieistniejącego deck

**Response:**
```json
{
  "error": {
    "code": "CARD_NOT_FOUND",
    "message": "Card not found"
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
    "message": "Failed to retrieve card",
    "details": "Database connection error"
  }
}
```

### 7.2 Error Logging Strategy
- **Log all errors** do application logger
- **Include context**: cardId, userId
- **No sensitive data** w logach
- **Monitor error rates** dla alerting

## 8. Rozważania dotyczące wydajności

### 8.1 Wąskie gardła

1. **Database Query** ⚠️ GŁÓWNE WĄSKIE GARDŁO
   - Czas: 10-50ms dla typowych queries
   - Throughput: Ograniczony przez Supabase connection pool
   - Koszt: Minimalny (SELECT z JOIN)

2. **Response Serialization**
   - JSON serialization: 1-2ms dla typowych payloads

### 8.2 Optymalizacje

#### 8.2.1 Database Optimization
**Indexes (już istnieją w schemacie):**
- `idx_cards_deck_id` - dla JOIN z decks
- `idx_decks_user_id` - dla ownership verification

**Query Optimization:**
```sql
-- Użyj indexów dla JOIN
SELECT cards.*, decks.user_id 
FROM cards 
INNER JOIN decks ON cards.deck_id = decks.id 
WHERE cards.id = $1 AND decks.user_id = $2;
```

#### 8.2.2 Response Size Optimization
**Minimal response:**
- Zwracamy tylko dane karty
- Brak dodatkowych metadanych
- Compression: Astro automatycznie włącza gzip

### 8.3 Monitoring Metrics
- Response time (p50, p95, p99)
- Database query time
- Error rate by type
- Cache hit rate (jeśli dodamy cache)

## 9. Etapy wdrożenia

### Krok 1: Stworzenie API Route Handler

**Plik**: `src/pages/api/v1/cards/[cardId].ts`

```typescript
import type { APIRoute } from 'astro';
import { z } from 'zod';
import type { CardDTO, ErrorResponse } from '../../../types';

// Validation schema
const cardIdSchema = z.string().uuid('Invalid card ID format');

/**
 * GET /api/v1/cards/{cardId}
 * Get a single card by ID
 */
export const GET: APIRoute = async ({ params, locals }) => {
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

    // STEP 2: Validate card ID
    let cardId: string;
    try {
      cardId = cardIdSchema.parse(params.cardId);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'CARD_NOT_FOUND',
            message: 'Card not found'
          }
        } satisfies ErrorResponse),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // STEP 3: Get card with ownership verification
    const { data: card, error: cardError } = await locals.supabase
      .from('cards')
      .select(`
        *,
        deck:decks!inner(user_id)
      `)
      .eq('id', cardId)
      .eq('deck.user_id', user.id)
      .single();

    if (cardError || !card) {
      if (cardError?.code === 'PGRST116') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'CARD_NOT_FOUND',
              message: 'Card not found'
            }
          } satisfies ErrorResponse),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.error('Failed to fetch card:', cardError);
      return new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve card',
            details: 'Database query failed'
          }
        } satisfies ErrorResponse),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // STEP 4: Map to DTO
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
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('GET /api/v1/cards/[cardId] failed:', error);

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve card',
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

**Plik**: `src/pages/api/v1/cards/[cardId].test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './[cardId]';

// Mock Astro context
const createMockContext = (cardId: string, supabaseMock: any) => ({
  params: { cardId },
  locals: {
    supabase: supabaseMock
  }
});

describe('GET /api/v1/cards/[cardId]', () => {
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
      single: vi.fn()
    };
  });

  it('should return card successfully', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    // Mock card query
    mockSupabase.single.mockResolvedValue({
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
        updated_at: '2025-10-15T10:30:00.000Z',
        deck: {
          user_id: 'user-123'
        }
      },
      error: null
    });

    const context = createMockContext('card-123', mockSupabase);
    const response = await GET(context as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe('card-123');
    expect(data.question).toBe('Test question');
    expect(data.answer).toBe('Test answer');
    expect(data.easeFactor).toBe(2.5);
  });

  it('should return 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated')
    });

    const context = createMockContext('card-123', mockSupabase);
    const response = await GET(context as any);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 404 when card not found', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' }
    });

    const context = createMockContext('card-123', mockSupabase);
    const response = await GET(context as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe('CARD_NOT_FOUND');
  });

  it('should return 404 for invalid UUID', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    const context = createMockContext('invalid-uuid', mockSupabase);
    const response = await GET(context as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe('CARD_NOT_FOUND');
  });

  it('should return 404 when card belongs to different user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' }
    });

    const context = createMockContext('card-123', mockSupabase);
    const response = await GET(context as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe('CARD_NOT_FOUND');
  });
});
```

---

### Krok 3: Testy integracyjne

**Plik**: `tests/api/cards-get-single.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('GET /api/v1/cards/{cardId}', () => {
  let authToken: string;
  let cardId: string;

  beforeAll(async () => {
    // Setup: Get auth token and create test card
    // (implementation depends on test setup)
  });

  it('should return card successfully', async () => {
    const response = await fetch(`http://localhost:4321/api/v1/cards/${cardId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('id', cardId);
    expect(data).toHaveProperty('question');
    expect(data).toHaveProperty('answer');
    expect(data).toHaveProperty('easeFactor');
    expect(data).toHaveProperty('intervalDays');
    expect(data).toHaveProperty('repetitions');
    expect(data).toHaveProperty('nextReviewDate');
    expect(data).toHaveProperty('createdAt');
    expect(data).toHaveProperty('updatedAt');
  });

  it('should return 404 for non-existent card', async () => {
    const response = await fetch('http://localhost:4321/api/v1/cards/00000000-0000-0000-0000-000000000000', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe('CARD_NOT_FOUND');
  });

  it('should return 401 without authentication', async () => {
    const response = await fetch(`http://localhost:4321/api/v1/cards/${cardId}`);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 404 for invalid UUID format', async () => {
    const response = await fetch('http://localhost:4321/api/v1/cards/invalid-uuid', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe('CARD_NOT_FOUND');
  });
});
```

---

### Krok 4: Dokumentacja i deployment checklist

**Plik**: `.ai/cards-get-single-implementation-checklist.md`

```markdown
# Cards Get Single Implementation Checklist

## Development
- [x] API route handler implemented
- [x] Card ID validation (UUID format)
- [x] Card ownership verification (JOIN with decks)
- [x] Error handling for all scenarios
- [x] Unit tests for handler
- [x] Integration tests for endpoint
- [x] Manual testing with curl/Postman

## Configuration
- [ ] Verify database indexes exist
- [ ] Test JOIN query performance
- [ ] Verify ownership verification works
- [ ] Test UUID validation

## Security
- [ ] Authentication middleware tested
- [ ] Card ownership verification tested
- [ ] No cross-user data access
- [ ] No sensitive data in response
- [ ] Input validation tested

## Performance
- [ ] Response time < 50ms (p95)
- [ ] Database query optimized
- [ ] JOIN query performance tested
- [ ] Load testing completed

## Production Deployment
- [ ] API endpoint accessible
- [ ] Database indexes created
- [ ] Error tracking configured
- [ ] Monitoring metrics logged
- [ ] Documentation updated

## Post-Deployment
- [ ] Endpoint returns 200 OK
- [ ] Card ownership verification works
- [ ] UUID validation works
- [ ] No errors in logs
- [ ] Performance metrics acceptable
```

---

## 10. Podsumowanie implementacji

### Utworzone pliki:
1. `src/pages/api/v1/cards/[cardId].ts` - główny handler API
2. `src/pages/api/v1/cards/[cardId].test.ts` - testy jednostkowe
3. `tests/api/cards-get-single.test.ts` - testy integracyjne
4. `.ai/cards-get-single-implementation-checklist.md` - checklist deployment

### Kluczowe cechy implementacji:
- ✅ Card ID validation (UUID format)
- ✅ Card ownership verification (JOIN z decks)
- ✅ Comprehensive error handling
- ✅ Type-safe z TypeScript
- ✅ Zgodność z API specification
- ✅ Security best practices
- ✅ Performance optimizations
- ✅ Simple GET request (brak query params)

### Następne kroki:
1. Przetestuj wszystkie scenariusze (success + errors)
2. Zweryfikuj ownership verification
3. Testuj UUID validation
4. Deploy do production
5. Monitor performance metrics
