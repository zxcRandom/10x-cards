# API Endpoint Implementation Plan: GET /api/v1/decks

## 1. Przegląd punktu końcowego

### Cel

Endpoint zwraca paginowaną listę talii fiszek (decks) należących do zalogowanego użytkownika z opcjonalnym filtrowaniem, sortowaniem i wyszukiwaniem.

### Funkcjonalność

- Uwierzytelnienie użytkownika poprzez Supabase JWT
- Pobieranie talii tylko dla zalogowanego użytkownika (RLS enforcement)
- Paginacja wyników (offset-based)
- Sortowanie po: `createdAt`, `updatedAt`, `name`
- Filtrowanie po: `createdByAi` (boolean)
- Wyszukiwanie case-insensitive po nazwie talii
- Zwrócenie całkowitej liczby wyników dla implementacji UI paginacji

---

## 2. Szczegóły żądania

### Metoda HTTP

`GET`

### Struktura URL

```
/api/v1/decks
```

### Parametry

#### Wymagane parametry

- **Brak** - wszystkie parametry są opcjonalne
- **Uwierzytelnienie**: Token JWT w header `Authorization: Bearer <token>` (wymagane)

#### Opcjonalne parametry (Query String)

| Parametr      | Typ     | Domyślna wartość | Walidacja                            | Opis                                   |
| ------------- | ------- | ---------------- | ------------------------------------ | -------------------------------------- |
| `limit`       | number  | 20               | 1-100 (integer)                      | Liczba wyników na stronę               |
| `offset`      | number  | 0                | >= 0 (integer)                       | Offset dla paginacji                   |
| `sort`        | string  | `createdAt`      | `createdAt` \| `updatedAt` \| `name` | Pole sortowania                        |
| `order`       | string  | `desc`           | `asc` \| `desc`                      | Kierunek sortowania                    |
| `createdByAi` | boolean | undefined        | true \| false                        | Filtr talii utworzonych przez AI       |
| `q`           | string  | undefined        | string (trimmed)                     | Wyszukiwanie case-insensitive w nazwie |

#### Przykłady żądań

**Podstawowe żądanie z domyślnymi parametrami:**

```http
GET /api/v1/decks
Authorization: Bearer eyJhbGc...
```

**Żądanie z paginacją:**

```http
GET /api/v1/decks?limit=50&offset=100
Authorization: Bearer eyJhbGc...
```

**Żądanie z sortowaniem i filtrowaniem:**

```http
GET /api/v1/decks?sort=name&order=asc&createdByAi=true
Authorization: Bearer eyJhbGc...
```

**Żądanie z wyszukiwaniem:**

```http
GET /api/v1/decks?q=geografia&limit=10
Authorization: Bearer eyJhbGc...
```

### Request Body

Nie dotyczy (metoda GET)

### Request Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

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
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}
```

#### DecksListDTO

```typescript
// src/types.ts (już zdefiniowany)
export type DecksListDTO = PaginatedListDTO<DeckDTO>;

// Rozwija się do:
export interface DecksListDTO {
  items: DeckDTO[];
  total: number;
  limit: number;
  offset: number;
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
  };
}
```

#### ValidationErrorResponse

```typescript
// src/types.ts (już zdefiniowany)
export interface ValidationErrorResponse {
  error: {
    code: "VALIDATION_ERROR";
    message: string;
    errors: ValidationError[];
  };
}
```

### Typy wewnętrzne

#### ListDecksOptions (nowy - do DeckService)

```typescript
// src/lib/services/deck.service.ts
interface ListDecksOptions {
  limit: number;
  offset: number;
  sort: "createdAt" | "updatedAt" | "name";
  order: "asc" | "desc";
  createdByAi?: boolean;
  q?: string;
}
```

#### DbDeck

```typescript
// src/types.ts (już zdefiniowany)
export type DbDeck = Tables<"decks">;
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

### Sukces (200 OK)

#### Struktura odpowiedzi

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Geografia świata",
      "createdByAi": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Matematyka - pochodne",
      "createdByAi": false,
      "createdAt": "2024-01-14T08:20:00.000Z",
      "updatedAt": "2024-01-16T12:45:00.000Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

#### Pusta lista (użytkownik nie ma talii)

```json
{
  "items": [],
  "total": 0,
  "limit": 20,
  "offset": 0
}
```

### Błąd walidacji (400 Bad Request)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "errors": [
      {
        "field": "limit",
        "message": "Number must be less than or equal to 100"
      },
      {
        "field": "sort",
        "message": "Invalid enum value. Expected 'createdAt' | 'updatedAt' | 'name'"
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
Client Request
    ↓
[1] Astro API Route Handler (src/pages/api/v1/decks/index.ts)
    ↓
[2] Walidacja query params (Zod schema)
    ├─ Błąd → 400 Bad Request
    └─ OK → dalej
    ↓
[3] Uwierzytelnienie (context.locals.supabase.auth.getUser())
    ├─ Błąd/Brak → 401 Unauthorized
    └─ OK → userId
    ↓
[4] DeckService.listDecks(userId, options)
    ↓
[5] Supabase Query (z RLS)
    ├─ SELECT COUNT(*) WHERE user_id = userId [+ filtry]
    └─ SELECT * WHERE user_id = userId [+ filtry + sort + limit + offset]
    ↓
[6] Mapowanie DbDeck[] → DeckDTO[] (snake_case → camelCase)
    ↓
[7] Konstrukcja DecksListDTO { items, total, limit, offset }
    ↓
[8] Return 200 OK + JSON response
    ↓
Client receives DecksListDTO
```

### Interakcje z bazą danych

#### Query 1: Count total

```sql
SELECT COUNT(*) FROM decks
WHERE user_id = $1
  AND ($2::boolean IS NULL OR created_by_ai = $2)
  AND ($3::text IS NULL OR name ILIKE '%' || $3 || '%');
```

**Parametry:**

- `$1` - userId (z auth)
- `$2` - createdByAi (opcjonalny)
- `$3` - q (search query, opcjonalny)

**Indeks wykorzystany:** `idx_decks_user_id`

#### Query 2: Select items

```sql
SELECT id, name, created_by_ai, created_at, updated_at
FROM decks
WHERE user_id = $1
  AND ($2::boolean IS NULL OR created_by_ai = $2)
  AND ($3::text IS NULL OR name ILIKE '%' || $3 || '%')
ORDER BY {sort_field} {order}
LIMIT $4 OFFSET $5;
```

**Parametry:**

- `$1` - userId
- `$2` - createdByAi (opcjonalny)
- `$3` - q (opcjonalny)
- `$4` - limit
- `$5` - offset

**Indeksy wykorzystane:**

- `idx_decks_user_id` (primary filter)
- Potencjalnie indeksy na `name`, `created_at`, `updated_at` dla sortowania (do oceny wydajności)

### Row Level Security (RLS)

Supabase automatycznie egzekwuje RLS policy dla tabeli `decks`:

```sql
-- Policy dla SELECT
CREATE POLICY "Users can view own decks" ON decks
FOR SELECT USING (user_id = auth.uid());
```

**Ważne**: Używamy `context.locals.supabase` (user-scoped client), który automatycznie aplikuje RLS.

---

## 6. Względy bezpieczeństwa

### 1. Uwierzytelnienie (Authentication)

#### Implementacja

- Sprawdzenie tokenu JWT przez `context.locals.supabase.auth.getUser()`
- Token musi być prawidłowy i nie wygasły
- Zwrócenie 401 Unauthorized jeśli brak tokenu lub jest nieprawidłowy

#### Kod

```typescript
const {
  data: { user },
  error: authError,
} = await context.locals.supabase.auth.getUser();

if (authError || !user) {
  return new Response(
    JSON.stringify({
      error: {
        code: ErrorCode.UNAUTHORIZED,
        message: "Authentication required",
      },
    }),
    {
      status: HttpStatus.UNAUTHORIZED,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

### 2. Autoryzacja (Authorization)

#### Row Level Security (RLS)

- **Automatyczna ochrona**: Supabase RLS zapewnia, że użytkownik widzi tylko swoje talie
- **Policy**: `user_id = auth.uid()`
- **Enforcement**: Przez user-scoped Supabase client (`context.locals.supabase`)

#### Ważne zasady

- ✅ **ZAWSZE** używaj `context.locals.supabase` (NIE globalnego klienta)
- ✅ RLS automatycznie filtruje wyniki - nie można uzyskać dostępu do cudzych danych
- ✅ `user_id` NIE jest zwracany w DeckDTO (security by design)

### 3. Walidacja danych wejściowych

#### Ochrona przed atakami

- **SQL Injection**: Supabase używa prepared statements (bezpieczne)
- **DoS przez duże limity**: Limit max 100 zapobiega przeciążeniu
- **Type coercion attacks**: Zod validation z strict typami

#### Schema walidacyjne

```typescript
const ListDecksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  createdByAi: z.coerce.boolean().optional(),
  q: z.string().trim().optional(),
});
```

### 4. Rate Limiting

#### Specyfikacja

- Globalny limit: 100 req/min per IP i per user
- Dla tego endpointu: standardowy limit (nie ma specjalnych restrykcji jak dla AI)

#### Implementacja (opcjonalna dla MVP)

- Middleware w `src/middleware/index.ts`
- Wykorzystanie Redis lub in-memory store dla liczników
- Zwrócenie 429 Too Many Requests przy przekroczeniu

### 5. Bezpieczeństwo transportu

#### HTTPS

- **Production**: TYLKO HTTPS (konfiguracja na poziomie serwera/reverse proxy)
- **Development**: HTTP dozwolone lokalnie

#### CORS

- **Production**: Tylko dozwolone origins (frontend app)
- **NIE używać** wildcard `*` w production
- Konfiguracja w middleware lub Astro config

### 6. Ochrona danych wrażliwych

#### Co NIE jest zwracane

- `user_id` - nigdy nie jest eksponowane w API response
- Wewnętrzne metadata bazy danych

#### Co jest zwracane

- Tylko publiczne pola: id, name, createdByAi, timestamps
- Wszystkie dane są już przefiltrowane przez RLS (użytkownik widzi tylko swoje)

### 7. Logging i Monitoring

#### Co logować (server-side only)

- Błędy uwierzytelnienia (z IP, bez szczegółów tokenu)
- Błędy bazy danych (pełny stack trace)
- Nietypowe wzorce użycia (np. częste 400 errors)

#### Czego NIE logować

- Tokenów JWT
- Pełnych user credentials
- Szczegółów błędów w response do klienta (tylko w logach serwera)

---

## 7. Obsługa błędów

### Strategia obsługi błędów

#### Zasady

1. **Early returns** - sprawdzaj błędy na początku funkcji
2. **Guard clauses** - walidacja przed główną logiką
3. **Specific error codes** - używaj ErrorCode enum
4. **User-friendly messages** - wiadomości zrozumiałe dla użytkownika
5. **Server-side logging** - pełne szczegóły błędów w logach (NIE w response)

### Katalog błędów

#### 1. 400 Bad Request - Błędy walidacji

**Scenariusze:**

- `limit` poza zakresem 1-100
- `offset` < 0
- `sort` nie jest w: createdAt, updatedAt, name
- `order` nie jest: asc lub desc
- `createdByAi` nie jest boolean
- `q` przekracza maksymalną długość (jeśli ustalimy limit)

**Response:**

```typescript
{
  error: {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Invalid request parameters',
    errors: [
      { field: 'limit', message: 'Number must be less than or equal to 100' }
    ]
  }
}
```

**Implementacja:**

```typescript
const validationResult = ListDecksQuerySchema.safeParse(queryParams);

if (!validationResult.success) {
  const errors = validationResult.error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));

  return new Response(
    JSON.stringify({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid request parameters",
        errors,
      },
    }),
    {
      status: HttpStatus.BAD_REQUEST,
      headers: { "Content-Type": "application/json" },
    }
  );
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
const {
  data: { user },
  error: authError,
} = await context.locals.supabase.auth.getUser();

if (authError || !user) {
  return new Response(
    JSON.stringify({
      error: {
        code: ErrorCode.UNAUTHORIZED,
        message: "Authentication required",
      },
    }),
    {
      status: HttpStatus.UNAUTHORIZED,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

#### 3. 500 Internal Server Error - Błędy serwera

**Scenariusze:**

- Błąd połączenia z bazą danych
- Timeout bazy danych
- Nieoczekiwany błąd w logice serwisu
- Błąd mapowania danych
- Błędy ORM/query builder

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
  const decks = await deckService.listDecks(user.id, options);
  return new Response(JSON.stringify(decks), {
    status: HttpStatus.OK,
    headers: { "Content-Type": "application/json" },
  });
} catch (error) {
  // Log full error server-side
  console.error("Error listing decks:", error);

  // Return generic error to client
  return new Response(
    JSON.stringify({
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: "An unexpected error occurred",
      },
    }),
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

#### 4. Database-specific errors

**Scenariusze:**

- PostgreSQL connection error
- Query timeout
- RLS policy violation (nie powinno się zdarzyć przy prawidłowej implementacji)

**Handling:**

```typescript
// W DeckService
try {
  const { data, error } = await supabase.from("decks").select("*").eq("user_id", userId);
  // ... filters, sort, pagination

  if (error) {
    console.error("Database error:", error);
    throw new Error("Database query failed");
  }

  return data;
} catch (error) {
  // Re-throw with context
  throw new Error(`Failed to list decks: ${error.message}`);
}
```

### Error Response Helper (do stworzenia)

```typescript
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
    headers: { "Content-Type": "application/json" },
  });
}
```

---

## 8. Rozważania dotyczące wydajności

### 1. Wykorzystanie indeksów

#### Istniejące indeksy

- **`idx_decks_user_id`** - PRIMARY optimization dla `WHERE user_id = X`
  - Typ: B-tree
  - Wykorzystanie: Każde query w tym endpoincie

#### Potencjalne dodatkowe indeksy

**Dla sortowania:**

```sql
-- Jeśli sortowanie po name jest wolne
CREATE INDEX idx_decks_user_name ON decks(user_id, name);

-- Jeśli sortowanie po created_at jest wolne
CREATE INDEX idx_decks_user_created ON decks(user_id, created_at);

-- Jeśli sortowanie po updated_at jest wolne
CREATE INDEX idx_decks_user_updated ON decks(user_id, updated_at);
```

**Dla wyszukiwania (ILIKE):**

```sql
-- Full-text search (opcjonalnie)
CREATE INDEX idx_decks_name_trgm ON decks USING gin(name gin_trgm_ops);

-- Lub prosty indeks
CREATE INDEX idx_decks_name_lower ON decks(lower(name));
```

#### Analiza wydajności

Użyj `EXPLAIN ANALYZE` dla różnych kombinacji parametrów:

```sql
EXPLAIN ANALYZE
SELECT id, name, created_by_ai, created_at, updated_at
FROM decks
WHERE user_id = 'xxx'
  AND name ILIKE '%geo%'
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
```

### 2. Paginacja

#### Offset-based pagination

- **Pros**: Prosta implementacja, łatwe przeskakiwanie między stronami
- **Cons**: Wolniejsza dla dużych offsetów (OFFSET 10000 musi przeskanować 10000 wierszy)

#### Dla MVP: Offset pagination jest OK

Powody:

- Użytkownicy nie będą mieli tysięcy talii
- UI zazwyczaj nie pozwala na duże offsety (max kilka stron)
- Prostsza implementacja

#### Przyszła optymalizacja: Cursor-based pagination

Jeśli w przyszłości będzie problem z wydajnością:

```typescript
// Przykład cursor-based
interface CursorPaginationOptions {
  limit: number;
  cursor?: string; // zakodowane last_seen_id + last_seen_value
  sort: "createdAt" | "updatedAt" | "name";
  order: "asc" | "desc";
}
```

### 3. Count query

#### Potencjalny problem

`COUNT(*)` może być kosztowny dla dużych tabel.

#### Dla MVP: Zawsze zwracamy total

Powody:

- Użytkownicy nie będą mieli dziesiątek tysięcy talii
- RLS ogranicza count do danych użytkownika (zazwyczaj < 100-1000 wierszy)
- Total jest potrzebny dla UI paginacji

#### Optymalizacja (opcjonalna)

```typescript
// Pozwól klientowi pominąć count jeśli nie jest potrzebny
interface ListDecksOptions {
  // ... inne opcje
  includeTotal?: boolean; // default true
}
```

Query bez count jest szybszy:

```typescript
if (options.includeTotal) {
  const { count } = await supabase.from("decks").select("*", { count: "exact", head: true }).eq("user_id", userId);
  // ... filters
}
```

### 4. Case-insensitive search (ILIKE)

#### Potencjalny problem

`ILIKE '%search%'` jest wolne bez odpowiedniego indeksu.

#### Dla MVP: ILIKE jest OK

Powody:

- Małe ilości danych (< 1000 talii na użytkownika)
- Search jest opcjonalny (nie każde query go używa)

#### Optymalizacje (przyszłość)

**1. Indeks trigram (pg_trgm):**

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_decks_name_trgm ON decks USING gin(name gin_trgm_ops);
```

**2. Full-text search:**

```sql
ALTER TABLE decks ADD COLUMN name_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', name)) STORED;
CREATE INDEX idx_decks_name_fts ON decks USING gin(name_tsv);
```

**3. Normalized search:**

```sql
-- Dodaj kolumnę z lowercase name
ALTER TABLE decks ADD COLUMN name_lower text
  GENERATED ALWAYS AS (lower(name)) STORED;
CREATE INDEX idx_decks_name_lower ON decks(name_lower);

-- Query
WHERE name_lower LIKE '%' || lower($search) || '%'
```

### 5. N+1 Problem

**Nie dotyczy** tego endpointu - nie ma related entities do załadowania.

### 6. Caching

#### Dla MVP: Brak cachingu

Powody:

- Premature optimization
- Dane użytkownika mogą się często zmieniać (CRUD operations)
- Prostsze debugowanie bez cache

#### Przyszłe rozważania

Jeśli będzie potrzeba:

- **Redis cache** dla frequently accessed lists
- **Cache invalidation** przy CREATE/UPDATE/DELETE operations
- **TTL**: 5-10 minut dla list

```typescript
// Przykład
const cacheKey = `decks:${userId}:${hash(options)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const decks = await db.query(...);
await redis.setex(cacheKey, 300, JSON.stringify(decks)); // 5 min TTL
return decks;
```

### 7. Database connection pooling

#### Supabase

- Automatycznie zarządzane przez Supabase
- Connection pooling włączony domyślnie (PgBouncer)

#### Dla MVP: Brak dodatkowej konfiguracji potrzebnej

### 8. Monitoring i metryki

#### Co monitorować

- **Query duration**: Średni czas odpowiedzi queries
- **Slow queries**: Queries > 1s
- **Error rate**: % błędów 500
- **Cache hit rate**: Jeśli caching zostanie dodany

#### Narzędzia

- Supabase Dashboard (built-in metrics)
- Application Performance Monitoring (APM) - np. Sentry
- Custom logging w production

---

## 9. Etapy wdrożenia

### Etap 1: Przygotowanie struktury plików

**Pliki do stworzenia:**

```
src/
├── pages/
│   └── api/
│       └── v1/
│           └── decks/
│               └── index.ts          # API route handler
├── lib/
│   └── services/
│       └── deck.service.ts           # DeckService z logiką biznesową
└── types.ts                          # Typy już istnieją, ewentualne uzupełnienia
```

**Akcje:**

1. Utworzyć folder `src/pages/api/v1/decks/`
2. Utworzyć plik `src/pages/api/v1/decks/index.ts`
3. Utworzyć folder `src/lib/services/` (jeśli nie istnieje)
4. Utworzyć plik `src/lib/services/deck.service.ts`

---

### Etap 2: Implementacja DeckService

**Plik:** `src/lib/services/deck.service.ts`

**Funkcjonalność:**

1. Interface `ListDecksOptions`
2. Funkcja `mapDeckToDTO()` - transformacja snake_case → camelCase
3. Funkcja `listDecks()` - główna logika

**Kod do implementacji:**

```typescript
import type { SupabaseClient } from "@/db/supabase.client";
import type { Database } from "../../db/database.types";
import type { DeckDTO, DecksListDTO, DbDeck } from "@/types";

export interface ListDecksOptions {
  limit: number;
  offset: number;
  sort: "createdAt" | "updatedAt" | "name";
  order: "asc" | "desc";
  createdByAi?: boolean;
  q?: string;
}

/**
 * Maps database deck row (snake_case) to DTO (camelCase)
 */
function mapDeckToDTO(dbDeck: DbDeck): DeckDTO {
  return {
    id: dbDeck.id,
    name: dbDeck.name,
    createdByAi: dbDeck.created_by_ai,
    createdAt: dbDeck.created_at,
    updatedAt: dbDeck.updated_at,
  };
}

/**
 * DeckService - Business logic for deck operations
 */
export class DeckService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * List decks for a user with filtering, sorting, and pagination
   */
  async listDecks(userId: string, options: ListDecksOptions): Promise<DecksListDTO> {
    const { limit, offset, sort, order, createdByAi, q } = options;

    // Map sort field from camelCase to snake_case
    const sortField = sort === "createdAt" ? "created_at" : sort === "updatedAt" ? "updated_at" : "name";

    // Build base query
    let query = this.supabase.from("decks").select("*", { count: "exact" }).eq("user_id", userId);

    // Apply filters
    if (createdByAi !== undefined) {
      query = query.eq("created_by_ai", createdByAi);
    }

    if (q) {
      query = query.ilike("name", `%${q}%`);
    }

    // Apply sorting and pagination
    query = query.order(sortField, { ascending: order === "asc" }).range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error("Database error in listDecks:", error);
      throw new Error(`Failed to fetch decks: ${error.message}`);
    }

    // Map results to DTOs
    const items = (data || []).map(mapDeckToDTO);

    return {
      items,
      total: count ?? 0,
      limit,
      offset,
    };
  }
}
```

**Testowanie:**

- Utworzyć unit testy dla `mapDeckToDTO()`
- Utworzyć integration testy dla `listDecks()` z mock Supabase client

---

### Etap 3: Implementacja Zod validation schema

**Plik:** `src/pages/api/v1/decks/index.ts`

**Kod do implementacji:**

```typescript
import { z } from "zod";

/**
 * Validation schema for GET /api/v1/decks query parameters
 */
const ListDecksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1, "Limit must be at least 1").max(100, "Limit must not exceed 100").default(20),

  offset: z.coerce.number().int().min(0, "Offset must be non-negative").default(0),

  sort: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),

  order: z.enum(["asc", "desc"]).default("desc"),

  createdByAi: z.coerce.boolean().optional(),

  q: z.string().trim().optional(),
});

export type ListDecksQuery = z.infer<typeof ListDecksQuerySchema>;
```

**Uwagi:**

- `z.coerce.number()` - konwertuje string query params na number
- `z.coerce.boolean()` - konwertuje "true"/"false" na boolean
- `.default()` - ustawia wartości domyślne zgodnie ze specyfikacją
- `.trim()` - usuwa whitespace z search query

---

### Etap 4: Implementacja API route handler

**Plik:** `src/pages/api/v1/decks/index.ts`

**Struktura:**

1. Disable prerendering
2. Zaimportować zależności
3. GET handler z:
   - Walidacją query params
   - Uwierzytelnieniem
   - Wywołaniem DeckService
   - Obsługą błędów

**Kod do implementacji:**

```typescript
export const prerender = false;

import type { APIContext } from "astro";
import { z } from "zod";
import { DeckService } from "../../../../lib/services/deck.service";
import { HttpStatus, ErrorCode, type DecksListDTO, type ErrorResponse, type ValidationErrorResponse } from "@/types";

/**
 * Validation schema for GET /api/v1/decks query parameters
 */
const ListDecksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  createdByAi: z.coerce.boolean().optional(),
  q: z.string().trim().optional(),
});

/**
 * GET /api/v1/decks
 * List authenticated user's decks with filtering, sorting, and pagination
 */
export async function GET(context: APIContext): Promise<Response> {
  try {
    // Step 1: Parse and validate query parameters
    const url = new URL(context.request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const validationResult = ListDecksQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join(".") || "unknown",
        message: err.message,
      }));

      const errorResponse: ValidationErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request parameters",
          errors,
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: HttpStatus.BAD_REQUEST,
        headers: { "Content-Type": "application/json" },
      });
    }

    const options = validationResult.data;

    // Step 2: Authenticate user
    const {
      data: { user },
      error: authError,
    } = await context.locals.supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: "Authentication required",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: HttpStatus.UNAUTHORIZED,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 3: Fetch decks using DeckService
    const deckService = new DeckService(context.locals.supabase);
    const decks = await deckService.listDecks(user.id, options);

    // Step 4: Return success response
    return new Response(JSON.stringify(decks), {
      status: HttpStatus.OK,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Step 5: Handle unexpected errors
    console.error("Error in GET /api/v1/decks:", error);

    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: "An unexpected error occurred",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

**Uwagi implementacyjne:**

- Użyj `export const prerender = false` na początku pliku
- Handler jest typu `async function GET(context: APIContext)`
- Używamy `context.locals.supabase` (NIE globalnego klienta)
- Error handling z try-catch na najwyższym poziomie
- Wszystkie błędy są logowane po stronie serwera

---

### Etap 5: Testowanie manualne

**Przygotowanie:**

1. Uruchomić lokalny Supabase (jeśli używamy local dev)
2. Utworzyć test user w Supabase Auth
3. Utworzyć kilka testowych talii dla tego użytkownika
4. Uzyskać JWT token dla test user

**Test cases:**

**1. Basic request (defaults):**

```bash
curl -X GET "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK z listą talii (limit=20, offset=0, sort=createdAt, order=desc)
```

**2. Pagination:**

```bash
curl -X GET "http://localhost:4321/api/v1/decks?limit=5&offset=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK z 5 talii, offset=10
```

**3. Sorting:**

```bash
# Sort by name ascending
curl -X GET "http://localhost:4321/api/v1/decks?sort=name&order=asc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK, talie posortowane alfabetycznie
```

**4. Filtering:**

```bash
# Only AI-generated decks
curl -X GET "http://localhost:4321/api/v1/decks?createdByAi=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK, tylko talie z created_by_ai = true
```

**5. Search:**

```bash
curl -X GET "http://localhost:4321/api/v1/decks?q=geografia" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK, tylko talie zawierające "geografia" w nazwie (case-insensitive)
```

**6. Empty results:**

```bash
curl -X GET "http://localhost:4321/api/v1/decks?q=nonexistent" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK z pustą listą items=[], total=0
```

**7. Validation errors:**

```bash
# Invalid limit
curl -X GET "http://localhost:4321/api/v1/decks?limit=200" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 400 Bad Request z VALIDATION_ERROR

# Invalid sort field
curl -X GET "http://localhost:4321/api/v1/decks?sort=invalid" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 400 Bad Request
```

**8. Authentication errors:**

```bash
# No token
curl -X GET "http://localhost:4321/api/v1/decks"

# Expected: 401 Unauthorized

# Invalid token
curl -X GET "http://localhost:4321/api/v1/decks" \
  -H "Authorization: Bearer invalid_token"

# Expected: 401 Unauthorized
```

**9. Combined filters:**

```bash
curl -X GET "http://localhost:4321/api/v1/decks?createdByAi=true&sort=name&order=asc&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK z AI decks, sorted by name
```

---

### Etap 6: Testy automatyczne

**Test files do stworzenia:**

```
src/
├── lib/
│   └── services/
│       ├── deck.service.ts
│       └── deck.service.test.ts      # Unit testy dla DeckService
└── pages/
    └── api/
        └── v1/
            └── decks/
                ├── index.ts
                └── index.test.ts      # Integration testy dla route
```

**Testy unit (deck.service.test.ts):**

```typescript
import { describe, it, expect, vi } from "vitest";
import { DeckService } from "./deck.service";

describe("DeckService", () => {
  describe("listDecks", () => {
    it("should return paginated decks list", async () => {
      // Mock Supabase client
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "1",
                      user_id: "user1",
                      name: "Deck 1",
                      created_by_ai: false,
                      created_at: "2024-01-01",
                      updated_at: "2024-01-01",
                    },
                  ],
                  count: 1,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const service = new DeckService(mockSupabase as any);
      const result = await service.listDecks("user1", {
        limit: 20,
        offset: 0,
        sort: "createdAt",
        order: "desc",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Deck 1");
      expect(result.total).toBe(1);
    });

    it("should apply search filter", async () => {
      // Test with q parameter
      // ...
    });

    it("should apply createdByAi filter", async () => {
      // Test with createdByAi parameter
      // ...
    });
  });
});
```

**Testy integration (index.test.ts):**

```typescript
import { describe, it, expect } from "vitest";
import { GET } from "./index";

describe("GET /api/v1/decks", () => {
  it("should return 401 if not authenticated", async () => {
    const context = createMockContext({ authenticated: false });
    const response = await GET(context);

    expect(response.status).toBe(401);
  });

  it("should return 200 with decks list", async () => {
    const context = createMockContext({
      authenticated: true,
      userId: "test-user",
    });

    const response = await GET(context);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("total");
  });

  it("should return 400 for invalid limit", async () => {
    const context = createMockContext({
      authenticated: true,
      queryParams: { limit: "200" },
    });

    const response = await GET(context);

    expect(response.status).toBe(400);
  });
});
```

---

### Etap 7: Optymalizacje wydajności (opcjonalne)

**Analiza queries:**

1. Uruchomić `EXPLAIN ANALYZE` na production-like data
2. Sprawdzić czy indeksy są wykorzystywane
3. Zmierzyć czasy odpowiedzi dla różnych scenariuszy

**Potencjalne dodatkowe indeksy:**

```sql
-- Jeśli sortowanie jest wolne
CREATE INDEX IF NOT EXISTS idx_decks_user_created
  ON decks(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_decks_user_updated
  ON decks(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_decks_user_name
  ON decks(user_id, name);

-- Jeśli wyszukiwanie jest wolne
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_decks_name_trgm
  ON decks USING gin(name gin_trgm_ops);
```

**Monitoring:**

- Dodać metryki do Supabase Dashboard
- Monitorować slow queries (> 1s)
- Sprawdzić utilization indeksów

---

### Etap 8: Dokumentacja i deployment

**Dokumentacja:**

1. ✅ Ten plan implementacji (już gotowy)
2. Dodać komentarze JSDoc do funkcji publicznych
3. Dodać przykłady użycia w README (opcjonalnie)

**Code review checklist:**

- [ ] Wszystkie testy przechodzą
- [ ] Kod zgodny z linting rules
- [ ] Error handling zgodny z best practices
- [ ] Security checks (auth, RLS, validation)
- [ ] Performance considerations addressed
- [ ] Types są poprawne i kompletne
- [ ] Brak hardcoded values
- [ ] Logging appropriately configured

**Deployment:**

1. Merge do feature branch
2. Code review
3. Merge do main/master
4. Deploy do staging environment
5. Testy smoke na staging
6. Deploy do production
7. Monitor logs i metrics przez pierwsze 24h

---

## 10. Checklist końcowy

### Przed rozpoczęciem implementacji

- [ ] Przeczytać cały plan implementacji
- [ ] Zrozumieć przepływ danych
- [ ] Zrozumieć security requirements
- [ ] Przygotować środowisko testowe (Supabase local/dev)

### Podczas implementacji

- [ ] Utworzyć strukturę plików (Etap 1)
- [ ] Zaimplementować DeckService (Etap 2)
- [ ] Zaimplementować Zod schema (Etap 3)
- [ ] Zaimplementować API route handler (Etap 4)
- [ ] Przeprowadzić testy manualne (Etap 5)
- [ ] Napisać testy automatyczne (Etap 6)

### Po implementacji

- [ ] Wszystkie testy unit przechodzą
- [ ] Wszystkie testy integration przechodzą
- [ ] Przeprowadzono code review
- [ ] Dokumentacja jest aktualna
- [ ] Performance testing wykonane (Etap 7)
- [ ] Ready for deployment

### Production readiness

- [ ] HTTPS skonfigurowane
- [ ] CORS skonfigurowany prawidłowo
- [ ] Rate limiting wdrożone (opcjonalne dla MVP)
- [ ] Monitoring i alerting skonfigurowane
- [ ] Error logging działa poprawnie
- [ ] RLS policies są aktywne

---

## 11. Kontakt i wsparcie

W razie pytań lub problemów podczas implementacji:

1. Przejrzyj sekcję "Obsługa błędów" w tym planie
2. Sprawdź dokumentację Supabase: https://supabase.com/docs
3. Sprawdź dokumentację Astro: https://docs.astro.build
4. Skontaktuj się z architektem oprogramowania

---

## Appendix A: Przykładowe queries SQL

### Query 1: List decks with all filters

```sql
SELECT
  id,
  name,
  created_by_ai,
  created_at,
  updated_at
FROM decks
WHERE user_id = $1
  AND ($2::boolean IS NULL OR created_by_ai = $2)
  AND ($3::text IS NULL OR name ILIKE '%' || $3 || '%')
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;
```

### Query 2: Count with filters

```sql
SELECT COUNT(*) as total
FROM decks
WHERE user_id = $1
  AND ($2::boolean IS NULL OR created_by_ai = $2)
  AND ($3::text IS NULL OR name ILIKE '%' || $3 || '%');
```

### Query 3: Check index usage

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, created_by_ai, created_at, updated_at
FROM decks
WHERE user_id = 'some-uuid'
  AND name ILIKE '%test%'
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
```

---

## Appendix B: Supabase RLS Policy

```sql
-- Enable RLS on decks table
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own decks
CREATE POLICY "Users can view own decks"
ON decks
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Users can insert their own decks
CREATE POLICY "Users can insert own decks"
ON decks
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own decks
CREATE POLICY "Users can update own decks"
ON decks
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own decks
CREATE POLICY "Users can delete own decks"
ON decks
FOR DELETE
USING (user_id = auth.uid());
```

---

**Koniec planu implementacji**

Ten dokument powinien być używany jako kompleksowy przewodnik podczas implementacji endpointu GET /api/v1/decks. Zachęcamy do zadawania pytań i zgłaszania nejasności przed rozpoczęciem implementacji.
