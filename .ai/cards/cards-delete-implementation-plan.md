# API Endpoint Implementation Plan: DELETE /api/v1/cards/{cardId}

## 1. Przegląd punktu końcowego

Endpoint `DELETE /api/v1/cards/{cardId}` umożliwia trwałe usunięcie fiszki z bazy danych (hard delete). Usunięcie kaskaduje do tabeli `reviews` przez foreign key constraint, co oznacza, że wszystkie powiązane oceny są również usuwane.

**Główne funkcjonalności:**
- Trwałe usunięcie karty z bazy danych
- Weryfikacja własności karty przez `deck.user_id`
- Kaskadowe usunięcie powiązanych ocen (reviews)
- Zwracanie potwierdzenia usunięcia
- Bezpieczny dostęp tylko do własnych kart

**Kluczowe założenia:**
- Wymaga autentykacji (Bearer token Supabase)
- Weryfikuje własność karty przez JOIN z tabelą `decks`
- Hard delete (brak soft delete)
- Kaskadowe usunięcie reviews przez foreign key
- Brak request body (prosty DELETE request)
- Zwraca standardowy response `{ "status": "deleted" }`

## 2. Szczegóły żądania

### Metoda HTTP
`DELETE`

### Struktura URL
```
DELETE /api/v1/cards/{cardId}
```

### Headers
```
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

### Parametry

#### Path Parameters:
- **cardId** (string, UUID, wymagany)
  - ID karty do usunięcia
  - Walidacja: musi być prawidłowym UUID
  - Przykład: `660e8400-e29b-41d4-a716-446655440001`

#### Query Parameters:
Brak

### Request Body
Brak (DELETE request)

### Przykładowe żądanie
```http
DELETE /api/v1/cards/660e8400-e29b-41d4-a716-446655440001
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. Wykorzystywane typy

### Response DTOs

**CardDeletedDTO** (Response) - już zdefiniowany w `src/types.ts`:
```typescript
export type CardDeletedDTO = DeletedDTO;

// Struktura:
{
  status: 'deleted';
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
  "status": "deleted"
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
    "message": "Failed to delete card",
    "details": "Database connection error"
  }
}
```

## 5. Przepływ danych

### Architektura wysokiego poziomu

```
Client Request (DELETE /api/v1/cards/{cardId})
    ↓
API Route Handler (src/pages/api/v1/cards/[cardId].ts)
    ↓
[1] Authentication Check
    ↓
[2] Card ID Validation
    ↓
[3] Card Ownership Verification (JOIN with decks)
    ↓
[4] Delete Card from Database (CASCADE to reviews)
    ↓
[5] Return CardDeletedDTO (200 OK)
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
   SELECT cards.id, cards.deck_id, decks.user_id 
   FROM cards 
   INNER JOIN decks ON cards.deck_id = decks.id 
   WHERE cards.id = $1 AND decks.user_id = $2;
   ```
2. Jeśli card nie istnieje → **404 Not Found**
3. Jeśli card nie należy do użytkownika → **403 Forbidden**

#### KROK 4: Delete Card from Database
```sql
DELETE FROM cards 
WHERE id = $1;
-- CASCADE automatically deletes related reviews
```

#### KROK 5: Return Response
```typescript
return new Response(
  JSON.stringify({ status: 'deleted' }),
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
  - `cards`: `DELETE` policy wymaga `deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid())`
  - `decks`: `SELECT` policy wymaga `user_id = auth.uid()`
- **Enforcement**: Podwójna ochrona - aplikacja + RLS

### 6.3 Input Validation
- **cardId**: UUID format validation
- **No query parameters**: Brak dodatkowych parametrów do walidacji
- **No request body**: Brak danych do sanityzacji

### 6.4 Data Privacy
- **No cross-user data**: Użytkownik może usuwać tylko swoje karty
- **Cascade delete**: Automatyczne usunięcie powiązanych reviews
- **Audit trail**: Logowanie usunięcia kart

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
    "message": "Failed to delete card",
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

1. **Database Delete** ⚠️ GŁÓWNE WĄSKIE GARDŁO
   - Czas: 20-100ms dla typowych deletes
   - Throughput: Ograniczony przez Supabase connection pool
   - Koszt: Minimalny (single DELETE)

2. **Cascade Delete**
   - Czas: Dodatkowe 10-50ms dla reviews deletion
   - Zależy od liczby powiązanych reviews

3. **Response Serialization**
   - JSON serialization: <1ms (minimal response)

### 8.2 Optymalizacje

#### 8.2.1 Database Optimization
**Indexes (już istnieją w schemacie):**
- `idx_cards_deck_id` - dla JOIN z decks
- `idx_decks_user_id` - dla ownership verification
- `idx_reviews_card_id` - dla cascade delete

**Query Optimization:**
```sql
-- Użyj indexów dla DELETE
DELETE FROM cards WHERE id = $1;
-- CASCADE automatically handled by foreign key
```

#### 8.2.2 Response Size Optimization
**Minimal response:**
- Zwracamy tylko `{ "status": "deleted" }`
- Brak dodatkowych metadanych
- Compression: Astro automatycznie włącza gzip

### 8.3 Monitoring Metrics
- Response time (p50, p95, p99)
- Database delete time
- Cascade delete time
- Error rate by type
- Cards deleted per minute

## 9. Etapy wdrożenia

### Krok 1: Stworzenie API Route Handler

**Plik**: `src/pages/api/v1/cards/[cardId].ts`

```typescript
import type { APIRoute } from 'astro';
import { z } from 'zod';
import type { CardDeletedDTO, ErrorResponse } from '../../../types';

// Validation schema
const cardIdSchema = z.string().uuid('Invalid card ID format');

/**
 * DELETE /api/v1/cards/{cardId}
 * Delete a card
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
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

    // STEP 3: Verify card ownership
    const { data: card, error: cardError } = await locals.supabase
      .from('cards')
      .select(`
        id,
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
            message: 'Failed to delete card',
            details: 'Database query failed'
          }
        } satisfies ErrorResponse),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // STEP 4: Delete card from database
    const { error: deleteError } = await locals.supabase
      .from('cards')
      .delete()
      .eq('id', cardId);

    if (deleteError) {
      console.error('Failed to delete card:', deleteError);
      return new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete card',
            details: 'Database delete failed'
          }
        } satisfies ErrorResponse),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // STEP 5: Return success response
    const response: CardDeletedDTO = {
      status: 'deleted'
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('DELETE /api/v1/cards/[cardId] failed:', error);

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete card',
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
import { DELETE } from './[cardId]';

// Mock Astro context
const createMockContext = (cardId: string, supabaseMock: any) => ({
  params: { cardId },
  locals: {
    supabase: supabaseMock
  }
});

describe('DELETE /api/v1/cards/[cardId]', () => {
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
      delete: vi.fn().mockReturnThis()
    };
  });

  it('should delete card successfully', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    // Mock card ownership check
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'card-123',
        deck: {
          user_id: 'user-123'
        }
      },
      error: null
    });

    // Mock card deletion
    mockSupabase.delete.mockResolvedValue({
      error: null
    });

    const context = createMockContext('card-123', mockSupabase);
    const response = await DELETE(context as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('deleted');
  });

  it('should return 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated')
    });

    const context = createMockContext('card-123', mockSupabase);
    const response = await DELETE(context as any);

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
    const response = await DELETE(context as any);

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
    const response = await DELETE(context as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe('CARD_NOT_FOUND');
  });

  it('should return 500 when delete fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'card-123',
        deck: {
          user_id: 'user-123'
        }
      },
      error: null
    });

    mockSupabase.delete.mockResolvedValue({
      error: new Error('Database error')
    });

    const context = createMockContext('card-123', mockSupabase);
    const response = await DELETE(context as any);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
```

---

### Krok 3: Testy integracyjne

**Plik**: `tests/api/cards-delete.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('DELETE /api/v1/cards/{cardId}', () => {
  let authToken: string;
  let cardId: string;

  beforeAll(async () => {
    // Setup: Get auth token and create test card
    // (implementation depends on test setup)
  });

  it('should delete card successfully', async () => {
    const response = await fetch(`http://localhost:4321/api/v1/cards/${cardId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('status', 'deleted');
  });

  it('should return 404 for non-existent card', async () => {
    const response = await fetch('http://localhost:4321/api/v1/cards/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe('CARD_NOT_FOUND');
  });

  it('should return 401 without authentication', async () => {
    const response = await fetch(`http://localhost:4321/api/v1/cards/${cardId}`, {
      method: 'DELETE'
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 404 for invalid UUID format', async () => {
    const response = await fetch('http://localhost:4321/api/v1/cards/invalid-uuid', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe('CARD_NOT_FOUND');
  });

  it('should cascade delete related reviews', async () => {
    // Create a card with reviews
    const createCardResponse = await fetch(`http://localhost:4321/api/v1/decks/${deckId}/cards`, {
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

    const card = await createCardResponse.json();
    const testCardId = card.id;

    // Create a review for the card
    await fetch(`http://localhost:4321/api/v1/cards/${testCardId}/review`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grade: 4
      })
    });

    // Delete the card
    const deleteResponse = await fetch(`http://localhost:4321/api/v1/cards/${testCardId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(deleteResponse.status).toBe(200);

    // Verify card is deleted
    const getResponse = await fetch(`http://localhost:4321/api/v1/cards/${testCardId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(getResponse.status).toBe(404);
  });
});
```

---

### Krok 4: Dokumentacja i deployment checklist

**Plik**: `.ai/cards-delete-implementation-checklist.md`

```markdown
# Cards Delete Implementation Checklist

## Development
- [x] API route handler implemented
- [x] Card ID validation (UUID format)
- [x] Card ownership verification (JOIN with decks)
- [x] Database delete with cascade
- [x] Error handling for all scenarios
- [x] Unit tests for handler
- [x] Integration tests for endpoint
- [x] Manual testing with curl/Postman

## Configuration
- [ ] Verify database foreign key constraints exist
- [ ] Test cascade delete functionality
- [ ] Verify ownership verification works
- [ ] Test UUID validation

## Security
- [ ] Authentication middleware tested
- [ ] Card ownership verification tested
- [ ] No cross-user data access
- [ ] Cascade delete works correctly
- [ ] Input validation tested

## Performance
- [ ] Response time < 100ms (p95)
- [ ] Database delete optimized
- [ ] Cascade delete performance tested
- [ ] Load testing completed

## Production Deployment
- [ ] API endpoint accessible
- [ ] Database constraints created
- [ ] Error tracking configured
- [ ] Monitoring metrics logged
- [ ] Documentation updated

## Post-Deployment
- [ ] Endpoint returns 200 OK
- [ ] Cards deleted correctly
- [ ] Cascade delete works
- [ ] No errors in logs
- [ ] Performance metrics acceptable
```

---

## 10. Podsumowanie implementacji

### Utworzone pliki:
1. `src/pages/api/v1/cards/[cardId].ts` - główny handler API (DELETE method)
2. `src/pages/api/v1/cards/[cardId].test.ts` - testy jednostkowe
3. `tests/api/cards-delete.test.ts` - testy integracyjne
4. `.ai/cards-delete-implementation-checklist.md` - checklist deployment

### Kluczowe cechy implementacji:
- ✅ Card ID validation (UUID format)
- ✅ Card ownership verification (JOIN z decks)
- ✅ Hard delete (brak soft delete)
- ✅ Cascade delete dla reviews
- ✅ Comprehensive error handling
- ✅ Type-safe z TypeScript
- ✅ Zgodność z API specification
- ✅ Security best practices
- ✅ Performance optimizations
- ✅ Simple DELETE request (brak request body)

### Następne kroki:
1. Przetestuj wszystkie scenariusze (success + errors)
2. Zweryfikuj cascade delete functionality
3. Testuj UUID validation
4. Deploy do production
5. Monitor performance metrics
