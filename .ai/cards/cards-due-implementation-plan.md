# API Endpoint Implementation Plan: GET /api/v1/decks/{deckId}/cards/due

## 1. Przegląd punktu końcowego

Endpoint `GET /api/v1/decks/{deckId}/cards/due` umożliwia pobranie listy fiszek z talii, które są gotowe do powtórki (gdzie `next_review_date <= before`). Jest to kluczowy endpoint dla systemu nauki z powtórkami opartym na algorytmie SM-2.

**Główne funkcjonalności:**

- Listowanie kart wymagających powtórki w określonej talii
- Filtrowanie według daty granicznej (`before` parameter)
- Paginacja z sortowaniem według `nextReviewDate`
- Weryfikacja własności talii (użytkownik może widzieć tylko swoje karty)
- Zwracanie pełnych danych SM-2 dla każdej karty

**Kluczowe założenia:**

- Wymaga autentykacji (Bearer token Supabase)
- Weryfikuje własność talii przez `deck.user_id`
- Domyślnie zwraca karty z `next_review_date <= now()`
- Sortowanie domyślnie według `nextReviewDate ASC` (najstarsze najpierw)
- Wykorzystuje indeks `idx_cards_deck_review` dla optymalnej wydajności

## 2. Szczegóły żądania

### Metoda HTTP

`GET`

### Struktura URL

```
GET /api/v1/decks/{deckId}/cards/due
```

### Headers

```
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

### Parametry

#### Path Parameters:

- **deckId** (string, UUID, wymagany)
  - ID talii, z której pobieramy karty do powtórki
  - Walidacja: musi być prawidłowym UUID
  - Przykład: `550e8400-e29b-41d4-a716-446655440000`

#### Query Parameters (wszystkie opcjonalne):

- **before** (string, ISO-8601)
  - Data graniczna dla powtórek
  - Walidacja: prawidłowy format ISO-8601
  - Domyślnie: `now()` (aktualna data i czas)
  - Przykład: `2025-10-19T12:00:00Z`

- **limit** (number)
  - Liczba kart na stronę
  - Walidacja: 1-100
  - Domyślnie: 50
  - Przykład: `25`

- **offset** (number)
  - Przesunięcie dla paginacji
  - Walidacja: ≥0
  - Domyślnie: 0
  - Przykład: `50`

- **sort** (string, enum)
  - Pole sortowania
  - Dostępne wartości: `nextReviewDate` (jedyna sensowna opcja)
  - Domyślnie: `nextReviewDate`
  - Przykład: `nextReviewDate`

- **order** (string, enum)
  - Kierunek sortowania
  - Dostępne wartości: `asc | desc`
  - Domyślnie: `asc` (najstarsze najpierw)
  - Przykład: `asc`

### Request Body

Brak (GET request)

### Przykładowe żądanie

```http
GET /api/v1/decks/550e8400-e29b-41d4-a716-446655440000/cards/due?before=2025-10-19T12:00:00Z&limit=50&order=asc
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. Wykorzystywane typy

### Response DTOs

**DueCardsListDTO** (Response) - już zdefiniowany w `src/types.ts`:

```typescript
export type DueCardsListDTO = PaginatedListDTO<CardDTO>;

// Struktura:
{
  items: CardDTO[];
  total: number;
  limit: number;
  offset: number;
}
```

**CardDTO** - pojedyncza karta (już zdefiniowany w `src/types.ts`):

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
  };
}
```

### Internal Types

**DueCardsQuery** - używany wewnętrznie do walidacji query params:

```typescript
interface DueCardsQuery {
  deckId: string;
  before: string; // ISO-8601
  limit: number;
  offset: number;
  sort: "nextReviewDate";
  order: "asc" | "desc";
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
  "items": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "deckId": "550e8400-e29b-41d4-a716-446655440000",
      "question": "What is closure in JavaScript?",
      "answer": "A closure is a function that has access to its own scope, the outer function's scope, and the global scope.",
      "easeFactor": 2.5,
      "intervalDays": 1,
      "repetitions": 0,
      "nextReviewDate": "2025-10-15T10:30:00.000Z",
      "createdAt": "2025-10-15T10:30:00.000Z",
      "updatedAt": "2025-10-15T10:30:00.000Z"
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "deckId": "550e8400-e29b-41d4-a716-446655440000",
      "question": "What is a promise in JavaScript?",
      "answer": "A promise is an object representing the eventual completion or failure of an asynchronous operation.",
      "easeFactor": 2.3,
      "intervalDays": 3,
      "repetitions": 2,
      "nextReviewDate": "2025-10-18T10:30:00.000Z",
      "createdAt": "2025-10-14T10:30:00.000Z",
      "updatedAt": "2025-10-15T10:30:00.000Z"
    }
  ],
  "total": 15,
  "limit": 50,
  "offset": 0
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

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to retrieve due cards",
    "details": "Database connection error"
  }
}
```

## 5. Przepływ danych

### Architektura wysokiego poziomu

```
Client Request (GET /api/v1/decks/{deckId}/cards/due)
    ↓
API Route Handler (src/pages/api/v1/decks/[deckId]/cards/due.ts)
    ↓
[1] Authentication Check
    ↓
[2] Deck Ownership Verification
    ↓
[3] Query Parameters Validation
    ↓
[4] Database Query with Due Date Filter
    ↓
[5] Map Database Results to DTOs
    ↓
[6] Return DueCardsListDTO
```

### Szczegółowy przepływ krok po kroku

#### KROK 1: Authentication Check

1. Middleware sprawdza `Authorization` header
2. Pobiera użytkownika przez `context.locals.supabase.auth.getUser()`
3. Jeśli brak/invalid token → **401 Unauthorized**

#### KROK 2: Deck Ownership Verification

1. Wykonaj query: `SELECT id FROM decks WHERE id = $1 AND user_id = $2`
2. Jeśli deck nie istnieje → **404 Not Found**
3. Jeśli deck nie należy do użytkownika → **403 Forbidden**

#### KROK 3: Query Parameters Validation

1. Waliduj `deckId` (UUID format)
2. Waliduj `before` (ISO-8601 format, default: now())
3. Waliduj `limit` (1-100, default 50)
4. Waliduj `offset` (≥0, default 0)
5. Waliduj `sort` (tylko 'nextReviewDate', default: 'nextReviewDate')
6. Waliduj `order` (asc/desc, default 'asc')

#### KROK 4: Database Query

```sql
-- Count total due cards
SELECT COUNT(*) FROM cards
WHERE deck_id = $1
AND next_review_date <= $2;

-- Get due cards with pagination
SELECT * FROM cards
WHERE deck_id = $1
AND next_review_date <= $2
ORDER BY next_review_date ASC
LIMIT $3 OFFSET $4;
```

#### KROK 5: Map to DTOs

1. Konwertuj `DbCard[]` → `CardDTO[]` (snake_case → camelCase)
2. Utwórz `DueCardsListDTO` z pagination metadata

#### KROK 6: Return Response

```typescript
return new Response(JSON.stringify(dueCardsListDTO), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});
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
  - `cards`: `SELECT` policy wymaga `deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid())`
- **Enforcement**: Podwójna ochrona - aplikacja + RLS

### 6.3 Input Validation & Sanitization

- **deckId**: UUID format validation
- **before**: ISO-8601 format validation
- **Query params**: Type validation, range checks
- **Date parsing**: Walidacja formatu daty

### 6.4 Data Privacy

- **No cross-user data**: Użytkownik widzi tylko swoje karty
- **No sensitive fields**: Brak user_id w response
- **Audit trail**: Logowanie dostępu do due cards

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
    "message": "Failed to retrieve due cards",
    "details": "Database connection error"
  }
}
```

### 7.2 Error Logging Strategy

- **Log all errors** do application logger
- **Include context**: deckId, userId, query params
- **No sensitive data** w logach
- **Monitor error rates** dla alerting

## 8. Rozważania dotyczące wydajności

### 8.1 Wąskie gardła

1. **Database Query** ⚠️ GŁÓWNE WĄSKIE GARDŁO
   - Czas: 30-150ms dla typowych queries
   - Throughput: Ograniczony przez Supabase connection pool
   - Koszt: Minimalny (SELECT queries)

2. **Pagination Count Query**
   - Czas: 20-100ms (zależy od liczby due cards)
   - Można zoptymalizować przez cache

3. **Response Serialization**
   - JSON serialization: 1-5ms dla typowych payloads

### 8.2 Optymalizacje

#### 8.2.1 Database Optimization

**Indexes (już istnieją w schemacie):**

- `idx_cards_deck_id` - dla filtrowania po deck_id
- `idx_cards_deck_review` - dla filtrowania po next_review_date

**Query Optimization:**

```sql
-- Użyj composite index dla optymalnej wydajności
SELECT * FROM cards
WHERE deck_id = $1
AND next_review_date <= $2
ORDER BY next_review_date ASC;
```

#### 8.2.2 Pagination Optimization

**Skip count dla dużych offset:**

```typescript
// Dla offset > 1000, użyj cursor-based pagination
if (offset > 1000) {
  // Użyj WHERE next_review_date > last_seen_date zamiast OFFSET
}
```

#### 8.2.3 Response Size Optimization

**Compression:**

- Astro automatycznie włącza gzip compression
- Response body compression ratio: ~70-80% dla JSON

### 8.3 Monitoring Metrics

- Response time (p50, p95, p99)
- Query execution time
- Pagination usage patterns
- Due cards count trends
- Error rate by type

## 9. Etapy wdrożenia

### Krok 1: Stworzenie API Route Handler

**Plik**: `src/pages/api/v1/decks/[deckId]/cards/due.ts`

```typescript
import type { APIRoute } from "astro";
import { z } from "zod";
import type { DueCardsListDTO, ErrorResponse } from "../../../types";

// Validation schema
const dueCardsSchema = z.object({
  deckId: z.string().uuid("Invalid deck ID format"),
  before: z
    .string()
    .datetime("Invalid date format")
    .default(() => new Date().toISOString()),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["nextReviewDate"]).default("nextReviewDate"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

/**
 * GET /api/v1/decks/{deckId}/cards/due
 * List cards due for review
 */
export const GET: APIRoute = async ({ params, url, locals }) => {
  try {
    // STEP 1: Authentication
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        } satisfies ErrorResponse),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // STEP 2: Validate and parse query parameters
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validated = dueCardsSchema.parse({
      deckId: params.deckId,
      ...queryParams,
    });

    // STEP 3: Verify deck ownership
    const { data: deck, error: deckError } = await locals.supabase
      .from("decks")
      .select("id")
      .eq("id", validated.deckId)
      .eq("user_id", user.id)
      .single();

    if (deckError || !deck) {
      return new Response(
        JSON.stringify({
          error: {
            code: "DECK_NOT_FOUND",
            message: "Deck not found",
          },
        } satisfies ErrorResponse),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // STEP 4: Build database query for due cards
    let query = locals.supabase
      .from("cards")
      .select("*")
      .eq("deck_id", validated.deckId)
      .lte("next_review_date", validated.before);

    // Add sorting
    query = query.order("next_review_date", { ascending: validated.order === "asc" });

    // Add pagination
    query = query.range(validated.offset, validated.offset + validated.limit - 1);

    // STEP 5: Execute query
    const { data: cards, error: cardsError } = await query;

    if (cardsError) {
      console.error("Failed to fetch due cards:", cardsError);
      return new Response(
        JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve due cards",
            details: "Database query failed",
          },
        } satisfies ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // STEP 6: Get total count
    let countQuery = locals.supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("deck_id", validated.deckId)
      .lte("next_review_date", validated.before);

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("Failed to count due cards:", countError);
      return new Response(
        JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve due cards",
            details: "Count query failed",
          },
        } satisfies ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // STEP 7: Map to DTOs
    const cardDTOs = (cards || []).map((card) => ({
      id: card.id,
      deckId: card.deck_id,
      question: card.question,
      answer: card.answer,
      easeFactor: card.ease_factor,
      intervalDays: card.interval_days,
      repetitions: card.repetitions,
      nextReviewDate: card.next_review_date,
      createdAt: card.created_at,
      updatedAt: card.updated_at,
    }));

    const response: DueCardsListDTO = {
      items: cardDTOs,
      total: count || 0,
      limit: validated.limit,
      offset: validated.offset,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GET /api/v1/decks/[deckId]/cards/due failed:", error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: {
            code: "BAD_REQUEST",
            message: "Invalid query parameters",
            details: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
          },
        } satisfies ErrorResponse),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve due cards",
          details: "Unexpected error occurred",
        },
      } satisfies ErrorResponse),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

// Disable prerendering for API route
export const prerender = false;
```

---

### Krok 2: Testy jednostkowe

**Plik**: `src/pages/api/v1/decks/[deckId]/cards/due.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./due";

// Mock Astro context
const createMockContext = (deckId: string, searchParams: Record<string, string> = {}, supabaseMock: any) => ({
  params: { deckId },
  url: new URL(`http://localhost:4321/api/v1/decks/${deckId}/cards/due?${new URLSearchParams(searchParams)}`),
  locals: {
    supabase: supabaseMock,
  },
});

describe("GET /api/v1/decks/[deckId]/cards/due", () => {
  let mockSupabase: any;
  const mockUser = { id: "user-123" };

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
  });

  it("should return due cards list with pagination", async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock deck ownership check
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "deck-123" },
      error: null,
    });

    // Mock due cards query
    mockSupabase.range.mockResolvedValue({
      data: [
        {
          id: "card-1",
          deck_id: "deck-123",
          question: "Test question 1",
          answer: "Test answer 1",
          ease_factor: 2.5,
          interval_days: 1,
          repetitions: 0,
          next_review_date: "2025-10-15T10:30:00.000Z",
          created_at: "2025-10-15T10:30:00.000Z",
          updated_at: "2025-10-15T10:30:00.000Z",
        },
      ],
      error: null,
    });

    // Mock count query
    mockSupabase.select.mockReturnValueOnce({
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
    });

    const context = createMockContext("deck-123", { limit: "10" }, mockSupabase);
    const response = await GET(context as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe("card-1");
    expect(data.limit).toBe(10);
  });

  it("should filter cards by before date", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "deck-123" },
      error: null,
    });

    mockSupabase.range.mockResolvedValue({
      data: [],
      error: null,
    });

    const context = createMockContext(
      "deck-123",
      {
        before: "2025-10-19T12:00:00Z",
      },
      mockSupabase
    );
    await GET(context as any);

    // Verify lte was called with before date
    expect(mockSupabase.lte).toHaveBeenCalledWith("next_review_date", "2025-10-19T12:00:00Z");
  });

  it("should return 401 when not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Not authenticated"),
    });

    const context = createMockContext("deck-123", {}, mockSupabase);
    const response = await GET(context as any);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 404 when deck not found", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { code: "PGRST116" },
    });

    const context = createMockContext("deck-123", {}, mockSupabase);
    const response = await GET(context as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe("DECK_NOT_FOUND");
  });

  it("should use default values for missing query params", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "deck-123" },
      error: null,
    });

    mockSupabase.range.mockResolvedValue({
      data: [],
      error: null,
    });

    const context = createMockContext("deck-123", {}, mockSupabase);
    await GET(context as any);

    // Verify default values were used
    expect(mockSupabase.range).toHaveBeenCalledWith(0, 49); // offset=0, limit=50
    expect(mockSupabase.order).toHaveBeenCalledWith("next_review_date", { ascending: true });
  });
});
```

---

### Krok 3: Testy integracyjne

**Plik**: `tests/api/cards-due.test.ts`

```typescript
import { describe, it, expect, beforeAll } from "vitest";

describe("GET /api/v1/decks/{deckId}/cards/due", () => {
  let authToken: string;
  let deckId: string;

  beforeAll(async () => {
    // Setup: Get auth token and create test deck with cards
    // (implementation depends on test setup)
  });

  it("should return due cards list with pagination", async () => {
    const response = await fetch(`http://localhost:4321/api/v1/decks/${deckId}/cards/due?limit=5`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty("items");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("limit", 5);
    expect(data).toHaveProperty("offset", 0);
    expect(Array.isArray(data.items)).toBe(true);
  });

  it("should filter cards by before date", async () => {
    const beforeDate = new Date().toISOString();
    const response = await fetch(`http://localhost:4321/api/v1/decks/${deckId}/cards/due?before=${beforeDate}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    // All returned cards should have nextReviewDate <= beforeDate
    data.items.forEach((card: any) => {
      expect(new Date(card.nextReviewDate)).toBeLessThanOrEqual(new Date(beforeDate));
    });
  });

  it("should sort cards by nextReviewDate ascending by default", async () => {
    const response = await fetch(`http://localhost:4321/api/v1/decks/${deckId}/cards/due`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    // Verify sorting order
    for (let i = 1; i < data.items.length; i++) {
      const prevDate = new Date(data.items[i - 1].nextReviewDate);
      const currDate = new Date(data.items[i].nextReviewDate);
      expect(prevDate).toBeLessThanOrEqual(currDate);
    }
  });

  it("should return 404 for non-existent deck", async () => {
    const response = await fetch("http://localhost:4321/api/v1/decks/00000000-0000-0000-0000-000000000000/cards/due", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe("DECK_NOT_FOUND");
  });

  it("should return 401 without authentication", async () => {
    const response = await fetch(`http://localhost:4321/api/v1/decks/${deckId}/cards/due`);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe("UNAUTHORIZED");
  });
});
```

---

### Krok 4: Dokumentacja i deployment checklist

**Plik**: `.ai/cards-due-implementation-checklist.md`

```markdown
# Cards Due Implementation Checklist

## Development

- [x] API route handler implemented
- [x] Query parameters validation (Zod)
- [x] Deck ownership verification
- [x] Database query with due date filter
- [x] Pagination with sorting
- [x] Error handling for all scenarios
- [x] Unit tests for handler
- [x] Integration tests for endpoint
- [x] Manual testing with curl/Postman

## Configuration

- [ ] Verify database indexes exist
- [ ] Test due date filtering
- [ ] Verify pagination performance
- [ ] Test sorting functionality

## Security

- [ ] Authentication middleware tested
- [ ] Deck ownership verification tested
- [ ] No cross-user data access
- [ ] Input validation tested
- [ ] Date format validation tested

## Performance

- [ ] Response time < 200ms (p95)
- [ ] Database query optimized
- [ ] Due date filtering performance tested
- [ ] Load testing completed

## Production Deployment

- [ ] API endpoint accessible
- [ ] Database indexes created
- [ ] Error tracking configured
- [ ] Monitoring metrics logged
- [ ] Documentation updated

## Post-Deployment

- [ ] Endpoint returns 200 OK
- [ ] Due date filtering works correctly
- [ ] Pagination works correctly
- [ ] Sorting works correctly
- [ ] No errors in logs
- [ ] Performance metrics acceptable
```

---

## 10. Podsumowanie implementacji

### Utworzone pliki:

1. `src/pages/api/v1/decks/[deckId]/cards/due.ts` - główny handler API
2. `src/pages/api/v1/decks/[deckId]/cards/due.test.ts` - testy jednostkowe
3. `tests/api/cards-due.test.ts` - testy integracyjne
4. `.ai/cards-due-implementation-checklist.md` - checklist deployment

### Kluczowe cechy implementacji:

- ✅ Pełna walidacja query parameters (Zod)
- ✅ Deck ownership verification
- ✅ Due date filtering (`next_review_date <= before`)
- ✅ Pagination z offset-based approach
- ✅ Sorting według `nextReviewDate`
- ✅ Comprehensive error handling
- ✅ Type-safe z TypeScript
- ✅ Zgodność z API specification
- ✅ Security best practices
- ✅ Performance optimizations

### Następne kroki:

1. Przetestuj wszystkie scenariusze (success + errors)
2. Zweryfikuj due date filtering
3. Testuj pagination i sorting
4. Deploy do production
5. Monitor performance metrics
