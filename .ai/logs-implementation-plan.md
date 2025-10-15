# API Endpoint Implementation Plan: GET /api/v1/ai/logs

## 1. Przegląd punktu końcowego

Endpoint `GET /api/v1/ai/logs` umożliwia pobieranie historii generowania fiszek przez AI dla zalogowanego użytkownika. Endpoint zwraca paginowaną listę logów z opcjonalnym filtrowaniem po talii (deck) i zakresie dat.

**Główne funkcjonalności:**
- Lista wszystkich prób generowania AI dla użytkownika
- Paginacja z offset-based pagination (limit/offset)
- Filtrowanie po konkretnej talii (deckId)
- Filtrowanie po zakresie dat (from/to)
- Sortowanie po dacie utworzenia (asc/desc)
- Zwraca zarówno udane jak i nieudane próby generowania

**Kluczowe założenia:**
- Endpoint zwraca 200 OK nawet dla pustej listy (0 logów)
- RLS policies zapewniają że użytkownik widzi tylko swoje logi
- Maksymalny limit to 100 itemów per request (chroni przed dużymi response)
- Total count jest opcjonalny (można pominąć dla lepszej wydajności)

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
GET /api/v1/ai/logs?deckId={uuid}&from={iso}&to={iso}&limit={number}&offset={number}&sort={field}&order={direction}
```

### Headers
```
Authorization: Bearer <supabase_jwt_token>
```

### Query Parameters

Wszystkie parametry są **opcjonalne**.

#### Filtrowanie:
- **deckId** (string, UUID)
  - Filtruj logi dla konkretnej talii
  - Walidacja: UUID format
  - Przykład: `deckId=550e8400-e29b-41d4-a716-446655440000`

- **from** (string, ISO-8601)
  - Filtruj logi od tej daty (inclusive)
  - Walidacja: ISO-8601 datetime format
  - Przykład: `from=2025-01-01T00:00:00Z`

- **to** (string, ISO-8601)
  - Filtruj logi do tej daty (inclusive)
  - Walidacja: ISO-8601 datetime format
  - Przykład: `to=2025-12-31T23:59:59Z`

#### Paginacja:
- **limit** (number)
  - Liczba itemów do zwrócenia
  - Walidacja: integer, zakres 1-100
  - Domyślnie: 20
  - Przykład: `limit=50`

- **offset** (number)
  - Liczba itemów do pominięcia
  - Walidacja: integer, >= 0
  - Domyślnie: 0
  - Przykład: `offset=40`

#### Sortowanie:
- **sort** (string)
  - Pole do sortowania
  - Dozwolone wartości: `createdAt` (jedyne pole sortowalne)
  - Domyślnie: `createdAt`
  - Przykład: `sort=createdAt`

- **order** (string)
  - Kierunek sortowania
  - Dozwolone wartości: `asc`, `desc`
  - Domyślnie: `desc` (najnowsze najpierw)
  - Przykład: `order=asc`

### Przykładowe żądania

**Pobierz ostatnie 20 logów (default)**:
```
GET /api/v1/ai/logs
```

**Pobierz logi dla konkretnej talii**:
```
GET /api/v1/ai/logs?deckId=550e8400-e29b-41d4-a716-446655440000
```

**Pobierz logi z zakresu dat, posortowane od najstarszych**:
```
GET /api/v1/ai/logs?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z&order=asc
```

**Pobierz drugi stronę wyników (paginacja)**:
```
GET /api/v1/ai/logs?limit=50&offset=50
```

**Kombinacja filtrów**:
```
GET /api/v1/ai/logs?deckId=550e8400-e29b-41d4-a716-446655440000&from=2025-10-01T00:00:00Z&limit=10&order=asc
```

## 3. Wykorzystywane typy

### Response DTOs

**AILogsListDTO** (Response) - już zdefiniowany w `src/types.ts`:
```typescript
export type AILogsListDTO = PaginatedListDTO<AILogDTO>;

// Rozwija się do:
interface AILogsListDTO {
  items: AILogDTO[];
  total: number;
  limit: number;
  offset: number;
}
```

**AILogDTO** - już zdefiniowany w `src/types.ts`:
```typescript
export interface AILogDTO {
  id: string;
  deckId: string | null;  // null jeśli deck został usunięty lub generowanie failed
  inputTextLength: number;
  generatedCardsCount: number;
  errorMessage: string | null;  // null jeśli sukces
  createdAt: string;  // ISO-8601
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

**ErrorResponse** - dla błędów 401, 500:
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

**ListLogsFilters** - używany wewnętrznie w AILogService:
```typescript
interface ListLogsFilters {
  deckId?: string;
  from?: string;  // ISO-8601
  to?: string;    // ISO-8601
}

interface ListLogsPagination {
  limit: number;
  offset: number;
}

interface ListLogsSorting {
  sort: 'createdAt';
  order: 'asc' | 'desc';
}
```

### Database Types
Wykorzystywany typ z `src/db/database.types.ts`:
- `DbAILog` = `Tables<'ai_generation_logs'>`

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

**Z wynikami**:
```json
{
  "items": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "deckId": "550e8400-e29b-41d4-a716-446655440000",
      "inputTextLength": 1234,
      "generatedCardsCount": 15,
      "errorMessage": null,
      "createdAt": "2025-10-15T10:30:00.000Z"
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "deckId": null,
      "inputTextLength": 567,
      "generatedCardsCount": 0,
      "errorMessage": "AI request timed out",
      "createdAt": "2025-10-14T15:20:00.000Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**Pusta lista (brak wyników)**:
```json
{
  "items": [],
  "total": 0,
  "limit": 20,
  "offset": 0
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
        "field": "deckId",
        "message": "Invalid UUID format"
      },
      {
        "field": "limit",
        "message": "Limit must be between 1 and 100"
      }
    ]
  }
}
```

**Przykładowe błędy walidacji**:
- `deckId` - invalid UUID format
- `from` / `to` - invalid ISO-8601 format
- `from > to` - date range conflict
- `limit` - not in range 1-100
- `offset` - negative value
- `sort` - invalid field name
- `order` - not 'asc' or 'desc'

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch AI logs",
    "details": "Database error"
  }
}
```

## 5. Przepływ danych

### Architektura wysokiego poziomu

```
Client Request (GET /api/v1/ai/logs?...)
    ↓
API Route Handler (src/pages/api/v1/ai/logs.ts)
    ↓
[1] Middleware (Authentication)
    ↓
[2] Parse & Validate Query Params (Zod)
    ↓
[3] AILogService.listLogs()
    ↓
Supabase Query (with filters, pagination, sorting)
    ↓
[4] Map to DTOs (snake_case → camelCase)
    ↓
[5] Response 200 OK (AILogsListDTO)
```

### Szczegółowy przepływ krok po kroku

#### KROK 1: Autentykacja
1. Middleware Astro sprawdza `Authorization` header
2. Pobiera użytkownika przez `context.locals.supabase.auth.getUser()`
3. Jeśli brak/invalid token → **401 Unauthorized**

#### KROK 2: Walidacja query parameters
1. Handler parsuje query parameters z `request.url`
2. Zod schema waliduje wszystkie parametry:
   ```typescript
   const schema = z.object({
     deckId: z.string().uuid().optional(),
     from: z.string().datetime().optional(),
     to: z.string().datetime().optional(),
     limit: z.coerce.number().int().min(1).max(100).default(20),
     offset: z.coerce.number().int().min(0).default(0),
     sort: z.enum(['createdAt']).default('createdAt'),
     order: z.enum(['asc', 'desc']).default('desc')
   }).refine(
     (data) => !data.from || !data.to || new Date(data.from) <= new Date(data.to),
     { message: "from date must be before or equal to to date" }
   );
   ```
3. Jeśli walidacja niepowodzenie → **400 Bad Request** z field-level errors

#### KROK 3: Pobieranie logów z bazy danych
**AILogService.listLogs(supabase, userId, filters, pagination, sorting)**

1. **Build query**:
   ```typescript
   let query = supabase
     .from('ai_generation_logs')
     .select('*', { count: 'exact' })
     .eq('user_id', userId);
   
   // Apply filters
   if (filters.deckId) {
     query = query.eq('deck_id', filters.deckId);
   }
   if (filters.from) {
     query = query.gte('created_at', filters.from);
   }
   if (filters.to) {
     query = query.lte('created_at', filters.to);
   }
   
   // Apply sorting
   query = query.order('created_at', { ascending: sorting.order === 'asc' });
   
   // Apply pagination
   query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);
   ```

2. **Execute query**:
   - Supabase wykonuje SELECT z WHERE, ORDER BY, LIMIT, OFFSET
   - RLS policy automatycznie filtruje po `user_id = auth.uid()`
   - Count jest zwracany w meta jeśli `count: 'exact'`

3. **Handle errors**:
   - Database connection error → rzuć Error
   - Query error → rzuć Error

#### KROK 4: Mapowanie do DTOs
1. Konwertuj `DbAILog[]` → `AILogDTO[]` (snake_case → camelCase)
2. Użyj istniejącego `mapAILogToDTO()` z poprzedniego planu

#### KROK 5: Zwróć response
```typescript
return new Response(
  JSON.stringify({
    items: mappedLogs,
    total: count,
    limit: pagination.limit,
    offset: pagination.offset
  } satisfies AILogsListDTO),
  {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }
);
```

### Wykorzystanie indeksów

Query optimizer użyje tych indeksów (już istnieją w DB):
- `idx_ai_logs_user_id` - dla filtrowania po user_id (RLS)
- `idx_ai_logs_deck_id` - dla filtrowania po deck_id (jeśli deckId podane)
- `idx_ai_logs_created_at` - dla sortowania i filtrowania po created_at

**Composite index** (opcjonalna optymalizacja):
```sql
CREATE INDEX idx_ai_logs_user_created ON ai_generation_logs(user_id, created_at DESC);
```
Przyspiesza najpopularniejsze query: user's logs sorted by date.

## 6. Względy bezpieczeństwa

### 6.1 Autentykacja
- **Wymagania**: Bearer token (Supabase JWT) w `Authorization` header
- **Weryfikacja**: Middleware wywołuje `context.locals.supabase.auth.getUser()`
- **Token validation**: Automatyczna przez Supabase SDK

### 6.2 Autoryzacja
- **User ownership**: RLS policy wymusza `user_id = auth.uid()`
- **Data isolation**: Użytkownik widzi tylko swoje logi
- **RLS policy**:
  ```sql
  CREATE POLICY "Users can view own AI logs"
  ON ai_generation_logs FOR SELECT
  USING (user_id = auth.uid());
  ```

### 6.3 Input Validation

**Query parameter validation**:
- `deckId`: UUID format (zapobiega SQL injection)
- `from`/`to`: ISO-8601 datetime format
- `limit`: bounded to 1-100 (zapobiega DoS)
- `offset`: non-negative integer
- `sort`: enum (tylko `createdAt`)
- `order`: enum (tylko `asc`/`desc`)
- Cross-field validation: `from <= to`

**No SQL injection risk**:
- Supabase client używa prepared statements
- Wszystkie parametry są typowane i sanitizowane

### 6.4 Rate Limiting

**Standardowe limity** (nie specyficzne dla tego endpointu):
- Global per-user: 100 requests/minute
- Global per-IP: 200 requests/minute

**Nie potrzeba** specjalnego rate limiting jak dla AI endpoints - to prosty read-only endpoint.

### 6.5 Information Disclosure

**Bezpieczne ujawnienie**:
- ✅ `errorMessage` - użytkownik widzi swoje własne błędy
- ✅ `deckId` (może być null) - użytkownik widzi swoje deck IDs
- ✅ `inputTextLength` - użytkownik widzi długość swojego inputu

**Nie ujawniamy**:
- ❌ Internal stack traces
- ❌ Database schema details
- ❌ Other users' data (blocked by RLS)

### 6.6 HTTPS & Transport Security

- **Production**: Wymaga HTTPS (TLS 1.2+)
- **CORS**: Allow only frontend origin(s)

## 7. Obsługa błędów

### 7.1 Scenariusze błędów i kody statusu

#### 200 OK - Success

**Przypadki**:
- Zwrócono logi (1+ items)
- Brak logów (0 items) - to NIE jest błąd!

**Response**: AILogsListDTO z items[] (może być pusta lista)

---

#### 400 Bad Request - Validation Errors

**Przypadki**:
1. Invalid `deckId` format (not UUID)
2. Invalid `from` format (not ISO-8601)
3. Invalid `to` format (not ISO-8601)
4. `from > to` (date range conflict)
5. Invalid `limit` (< 1 or > 100)
6. Invalid `offset` (< 0)
7. Invalid `sort` field (not 'createdAt')
8. Invalid `order` (not 'asc' or 'desc')

**Response**:
```typescript
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    errors: [
      { field: 'deckId', message: 'Invalid UUID format' }
    ]
  }
}
```

**Handler**:
```typescript
try {
  const validated = schema.parse(queryParams);
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
      { status: 400 }
    );
  }
}
```

---

#### 401 Unauthorized - Authentication Failure

**Przypadki**:
1. Brak `Authorization` header
2. Invalid/expired JWT token

**Response**:
```typescript
{
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required'
  }
}
```

**Handler** (w middleware - identyczny jak w poprzednim planie).

---

#### 500 Internal Server Error - System Failures

**Przypadki**:
1. Database connection error
2. Query execution error
3. Unhandled exception

**Response**:
```typescript
{
  error: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to fetch AI logs',
    details: import.meta.env.DEV ? error.message : undefined
  }
}
```

**Handler**:
```typescript
try {
  const result = await AILogService.listLogs(...);
} catch (error) {
  console.error('Failed to fetch AI logs:', error);
  
  return new Response(
    JSON.stringify({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch AI logs',
        details: import.meta.env.DEV && error instanceof Error ? error.message : undefined
      }
    } satisfies ErrorResponse),
    { status: 500 }
  );
}
```

---

### 7.2 Error Logging Strategy

**Application logs** (console/file):
- ✅ Database errors z stack traces
- ✅ Validation errors (summary)
- ✅ Request timing metrics
- ✅ Slow queries (> 1s)

**Monitoring & Alerts**:
- Alert gdy error rate > 5% w 5 min window
- Alert gdy p95 latency > 1s
- Alert gdy database connection failures

**No retry logic needed** - read-only endpoint, idempotent.

## 8. Rozważania dotyczące wydajności

### 8.1 Wąskie gardła

1. **COUNT query** ⚠️
   - Może być wolny dla użytkowników z tysiącami logów
   - COUNT(*) wymaga full table scan (nawet z indexem)
   - Czas: 50-500ms w zależności od liczby rows

2. **Date range filtering**
   - Z indexem `idx_ai_logs_created_at`: ~10-50ms
   - Bez indexu: może być wolne (full scan)

3. **Large offset**
   - Offset-based pagination: database musi skip N rows
   - offset=10000 + limit=100 → database przetwarza 10,100 rows
   - Może być wolne dla dużych offsetów

### 8.2 Optymalizacje

#### 8.2.1 Database Indexes

**Existing indexes** (już w DB):
```sql
CREATE INDEX idx_ai_logs_user_id ON ai_generation_logs(user_id);
CREATE INDEX idx_ai_logs_deck_id ON ai_generation_logs(deck_id);
CREATE INDEX idx_ai_logs_created_at ON ai_generation_logs(created_at);
```

**Recommended composite index**:
```sql
-- Optymalizuje najpopularniejsze query: user's logs sorted by date
CREATE INDEX idx_ai_logs_user_created ON ai_generation_logs(user_id, created_at DESC);

-- Alternatywnie dla covering index (wszystkie pola w index):
CREATE INDEX idx_ai_logs_covering ON ai_generation_logs(user_id, created_at DESC) 
  INCLUDE (id, deck_id, input_text_length, generated_cards_count, error_message);
```

#### 8.2.2 Optional COUNT

**Problem**: COUNT(*) jest wolny dla dużych tabel.

**Rozwiązanie**: Opcjonalny `includeTotal` query parameter:
```typescript
includeTotal?: boolean (default: true)
```

```typescript
// W Zod schema
includeTotal: z.coerce.boolean().default(true)

// W query
const selectOptions = filters.includeTotal 
  ? { count: 'exact' } 
  : {};

const { data, count } = await supabase
  .from('ai_generation_logs')
  .select('*', selectOptions)
  // ...

return {
  items: data,
  total: count ?? null,  // null if includeTotal=false
  limit,
  offset
};
```

**Korzyści**:
- Client który robi infinite scroll nie potrzebuje total
- Response ~100ms zamiast ~500ms

#### 8.2.3 Cursor-based Pagination (Future)

**Problem**: Offset-based pagination jest wolny dla dużych offsetów.

**Rozwiązanie**: Cursor-based pagination z `created_at` jako cursor:
```typescript
// Request
GET /api/v1/ai/logs?cursor=2025-10-15T10:30:00Z&limit=20

// Response
{
  items: [...],
  nextCursor: "2025-10-14T15:20:00Z",
  hasMore: true
}
```

**Query**:
```typescript
query.lt('created_at', cursor).limit(limit)
```

**Korzyści**:
- Constant-time performance niezależnie od pozycji w datasecie
- Bardziej efektywne dla infinite scroll UX

#### 8.2.4 Response Size Optimization

**Current**:
- Max 100 items × ~150 bytes/item = ~15KB
- Gzip compression: ~5KB

**Already optimal** - nie potrzeba dodatkowych optymalizacji.

#### 8.2.5 Caching Strategy

**Read-through cache** (opcjonalnie, dla heavy traffic):
```typescript
// Cache key: `ai-logs:${userId}:${hash(filters)}`
// TTL: 5 minutes
// Invalidate on: nowy AI generation log dla user

const cacheKey = `ai-logs:${userId}:${hashFilters(filters)}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const result = await AILogService.listLogs(...);
await redis.setex(cacheKey, 300, JSON.stringify(result));

return result;
```

**Kiedy to warto**:
- Dashboard który często odpytuje ten endpoint
- Heavy read traffic
- Logi rzadko się zmieniają

**Kiedy NIE warto**:
- Low traffic
- Użytkownicy często generują nowe decks (stale invalidation)

### 8.3 Query Performance Expectations

**Z odpowiednimi indexami**:
- Simple query (no filters): 10-30ms
- With deckId filter: 10-30ms
- With date range: 20-50ms
- With COUNT: +50-200ms
- Total: 50-300ms

**Slow query threshold**: > 500ms → log warning

### 8.4 Monitoring Metrics

**Track**:
- Request duration (p50, p95, p99)
- Database query duration
- COUNT query duration (separately)
- Result set sizes (avg items per request)
- Filter usage (% requests with deckId, date filters)
- Offset distribution (detect large offsets)

**Alerting**:
- p95 latency > 1s → Warning
- Error rate > 5% → Alert
- Database connection failures → Critical

## 9. Kroki implementacji

### Krok 1: Stwórz Zod validation schema dla query params

**Plik**: `src/pages/api/v1/ai/logs.schema.ts`

```typescript
import { z } from 'zod';

/**
 * Validation schema for GET /api/v1/ai/logs query parameters
 */
export const listAILogsQuerySchema = z.object({
  // Filters
  deckId: z.string()
    .uuid('Invalid deck ID format')
    .optional(),
  
  from: z.string()
    .datetime('Invalid from date format. Use ISO-8601.')
    .optional(),
  
  to: z.string()
    .datetime('Invalid to date format. Use ISO-8601.')
    .optional(),
  
  // Pagination
  limit: z.coerce.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must not exceed 100')
    .default(20),
  
  offset: z.coerce.number()
    .int('Offset must be an integer')
    .min(0, 'Offset must be non-negative')
    .default(0),
  
  // Sorting
  sort: z.enum(['createdAt'], {
    errorMap: () => ({ message: 'Sort field must be "createdAt"' })
  }).default('createdAt'),
  
  order: z.enum(['asc', 'desc'], {
    errorMap: () => ({ message: 'Order must be "asc" or "desc"' })
  }).default('desc'),
  
  // Optional performance optimization
  includeTotal: z.coerce.boolean()
    .default(true)
}).refine(
  (data) => {
    // Validate date range: from <= to
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  },
  {
    message: 'from date must be before or equal to to date',
    path: ['from']
  }
);

export type ListAILogsQuery = z.infer<typeof listAILogsQuerySchema>;
```

**Testy** (opcjonalnie):
```typescript
import { describe, it, expect } from 'vitest';
import { listAILogsQuerySchema } from './logs.schema';

describe('listAILogsQuerySchema', () => {
  it('should accept valid query', () => {
    const valid = {
      deckId: '550e8400-e29b-41d4-a716-446655440000',
      from: '2025-01-01T00:00:00Z',
      to: '2025-12-31T23:59:59Z',
      limit: 50,
      offset: 10,
      order: 'asc'
    };
    expect(() => listAILogsQuerySchema.parse(valid)).not.toThrow();
  });

  it('should use defaults', () => {
    const result = listAILogsQuerySchema.parse({});
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
    expect(result.sort).toBe('createdAt');
    expect(result.order).toBe('desc');
  });

  it('should reject invalid UUID', () => {
    expect(() => 
      listAILogsQuerySchema.parse({ deckId: 'not-a-uuid' })
    ).toThrow('Invalid deck ID format');
  });

  it('should reject invalid date range', () => {
    expect(() => 
      listAILogsQuerySchema.parse({
        from: '2025-12-31T00:00:00Z',
        to: '2025-01-01T00:00:00Z'
      })
    ).toThrow('from date must be before');
  });

  it('should reject limit > 100', () => {
    expect(() => 
      listAILogsQuerySchema.parse({ limit: 101 })
    ).toThrow('Limit must not exceed 100');
  });
});
```

---

### Krok 2: Rozszerz AILogService o listLogs()

**Plik**: `src/lib/services/ai-log.service.ts` (rozszerzenie istniejącego)

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbAILog, AILogDTO, AILogsListDTO } from '../../types';
import { mapAILogToDTO } from './mappers';

export interface CreateAILogData {
  user_id: string;
  deck_id: string | null;
  input_text_length: number;
  generated_cards_count: number;
  error_message: string | null;
}

export interface ListLogsFilters {
  deckId?: string;
  from?: string;  // ISO-8601
  to?: string;    // ISO-8601
}

export interface ListLogsPagination {
  limit: number;
  offset: number;
}

export interface ListLogsSorting {
  sort: 'createdAt';
  order: 'asc' | 'desc';
}

export interface ListLogsOptions {
  filters: ListLogsFilters;
  pagination: ListLogsPagination;
  sorting: ListLogsSorting;
  includeTotal: boolean;
}

export class AILogService {
  /**
   * Create AI generation log entry
   */
  static async createLog(
    supabase: SupabaseClient,
    data: CreateAILogData
  ): Promise<DbAILog> {
    const { data: log, error } = await supabase
      .from('ai_generation_logs')
      .insert({
        user_id: data.user_id,
        deck_id: data.deck_id,
        input_text_length: data.input_text_length,
        generated_cards_count: data.generated_cards_count,
        error_message: data.error_message
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create AI log:', error);
      throw new Error(`Failed to create AI log: ${error.message}`);
    }

    return log;
  }

  /**
   * List AI generation logs for user with filters, pagination, and sorting
   */
  static async listLogs(
    supabase: SupabaseClient,
    userId: string,
    options: ListLogsOptions
  ): Promise<AILogsListDTO> {
    const { filters, pagination, sorting, includeTotal } = options;

    // Build base query
    let query = supabase
      .from('ai_generation_logs')
      .select('*', includeTotal ? { count: 'exact' } : {})
      .eq('user_id', userId);

    // Apply filters
    if (filters.deckId) {
      query = query.eq('deck_id', filters.deckId);
    }
    if (filters.from) {
      query = query.gte('created_at', filters.from);
    }
    if (filters.to) {
      query = query.lte('created_at', filters.to);
    }

    // Apply sorting
    query = query.order('created_at', { ascending: sorting.order === 'asc' });

    // Apply pagination
    const rangeEnd = pagination.offset + pagination.limit - 1;
    query = query.range(pagination.offset, rangeEnd);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to list AI logs:', error);
      throw new Error(`Failed to list AI logs: ${error.message}`);
    }

    // Map to DTOs
    const items = (data || []).map(mapAILogToDTO);

    return {
      items,
      total: includeTotal ? (count ?? 0) : 0,
      limit: pagination.limit,
      offset: pagination.offset
    };
  }

  /**
   * Get single AI log by ID (with ownership check)
   */
  static async getLogById(
    supabase: SupabaseClient,
    logId: string,
    userId: string
  ): Promise<DbAILog | null> {
    const { data, error } = await supabase
      .from('ai_generation_logs')
      .select()
      .eq('id', logId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Failed to get AI log:', error);
      throw new Error(`Failed to get AI log: ${error.message}`);
    }

    return data;
  }
}
```

**Uwaga**: Funkcja `mapAILogToDTO()` już istnieje w `src/lib/services/mappers.ts` (stworzona w poprzednim planie).

---

### Krok 3: Stwórz API Route Handler

**Plik**: `src/pages/api/v1/ai/logs.ts`

```typescript
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { listAILogsQuerySchema } from './logs.schema';
import { AILogService } from '../../../lib/services/ai-log.service';
import type { 
  AILogsListDTO,
  ErrorResponse, 
  ValidationErrorResponse 
} from '../../../types';

/**
 * GET /api/v1/ai/logs
 * List AI generation logs for authenticated user
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();

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
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // STEP 2: Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = {
      deckId: url.searchParams.get('deckId') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      limit: url.searchParams.get('limit') || undefined,
      offset: url.searchParams.get('offset') || undefined,
      sort: url.searchParams.get('sort') || undefined,
      order: url.searchParams.get('order') || undefined,
      includeTotal: url.searchParams.get('includeTotal') || undefined
    };

    let validated;
    try {
      validated = listAILogsQuerySchema.parse(queryParams);
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
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      throw error;
    }

    // STEP 3: Fetch logs from database
    const result = await AILogService.listLogs(
      locals.supabase,
      user.id,
      {
        filters: {
          deckId: validated.deckId,
          from: validated.from,
          to: validated.to
        },
        pagination: {
          limit: validated.limit,
          offset: validated.offset
        },
        sorting: {
          sort: validated.sort,
          order: validated.order
        },
        includeTotal: validated.includeTotal
      }
    );

    const duration = Date.now() - startTime;
    console.log(`GET /api/v1/ai/logs completed in ${duration}ms (${result.items.length} items)`);

    // STEP 4: Return success response
    return new Response(
      JSON.stringify(result satisfies AILogsListDTO),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Duration': duration.toString()
        }
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`GET /api/v1/ai/logs failed after ${duration}ms:`, error);

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch AI logs',
          details: import.meta.env.DEV && error instanceof Error ? error.message : undefined
        }
      } satisfies ErrorResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

// Disable prerendering for API route
export const prerender = false;
```

---

### Krok 4: Dodaj composite index (opcjonalnie, dla performance)

**Plik**: `supabase/migrations/[timestamp]_add_ai_logs_composite_index.sql`

```sql
-- Add composite index for optimized user logs queries
-- This covers the most common query pattern: user's logs sorted by date

CREATE INDEX IF NOT EXISTS idx_ai_logs_user_created 
ON ai_generation_logs(user_id, created_at DESC);

-- Optional: Add covering index if queries are still slow
-- Uncomment if needed after performance testing

-- CREATE INDEX IF NOT EXISTS idx_ai_logs_covering 
-- ON ai_generation_logs(user_id, created_at DESC) 
-- INCLUDE (id, deck_id, input_text_length, generated_cards_count, error_message);

-- Add comment for documentation
COMMENT ON INDEX idx_ai_logs_user_created IS 
'Optimizes GET /api/v1/ai/logs queries for user logs sorted by created_at';
```

**Zastosuj migrację**:
```bash
# Local development
npx supabase db push

# Production
# Deploy via Supabase dashboard or CI/CD
```

---

### Krok 5: Testy integracyjne

**Plik**: `tests/api/ai-logs.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('GET /api/v1/ai/logs', () => {
  let authToken: string;
  let testDeckId: string;

  beforeAll(async () => {
    // Setup: Get auth token and create test data
    // (implementation depends on test setup)
  });

  it('should return logs for authenticated user', async () => {
    const response = await fetch('http://localhost:4321/api/v1/ai/logs', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('limit');
    expect(data).toHaveProperty('offset');
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('should filter by deckId', async () => {
    const response = await fetch(
      `http://localhost:4321/api/v1/ai/logs?deckId=${testDeckId}`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    
    // All items should have matching deckId
    data.items.forEach((log: any) => {
      expect(log.deckId).toBe(testDeckId);
    });
  });

  it('should filter by date range', async () => {
    const from = '2025-01-01T00:00:00Z';
    const to = '2025-12-31T23:59:59Z';
    
    const response = await fetch(
      `http://localhost:4321/api/v1/ai/logs?from=${from}&to=${to}`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    
    data.items.forEach((log: any) => {
      const createdAt = new Date(log.createdAt);
      expect(createdAt >= new Date(from)).toBe(true);
      expect(createdAt <= new Date(to)).toBe(true);
    });
  });

  it('should respect pagination', async () => {
    const response = await fetch(
      'http://localhost:4321/api/v1/ai/logs?limit=5&offset=0',
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.items.length).toBeLessThanOrEqual(5);
    expect(data.limit).toBe(5);
    expect(data.offset).toBe(0);
  });

  it('should sort ascending', async () => {
    const response = await fetch(
      'http://localhost:4321/api/v1/ai/logs?order=asc&limit=10',
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Check ascending order
    for (let i = 1; i < data.items.length; i++) {
      const prev = new Date(data.items[i - 1].createdAt);
      const curr = new Date(data.items[i].createdAt);
      expect(prev <= curr).toBe(true);
    }
  });

  it('should reject invalid deckId', async () => {
    const response = await fetch(
      'http://localhost:4321/api/v1/ai/logs?deckId=not-a-uuid',
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject invalid date range', async () => {
    const response = await fetch(
      'http://localhost:4321/api/v1/ai/logs?from=2025-12-31T00:00:00Z&to=2025-01-01T00:00:00Z',
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should require authentication', async () => {
    const response = await fetch('http://localhost:4321/api/v1/ai/logs');

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should return empty list for user with no logs', async () => {
    // Test with fresh user account
    const response = await fetch('http://localhost:4321/api/v1/ai/logs', {
      headers: { 'Authorization': `Bearer ${freshUserToken}` }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toEqual([]);
    expect(data.total).toBe(0);
  });
});
```

---

### Krok 6: Manualne testy z curl/Postman

**Test 1: Basic request (default params)**
```bash
curl -X GET "http://localhost:4321/api/v1/ai/logs" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test 2: With filters**
```bash
curl -X GET "http://localhost:4321/api/v1/ai/logs?deckId=550e8400-e29b-41d4-a716-446655440000&limit=10&order=asc" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test 3: Date range**
```bash
curl -X GET "http://localhost:4321/api/v1/ai/logs?from=2025-01-01T00:00:00Z&to=2025-12-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test 4: Pagination**
```bash
# Page 1
curl -X GET "http://localhost:4321/api/v1/ai/logs?limit=20&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Page 2
curl -X GET "http://localhost:4321/api/v1/ai/logs?limit=20&offset=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test 5: Invalid params (expect 400)**
```bash
curl -X GET "http://localhost:4321/api/v1/ai/logs?deckId=invalid-uuid" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test 6: No auth (expect 401)**
```bash
curl -X GET "http://localhost:4321/api/v1/ai/logs"
```

---

### Krok 7: Dokumentacja i deployment checklist

**Plik**: `.ai/api-implementation-checklist.md` (dodaj nową sekcję)

```markdown
## GET /api/v1/ai/logs Implementation Checklist

### Development
- [x] Zod validation schema created (logs.schema.ts)
- [x] AILogService.listLogs() implemented
- [x] API route handler created (logs.ts)
- [x] Error handling for all scenarios
- [ ] Unit tests for AILogService
- [ ] Integration tests for API endpoint
- [ ] Manual testing with curl/Postman

### Database
- [ ] Verify ai_generation_logs table exists
- [ ] Verify RLS policy for SELECT is enabled
- [ ] Verify existing indexes (user_id, deck_id, created_at)
- [ ] Apply composite index migration (optional, for performance)
- [ ] Test query performance with large datasets

### Security
- [ ] Auth middleware tested
- [ ] Input validation tested (Zod)
- [ ] RLS policy verified (user sees only own logs)
- [ ] No sensitive data leakage

### Performance
- [ ] Query performance tested (< 300ms p95)
- [ ] Large offset handling tested
- [ ] includeTotal=false optimization tested
- [ ] Composite index improves query time
- [ ] Slow query logging configured (> 500ms)

### Production Deployment
- [ ] API endpoint accessible
- [ ] Composite index applied
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Team notified

### Post-Deployment
- [ ] Monitor query performance
- [ ] Check slow query logs
- [ ] Verify filter usage patterns
- [ ] Consider cursor pagination if needed
```

---

### Krok 8: Finalizacja

1. **Update API documentation** - dodaj przykłady query params
2. **Performance testing** - test z dużymi datasetami
3. **Monitor metrics** - track query performance w production
4. **Consider caching** - jeśli read traffic jest wysoki

---

## 10. Podsumowanie implementacji

### Utworzone pliki:
1. `src/pages/api/v1/ai/logs.ts` - główny GET handler
2. `src/pages/api/v1/ai/logs.schema.ts` - Zod validation dla query params
3. `src/lib/services/ai-log.service.ts` - rozszerzenie o listLogs() method
4. `supabase/migrations/[timestamp]_add_ai_logs_composite_index.sql` - performance optimization

### Kluczowe cechy implementacji:
- ✅ Pełna walidacja query params (Zod)
- ✅ Filtrowanie (deckId, date range)
- ✅ Paginacja (offset-based)
- ✅ Sortowanie (created_at asc/desc)
- ✅ Optional includeTotal dla performance
- ✅ Composite index dla wydajności
- ✅ RLS policy enforcement
- ✅ Comprehensive error handling
- ✅ Type-safe z TypeScript
- ✅ Zgodność z API specification

### Optymalizacje wydajności:
- 🚀 Composite index: (user_id, created_at)
- 🚀 Optional COUNT query (includeTotal)
- 🚀 Query performance: 50-300ms
- 🚀 Max 100 items per request
- 🚀 Ready for cursor pagination upgrade

### Następne kroki:
1. Przetestuj wszystkie filtry i edge cases
2. Zastosuj composite index w DB
3. Monitor performance w production
4. Rozważ cursor pagination dla heavy users
5. Dodaj caching jeśli potrzeba

