# API Endpoint Implementation Plan: POST /api/v1/ai/decks/from-text

## 1. Przegląd punktu końcowego

Endpoint `POST /api/v1/ai/decks/from-text` umożliwia generowanie talii fiszek (deck) wraz z pytaniami i odpowiedziami (cards) na podstawie tekstu wejściowego dostarczonego przez użytkownika. Wykorzystuje integrację z AI (OpenRouter API) do automatycznego tworzenia wysokiej jakości fiszek edukacyjnych.

**Główne funkcjonalności:**
- Przyjmuje tekst wejściowy od użytkownika (np. notatki, artykuł, dokumentację)
- Wywołuje AI model przez OpenRouter API do wygenerowania fiszek
- Tworzy nową talię z flagą `created_by_ai = true`
- Dodaje wygenerowane fiszki do talii
- Loguje próbę generowania w tabeli `ai_generation_logs` (zarówno sukces jak i porażkę)
- Obsługuje rate limiting i quota controls dla ochrony przed nadużyciami

**Kluczowe założenia:**
- Endpoint ZAWSZE zwraca 201 Created przy pomyślnej operacji, nawet jeśli AI wygenerował 0 fiszek
- Błędy AI są logowane do `ai_generation_logs` z `error_message`
- Operacja jest atomowa - albo wszystko się powiedzie, albo nic (transakcja DB)
- Rate limiting jest bardziej restrykcyjny niż dla innych endpointów (10 req/min, daily quota)

## 2. Szczegóły żądania

### Metoda HTTP
`POST`

### Struktura URL
```
POST /api/v1/ai/decks/from-text
```

### Headers
```
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

### Request Body Schema

```typescript
{
  "inputText": string,      // WYMAGANE
  "deckName"?: string,       // OPCJONALNE
  "maxCards"?: number        // OPCJONALNE
}
```

### Parametry

#### Wymagane:
- **inputText** (string)
  - Tekst źródłowy do analizy przez AI
  - Walidacja: trimmed, non-empty, długość 1-20,000 znaków
  - Przykład: "Photosynthesis is the process by which plants convert light energy into chemical energy..."

#### Opcjonalne:
- **deckName** (string)
  - Nazwa dla nowo utworzonej talii
  - Walidacja: trimmed, non-empty, długość 1-255 znaków
  - Domyślnie: jeśli nie podano, generuje nazwę "AI Generated Deck - [ISO timestamp]"
  - Przykład: "Biology - Photosynthesis"

- **maxCards** (number)
  - Maksymalna liczba fiszek do wygenerowania
  - Walidacja: integer, zakres 1-100
  - Domyślnie: 20
  - Przykład: 50

### Przykładowe żądanie

```json
{
  "inputText": "JavaScript is a high-level, interpreted programming language. It was created by Brendan Eich in 1995. JavaScript is primarily used for web development and runs in the browser. Node.js allows JavaScript to run on the server side.",
  "deckName": "JavaScript Basics",
  "maxCards": 10
}
```

## 3. Wykorzystywane typy

### Command Models

**CreateAIDeckCommand** (Request) - już zdefiniowany w `src/types.ts`:
```typescript
export interface CreateAIDeckCommand {
  inputText: string;
  deckName?: string;
  maxCards?: number;
}
```

### Response DTOs

**AIDeckResponseDTO** (Response) - już zdefiniowany w `src/types.ts`:
```typescript
export interface AIDeckResponseDTO {
  deck: DeckDTO;
  cards: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
  log: AILogDTO;
}
```

Gdzie:
- **DeckDTO**: `{ id, name, createdByAi, createdAt, updatedAt }`
- **AILogDTO**: `{ id, deckId, inputTextLength, generatedCardsCount, errorMessage, createdAt }`

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

**ErrorResponse** - dla błędów 401, 429, 500:
```typescript
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
  }
}
```

**UnprocessableErrorResponse** - dla błędu 422:
```typescript
export interface UnprocessableErrorResponse {
  error: {
    code: 'UNPROCESSABLE_ENTITY';
    message: string;
    details?: string;
  }
}
```

### Internal Service Types

**GeneratedCard** - używany wewnętrznie w AIService:
```typescript
interface GeneratedCard {
  question: string;
  answer: string;
}
```

### Database Types
Wykorzystywane typy z `src/db/database.types.ts`:
- `DbDeck` = `Tables<'decks'>`
- `DbCard` = `Tables<'cards'>`
- `DbAILog` = `Tables<'ai_generation_logs'>`

## 4. Szczegóły odpowiedzi

### Success Response (201 Created)

```json
{
  "deck": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "JavaScript Basics",
    "createdByAi": true,
    "createdAt": "2025-10-15T10:30:00.000Z",
    "updatedAt": "2025-10-15T10:30:00.000Z"
  },
  "cards": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "question": "What is JavaScript?",
      "answer": "JavaScript is a high-level, interpreted programming language primarily used for web development."
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "question": "Who created JavaScript and when?",
      "answer": "JavaScript was created by Brendan Eich in 1995."
    }
  ],
  "log": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "deckId": "550e8400-e29b-41d4-a716-446655440000",
    "inputTextLength": 234,
    "generatedCardsCount": 2,
    "errorMessage": null,
    "createdAt": "2025-10-15T10:30:00.000Z"
  }
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
        "field": "inputText",
        "message": "Input text must be between 1 and 20000 characters"
      },
      {
        "field": "maxCards",
        "message": "Max cards must be between 1 and 100"
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

#### 422 Unprocessable Entity
```json
{
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Failed to parse AI response",
    "details": "AI returned invalid card format"
  }
}
```

#### 429 Too Many Requests
```json
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Rate limit exceeded. Please try again later.",
    "details": "AI endpoint limit: 10 requests per minute"
  }
}
```
**Headers**: `Retry-After: 60` (seconds)

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to generate deck from text",
    "details": "AI service timeout"
  }
}
```

**Uwaga specjalna**: Jeśli AI zwróci 0 fiszek (ale operacja się powiodła), zwracamy 201 z pustą tablicą `cards: []` i `errorMessage: null` w logu.

## 5. Przepływ danych

### Architektura wysokiego poziomu

```
Client Request
    ↓
API Route Handler (src/pages/api/v1/ai/decks/from-text.ts)
    ↓
[1] Middleware (Auth + Rate Limiting)
    ↓
[2] Zod Validation
    ↓
[3] AIDeckGenerationService.generateDeckFromText()
    ├─→ [3a] AIService.generateFlashcardsFromText()
    │        ↓
    │   OpenRouter API Call (external)
    │        ↓
    │   Parse & Validate Response
    │        ↓
    │   Return GeneratedCard[]
    │
    ├─→ [3b] Database Transaction
    │   ├─→ DeckService.createDeck()
    │   ├─→ CardService.createCards() [batch insert]
    │   └─→ AILogService.createLog()
    │
    └─→ [3c] Map to DTOs (snake_case → camelCase)
    ↓
[4] Response 201 Created (AIDeckResponseDTO)
```

### Szczegółowy przepływ krok po kroku

#### KROK 1: Autentykacja i Rate Limiting
1. Middleware Astro (`src/middleware/index.ts`) sprawdza `Authorization` header
2. Pobiera użytkownika przez `context.locals.supabase.auth.getUser()`
3. Jeśli brak/invalid token → **401 Unauthorized**
4. Rate limiter sprawdza limity:
   - Per-user: 10 requests/minute
   - Per-user daily: 50 requests/day (opcjonalnie)
5. Jeśli przekroczono limit → **429 Too Many Requests** z `Retry-After` header

#### KROK 2: Walidacja wejścia
1. Handler parsuje `request.json()` do `CreateAIDeckCommand`
2. Zod schema waliduje:
   ```typescript
   const schema = z.object({
     inputText: z.string().trim().min(1).max(20000),
     deckName: z.string().trim().min(1).max(255).optional(),
     maxCards: z.number().int().min(1).max(100).default(20)
   });
   ```
3. Jeśli walidacja niepowodzenie → **400 Bad Request** z field-level errors
4. Jeśli `deckName` nie podano, generuje domyślną nazwę

#### KROK 3: Generowanie fiszek przez AI
**AIService.generateFlashcardsFromText(inputText, maxCards)**

1. **Budowanie promptu**:
   ```
   System: You are an expert educator creating flashcards.
   User: Generate up to {maxCards} flashcards from the following text:
   {inputText}
   
   Return JSON array: [{"question": "...", "answer": "..."}]
   ```

2. **Wywołanie OpenRouter API**:
   - Endpoint: `https://openrouter.ai/api/v1/chat/completions`
   - Model: np. `gpt-3.5-turbo` lub `claude-3-haiku` (konfigurowalny)
   - Timeout: 30 sekund
   - Retry policy: 2 próby z exponential backoff

3. **Parsing odpowiedzi**:
   - Parse JSON response
   - Waliduj strukturę każdej karty:
     - `question` i `answer` non-empty
     - długość <= 10,000 znaków
   - Filtruj invalid cards
   - Zwróć `GeneratedCard[]`

4. **Obsługa błędów**:
   - Timeout → rzuć `AITimeoutError`
   - Invalid response → rzuć `AIParsingError`
   - API error → rzuć `AIServiceError`

#### KROK 4: Transakcja bazy danych
**AIDeckGenerationService orchestruje operacje DB w transakcji:**

```typescript
// Rozpocznij transakcję Postgres
BEGIN TRANSACTION;

try {
  // 4a. Utwórz deck
  const deck = await DeckService.createDeck(supabase, {
    user_id: userId,
    name: deckName || generateDefaultName(),
    created_by_ai: true
  });

  // 4b. Batch insert cards
  const cards = await CardService.createCards(supabase, {
    deck_id: deck.id,
    cards: generatedCards.map(gc => ({
      question: gc.question,
      answer: gc.answer,
      ease_factor: 2.50,
      interval_days: 1,
      repetitions: 0,
      next_review_date: new Date().toISOString()
    }))
  });

  // 4c. Utwórz log (sukces)
  const log = await AILogService.createLog(supabase, {
    user_id: userId,
    deck_id: deck.id,
    input_text_length: inputText.length,
    generated_cards_count: cards.length,
    error_message: null
  });

  COMMIT TRANSACTION;
  
  return { deck, cards, log };

} catch (error) {
  ROLLBACK TRANSACTION;
  throw error;
}
```

**Uwaga**: Supabase JS client nie wspiera natywnych transakcji. Należy użyć:
- PostgreSQL RPC function z `BEGIN`/`COMMIT`/`ROLLBACK`
- LUB service role key z raw SQL przez `pg` library
- LUB obsłużyć rollback manualnie (delete deck on card creation failure)

#### KROK 5: Mapowanie do DTOs
1. Konwertuj `DbDeck` → `DeckDTO` (snake_case → camelCase)
2. Konwertuj `DbCard[]` → simplified card format `{id, question, answer}`
3. Konwertuj `DbAILog` → `AILogDTO` (snake_case → camelCase)

#### KROK 6: Zwróć response
```typescript
return new Response(
  JSON.stringify(responseDTO),
  {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  }
);
```

### Przepływ obsługi błędów

```
AIService Error
    ↓
Catch in AIDeckGenerationService
    ↓
Log error to ai_generation_logs (deck_id = null, error_message set)
    ↓
Return 500 with ErrorResponse
```

```
Database Error (during transaction)
    ↓
Rollback transaction
    ↓
Log to application logger (console/file)
    ↓
Return 500 with ErrorResponse
```

```
Validation Error (Zod)
    ↓
Format Zod errors to ValidationError[]
    ↓
Return 400 with ValidationErrorResponse
    ↓
NO database logging (user input error)
```

## 6. Względy bezpieczeństwa

### 6.1 Autentykacja
- **Wymagania**: Bearer token (Supabase JWT) w `Authorization` header
- **Weryfikacja**: Middleware wywołuje `context.locals.supabase.auth.getUser()`
- **Token validation**: Automatyczna przez Supabase SDK (sprawdza signature, expiry)
- **Session binding**: Client supabase (`context.locals.supabase`) jest związany z requestem

### 6.2 Autoryzacja
- **User ownership**: Deck jest tworzony z `user_id = auth.uid()`
- **RLS policies**: 
  - `decks`: `INSERT` policy wymaga `user_id = auth.uid()`
  - `cards`: `INSERT` policy wymaga `deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid())`
  - `ai_generation_logs`: `INSERT` policy wymaga `user_id = auth.uid()`
- **Enforcement**: Podwójna ochrona - aplikacja ustawia `user_id` + RLS weryfikuje

### 6.3 Rate Limiting

**Implementacja rate limitera**:
```typescript
// src/lib/services/rate-limiter.service.ts
class RateLimiter {
  private requests = new Map<string, number[]>();
  
  check(userId: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // Usuń stare requesty poza oknem
    const validRequests = userRequests.filter(ts => now - ts < windowMs);
    
    if (validRequests.length >= limit) {
      return false; // Rate limit exceeded
    }
    
    validRequests.push(now);
    this.requests.set(userId, validRequests);
    return true;
  }
}
```

**Limity dla AI endpoints**:
- Per-user: 10 requests/minute
- Per-user: 50 requests/day (opcjonalnie)
- Per-IP: 20 requests/minute (dodatkowa ochrona)

**Response przy przekroczeniu**:
- Status: 429 Too Many Requests
- Header: `Retry-After: <seconds>`
- Body: ErrorResponse z kodem `TOO_MANY_REQUESTS`

**Uwaga**: Dla production rozważ Redis zamiast in-memory Map (działa w multi-instance setup).

### 6.4 Input Validation & Sanitization

**Zod schema walidacja**:
- Wszystkie pola walidowane przed przetwarzaniem
- `trim()` dla stringów usuwa whitespace
- Length limits zapobiegają DoS attacks
- Type coercion wyłączona (strict mode)

**Sanityzacja przed AI**:
```typescript
function sanitizeForAI(text: string): string {
  // Usuń potencjalnie szkodliwe znaki
  return text
    .replace(/[^\w\s.,!?;:()\-]/g, '') // Tylko bezpieczne znaki
    .slice(0, 20000); // Hard limit
}
```

**Prompt injection protection**:
- User input nie jest wstrzykiwany bezpośrednio do system prompt
- AI prompt structure:
  ```
  System: [fixed instruction]
  User: Generate flashcards from: """
  {sanitized_input}
  """
  ```
- Triple quotes izolują user input

### 6.5 AI Safety

**Timeout protection**:
- AI call timeout: 30 sekund
- Zapobiega hanging requests

**Content filtering**:
- Weryfikacja AI response przed zapisem do DB
- Odrzucenie cards z empty/invalid content
- Length validation (question/answer <= 10,000 chars)

**Cost control**:
- `maxCards` limit (100) kontroluje koszt API call
- `inputText` limit (20k chars) kontroluje tokens consumed
- Rate limiting chroni przed runaway costs

### 6.6 Privacy Considerations

**Privacy consent**: 
- Tabela `profiles` ma pole `privacy_consent`
- **Pytanie do rozważenia**: Czy sprawdzać `privacy_consent = true` przed użyciem AI?
- API plan tego nie wymaga, ale warto dodać dla GDPR compliance

**Implementacja opcjonalna**:
```typescript
// Sprawdź consent przed AI call
const profile = await ProfileService.getProfile(supabase, userId);
if (!profile.privacy_consent) {
  return 403 Forbidden: "AI features require privacy consent";
}
```

### 6.7 HTTPS & Transport Security

- **Production**: Wymaga HTTPS (TLS 1.2+)
- **Middleware check**: Odrzuć requests bez HTTPS w production:
  ```typescript
  if (import.meta.env.PROD && request.url.protocol !== 'https:') {
    return 400 Bad Request;
  }
  ```

### 6.8 CORS Policy

- **Development**: Allow `http://localhost:*`
- **Production**: Allow only frontend domain(s)
- **No wildcard**: `Access-Control-Allow-Origin: *` zabronione w production
- **Credentials**: `Access-Control-Allow-Credentials: true` dla auth headers

### 6.9 Error Message Security

**NIE ujawniaj**:
- Internal stack traces
- Database schema details
- AI API keys lub endpoints
- User IDs innych użytkowników

**Zamiast tego**:
- Generic error messages dla 500 errors
- Detailed errors tylko w server logs
- User-friendly messages w response

```typescript
// ❌ ZŁE
{ error: "PostgreSQL error: duplicate key violates unique constraint decks_pkey" }

// ✅ DOBRE
{ error: "Failed to create deck. Please try again." }
// + log szczegółów server-side
```

## 7. Obsługa błędów

### 7.1 Scenariusze błędów i kody statusu

#### 400 Bad Request - Validation Errors

**Przypadki**:
1. `inputText` pusty lub za długi (>20,000 chars)
2. `deckName` za długi (>255 chars)
3. `maxCards` poza zakresem (nie w 1-100)
4. Malformed JSON w request body
5. Missing required fields

**Response**:
```typescript
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    errors: [
      { field: 'inputText', message: 'Input text must be between 1 and 20000 characters' },
      { field: 'maxCards', message: 'Max cards must be between 1 and 100' }
    ]
  }
}
```

**Handler**:
```typescript
try {
  const validated = schema.parse(requestBody);
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
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

**Logging**: NIE logujemy do `ai_generation_logs` (to user error, nie system error)

---

#### 401 Unauthorized - Authentication Failure

**Przypadki**:
1. Brak `Authorization` header
2. Invalid/expired JWT token
3. Token signature verification failed

**Response**:
```typescript
{
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required'
  }
}
```

**Handler** (w middleware):
```typescript
const { data: { user }, error } = await context.locals.supabase.auth.getUser();

if (error || !user) {
  return new Response(
    JSON.stringify({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}
```

**Logging**: NIE logujemy

---

#### 422 Unprocessable Entity - Semantic Errors

**Przypadki**:
1. AI zwróciło invalid format (nie JSON lub zła struktura)
2. AI response nie zawiera wymaganych pól (question/answer)
3. Generated cards mają empty content
4. Wszystkie wygenerowane cards są invalid (po filtracji 0 pozostało)

**Response**:
```typescript
{
  error: {
    code: 'UNPROCESSABLE_ENTITY',
    message: 'Failed to parse AI response',
    details: 'AI returned invalid card format'
  }
}
```

**Handler**:
```typescript
try {
  const generatedCards = await aiService.generateFlashcardsFromText(inputText, maxCards);
  
  // Filtruj invalid cards
  const validCards = generatedCards.filter(card => 
    card.question?.trim() && 
    card.answer?.trim() &&
    card.question.length <= 10000 &&
    card.answer.length <= 10000
  );
  
  if (validCards.length === 0 && generatedCards.length > 0) {
    // AI zwróciło cards ale wszystkie invalid
    return 422;
  }
  
  // Jeśli AI zwróciło 0 cards ale format OK → to 201 z empty array
  
} catch (error) {
  if (error instanceof AIParsingError) {
    return 422;
  }
}
```

**Logging**: Logujemy do `ai_generation_logs` z `error_message = "Failed to parse AI response"`, `deck_id = null`, `generated_cards_count = 0`

---

#### 429 Too Many Requests - Rate Limit Exceeded

**Przypadki**:
1. User przekroczył 10 requests/minute
2. User przekroczył daily quota (50 requests/day)
3. IP przekroczyło per-IP limit (20 requests/minute)

**Response**:
```typescript
{
  error: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Rate limit exceeded. Please try again later.',
    details: 'AI endpoint limit: 10 requests per minute'
  }
}
```

**Headers**:
```
Retry-After: 60
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1697364000
```

**Handler**:
```typescript
const allowed = rateLimiter.check(user.id, 10, 60000); // 10 req/min

if (!allowed) {
  const retryAfter = rateLimiter.getRetryAfter(user.id);
  
  return new Response(
    JSON.stringify({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.',
        details: 'AI endpoint limit: 10 requests per minute'
      }
    }),
    { 
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString()
      }
    }
  );
}
```

**Logging**: NIE logujemy do `ai_generation_logs` (to rate limit, nie generation attempt)

---

#### 500 Internal Server Error - System Failures

**Przypadki**:
1. AI API timeout (>30s)
2. AI API zwrócił error (500, 503)
3. OpenRouter API key invalid/expired
4. Database connection error
5. Transaction rollback failure
6. Unhandled exception

**Response**:
```typescript
{
  error: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to generate deck from text',
    details: 'AI service temporarily unavailable' // Generic message
  }
}
```

**Handler**:
```typescript
try {
  // ... main logic
} catch (error) {
  console.error('AI deck generation failed:', error);
  
  // Spróbuj zalogować błąd do ai_generation_logs
  try {
    await AILogService.createLog(supabase, {
      user_id: userId,
      deck_id: null,
      input_text_length: inputText.length,
      generated_cards_count: 0,
      error_message: error.message || 'Internal server error'
    });
  } catch (logError) {
    console.error('Failed to log AI error:', logError);
  }
  
  return new Response(
    JSON.stringify({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate deck from text',
        details: import.meta.env.DEV ? error.message : 'Please try again later'
      }
    }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}
```

**Logging**: 
- Logujemy do `ai_generation_logs` z `error_message`
- Logujemy szczegóły do application logger (console/file)
- Monitorujemy dla alertów

---

### 7.2 Error Logging Strategy

**Do `ai_generation_logs`** (tabela DB):
- ✅ 422 - AI parsing errors
- ✅ 500 - AI service failures
- ✅ 500 - Database errors podczas generation
- ❌ 400 - Validation errors (user input)
- ❌ 401 - Auth errors
- ❌ 429 - Rate limit errors

**Do application logs** (console/file):
- ✅ Wszystkie errors z stack traces
- ✅ AI API response times
- ✅ Request timing metrics
- ✅ Rate limiter hits

**Monitoring & Alerts**:
- Alert gdy error rate > 10% w 5 min window
- Alert gdy AI timeout rate > 20%
- Alert gdy daily AI generation count anomalia

### 7.3 Retry Logic

**AI Service**:
- Retry AI API calls: 2 próby z exponential backoff
- Delays: 1s, 2s
- Retry tylko dla transient errors (500, 503, timeouts)
- NIE retry dla 4xx errors

**Database**:
- NIE retry transaction failures (może spowodować duplicates)
- Retry tylko dla connection errors (max 1 retry)

### 7.4 Graceful Degradation

**Scenariusz**: AI zwrócił mniej cards niż `maxCards`
- **Działanie**: Zwróć 201 z cards które się udały
- **Log**: `generated_cards_count = actual_count`, `error_message = null`

**Scenariusz**: AI zwrócił 0 cards (ale odpowiedział poprawnie)
- **Działanie**: Zwróć 201 z `cards: []`
- **Log**: `generated_cards_count = 0`, `error_message = null`

**Scenariusz**: AI zwrócił częściowo invalid cards
- **Działanie**: Filtruj invalid, zapisz tylko valid cards
- **Log**: `generated_cards_count = valid_count`, `error_message = null`

## 8. Rozważania dotyczące wydajności

### 8.1 Wąskie gardła

1. **AI API Call** ⚠️ GŁÓWNE WĄSKIE GARDŁO
   - Czas: 10-30 sekund w zależności od długości inputText i maxCards
   - Throughput: Ograniczony przez OpenRouter rate limits
   - Koszt: Każde wywołanie = tokens consumed

2. **Database Transaction**
   - Batch insert 100 cards: ~500ms-1s
   - Single deck insert: ~50ms
   - Transaction overhead: ~100ms

3. **Rate Limiter Check**
   - In-memory Map: <1ms
   - Redis: ~5-10ms

4. **Request/Response Serialization**
   - JSON parse/stringify: ~1-5ms dla typowych payloads

### 8.2 Optymalizacje

#### 8.2.1 AI Call Optimization

**Timeout Configuration**:
```typescript
const AI_TIMEOUT = 30000; // 30 sekund
const FETCH_OPTIONS = {
  signal: AbortSignal.timeout(AI_TIMEOUT)
};
```

**Streaming Response** (jeśli OpenRouter wspiera):
- Pozwala na progressive processing
- Zmniejsza perceived latency
- Możliwość early termination przy osiągnięciu maxCards

**Prompt Optimization**:
- Zwięzłe instrukcje (mniej tokens = szybsza odpowiedź)
- JSON mode jeśli model wspiera (bardziej reliable parsing)
- Temperature: 0.7 (balance między creativity i speed)

**Model Selection**:
- GPT-3.5-turbo: szybki, tani (~1s/card)
- GPT-4: wolniejszy, droższy (~3s/card), lepsza jakość
- Claude-3-Haiku: szybki, balans cena/jakość
- Konfigurowalny przez env var: `OPENROUTER_MODEL`

#### 8.2.2 Database Optimization

**Batch Insert Cards**:
```typescript
// ❌ ZŁE - N queries
for (const card of cards) {
  await supabase.from('cards').insert(card);
}

// ✅ DOBRE - 1 query
await supabase.from('cards').insert(cards);
```

**Use Prepared Statements**:
- Supabase JS client automatycznie używa prepared statements
- Dla raw SQL przez `pg`: używaj parameterized queries

**Index Usage**:
- `idx_decks_user_id`: używany przy INSERT (verify FK)
- `idx_cards_deck_id`: używany przy INSERT (verify FK)
- `idx_ai_logs_user_id`: używany przy INSERT
- Nie trzeba nic dodawać - indexy już istnieją

**Transaction Isolation Level**:
- Użyj `READ COMMITTED` (default Postgres)
- Dla tego use case nie potrzeba `SERIALIZABLE`

#### 8.2.3 Rate Limiter Optimization

**In-Memory Store** (development):
```typescript
class RateLimiter {
  private requests = new Map<string, number[]>();
  
  // Periodic cleanup co 5 minut
  constructor() {
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests) {
      const valid = timestamps.filter(ts => now - ts < 24 * 60 * 60 * 1000);
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, valid);
      }
    }
  }
}
```

**Redis** (production):
```typescript
// Sliding window z Redis sorted sets
async check(userId: string, limit: number, windowMs: number): Promise<boolean> {
  const key = `rate:${userId}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Usuń stare
  await redis.zremrangebyscore(key, 0, windowStart);
  
  // Policz current
  const count = await redis.zcard(key);
  
  if (count >= limit) return false;
  
  // Dodaj nowy
  await redis.zadd(key, now, `${now}`);
  await redis.expire(key, Math.ceil(windowMs / 1000));
  
  return true;
}
```

#### 8.2.4 Response Size Optimization

**Cards Response**:
- Zwracamy tylko `{id, question, answer}` zamiast pełnego `CardDTO`
- Oszczędność: ~150 bytes per card (brak SM-2 fields, timestamps)
- Dla 100 cards: ~15KB oszczędności

**Compression**:
- Astro automatycznie włącza gzip/brotli compression
- Response body compression ratio: ~70-80% dla JSON

#### 8.2.5 Caching Considerations

**Cache AI Responses?** ❌ NIE
- Każda generacja powinna być unikalna
- User expectations: nowe cards za każdym razem
- Edge case: identyczny inputText → inne cards są feature, nie bug

**Cache Rate Limiter?** ✅ TAK (już używamy in-memory/Redis)

**Cache User Profile?** ⚠️ MAYBE
- Jeśli sprawdzamy `privacy_consent`, można cache profile w request context
- Unieważnienie: profile updates są rzadkie

### 8.3 Monitoring Metrics

**Application Metrics**:
```typescript
// Log timing for monitoring
const startTime = Date.now();

// ... AI call
const aiDuration = Date.now() - startTime;
console.log(`AI generation took ${aiDuration}ms`);

// ... DB transaction
const dbDuration = Date.now() - (startTime + aiDuration);
console.log(`DB transaction took ${dbDuration}ms`);

// Total request duration
const totalDuration = Date.now() - startTime;
console.log(`Total request duration: ${totalDuration}ms`);
```

**Metrics to track**:
- AI call duration (p50, p95, p99)
- DB transaction duration
- Total request duration
- Success rate (201 / total requests)
- Error rate by type (400, 422, 500)
- Rate limit hit rate
- Cards generated per request (avg, p50, p95)
- Input text length distribution

**Alerting Thresholds**:
- AI timeout rate > 20% → Alert (AI service issues)
- Error rate > 10% → Alert (systemic problem)
- p95 latency > 45s → Warning (slow performance)
- Rate limit hit rate > 30% → Info (might need quota increase)

### 8.4 Load Testing Scenarios

**Scenario 1: Normal Load**
- 10 users, 1 request/min każdy
- Expected: p95 < 15s, error rate < 1%

**Scenario 2: Peak Load**
- 50 users, 5 requests/min każdy (hit rate limits)
- Expected: 429 errors dla excess requests, successful requests p95 < 20s

**Scenario 3: Large Input**
- inputText: 20,000 chars, maxCards: 100
- Expected: p95 < 30s, successful generation

**Scenario 4: AI Service Degraded**
- Simulate AI timeouts (50% failure rate)
- Expected: Graceful 500 errors, logs created, no crashes

## 9. Kroki implementacji

### Krok 1: Przygotowanie środowiska i konfiguracji

**1.1. Dodaj zmienne środowiskowe**
Plik: `.env` (local) i deployment config (production)

```bash
# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=gpt-3.5-turbo
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# AI Generation Limits
AI_RATE_LIMIT_PER_MINUTE=10
AI_RATE_LIMIT_PER_DAY=50
AI_TIMEOUT_MS=30000
AI_MAX_INPUT_LENGTH=20000
AI_DEFAULT_MAX_CARDS=20
AI_MAX_CARDS_LIMIT=100
```

**1.2. Dodaj typy dla env vars**
Plik: `src/env.d.ts`

```typescript
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly OPENROUTER_API_KEY: string;
  readonly OPENROUTER_MODEL: string;
  readonly OPENROUTER_BASE_URL: string;
  readonly AI_RATE_LIMIT_PER_MINUTE: string;
  readonly AI_RATE_LIMIT_PER_DAY: string;
  readonly AI_TIMEOUT_MS: string;
  // ... existing vars
}
```

**1.3. Zainstaluj dependencies**
```bash
npm install zod
npm install --save-dev @types/node
```

---

### Krok 2: Stwórz Zod validation schema

**Plik**: `src/pages/api/v1/ai/decks/from-text.schema.ts`

```typescript
import { z } from 'zod';

/**
 * Validation schema for POST /api/v1/ai/decks/from-text
 */
export const createAIDeckSchema = z.object({
  inputText: z.string()
    .trim()
    .min(1, 'Input text is required')
    .max(20000, 'Input text must not exceed 20,000 characters'),
  
  deckName: z.string()
    .trim()
    .min(1, 'Deck name must not be empty')
    .max(255, 'Deck name must not exceed 255 characters')
    .optional(),
  
  maxCards: z.number()
    .int('Max cards must be an integer')
    .min(1, 'Max cards must be at least 1')
    .max(100, 'Max cards must not exceed 100')
    .default(20)
});

export type CreateAIDeckInput = z.infer<typeof createAIDeckSchema>;
```

**Testy jednostkowe** (opcjonalnie):
Plik: `src/pages/api/v1/ai/decks/from-text.schema.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createAIDeckSchema } from './from-text.schema';

describe('createAIDeckSchema', () => {
  it('should accept valid input', () => {
    const valid = {
      inputText: 'Some educational text',
      deckName: 'My Deck',
      maxCards: 20
    };
    expect(() => createAIDeckSchema.parse(valid)).not.toThrow();
  });

  it('should reject empty inputText', () => {
    const invalid = { inputText: '' };
    expect(() => createAIDeckSchema.parse(invalid)).toThrow();
  });

  it('should reject inputText over 20k chars', () => {
    const invalid = { inputText: 'a'.repeat(20001) };
    expect(() => createAIDeckSchema.parse(invalid)).toThrow();
  });

  it('should use default maxCards', () => {
    const input = { inputText: 'text' };
    const result = createAIDeckSchema.parse(input);
    expect(result.maxCards).toBe(20);
  });
});
```

---

### Krok 3: Implementuj AIService

**Plik**: `src/lib/services/ai.service.ts`

```typescript
/**
 * AIService - Handles communication with OpenRouter API for flashcard generation
 */

export interface GeneratedCard {
  question: string;
  answer: string;
}

export class AIServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class AITimeoutError extends AIServiceError {
  constructor() {
    super('AI request timed out');
    this.name = 'AITimeoutError';
  }
}

export class AIParsingError extends AIServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'AIParsingError';
  }
}

export class AIService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor() {
    this.apiKey = import.meta.env.OPENROUTER_API_KEY;
    this.model = import.meta.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';
    this.baseUrl = import.meta.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.timeout = parseInt(import.meta.env.AI_TIMEOUT_MS || '30000');

    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }
  }

  /**
   * Generate flashcards from input text using AI
   */
  async generateFlashcardsFromText(
    inputText: string,
    maxCards: number = 20
  ): Promise<GeneratedCard[]> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(inputText, maxCards);
      const response = await this.callOpenRouter(prompt);
      const cards = this.parseResponse(response);
      const validCards = this.validateCards(cards);

      const duration = Date.now() - startTime;
      console.log(`AI generation completed in ${duration}ms, generated ${validCards.length} cards`);

      return validCards;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`AI generation failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Build prompt for AI model
   */
  private buildPrompt(inputText: string, maxCards: number): string {
    return `You are an expert educator creating educational flashcards.

Generate up to ${maxCards} high-quality flashcards from the following text. Each flashcard should:
- Have a clear, concise question
- Have a complete, accurate answer
- Test understanding of key concepts
- Be suitable for spaced repetition learning

Text to analyze:
"""
${this.sanitizeInput(inputText)}
"""

Return ONLY a JSON array with this exact format (no additional text):
[
  {"question": "What is...", "answer": "It is..."},
  {"question": "How does...", "answer": "It works by..."}
]`;
  }

  /**
   * Sanitize user input before sending to AI
   */
  private sanitizeInput(text: string): string {
    // Remove potentially harmful characters, keep educational content
    return text
      .replace(/[<>]/g, '') // Remove HTML-like tags
      .slice(0, 20000); // Hard limit
  }

  /**
   * Call OpenRouter API with retry logic
   */
  private async callOpenRouter(prompt: string): Promise<string> {
    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://10x-cards.app', // Required by OpenRouter
            'X-Title': '10x Cards'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 4000
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new AIServiceError(
            `OpenRouter API error: ${response.status} ${response.statusText}`,
            errorBody
          );
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new AIParsingError('No content in AI response');
        }

        return content;

      } catch (error) {
        lastError = error;

        // Don't retry on timeout or 4xx errors
        if (error instanceof AITimeoutError || 
            (error instanceof AIServiceError && error.message.includes('4'))) {
          throw error;
        }

        // Exponential backoff for retries
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`AI call failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new AIServiceError('AI request failed after retries', lastError);
  }

  /**
   * Parse AI response to extract cards
   */
  private parseResponse(response: string): GeneratedCard[] {
    try {
      // Try to extract JSON array from response
      // AI might wrap it in markdown code blocks
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new AIParsingError('No JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(parsed)) {
        throw new AIParsingError('Response is not an array');
      }

      return parsed;

    } catch (error) {
      if (error instanceof AIParsingError) {
        throw error;
      }
      throw new AIParsingError(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Validate and filter generated cards
   */
  private validateCards(cards: any[]): GeneratedCard[] {
    return cards.filter(card => {
      // Check structure
      if (typeof card !== 'object' || !card.question || !card.answer) {
        console.warn('Invalid card structure:', card);
        return false;
      }

      // Check non-empty
      const question = String(card.question).trim();
      const answer = String(card.answer).trim();

      if (!question || !answer) {
        console.warn('Empty question or answer:', card);
        return false;
      }

      // Check length
      if (question.length > 10000 || answer.length > 10000) {
        console.warn('Question or answer too long:', card);
        return false;
      }

      return true;
    }).map(card => ({
      question: String(card.question).trim(),
      answer: String(card.answer).trim()
    }));
  }
}

// Singleton instance
export const aiService = new AIService();
```

---

### Krok 4: Implementuj DeckService

**Plik**: `src/lib/services/deck.service.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbDeck } from '../../types';

export interface CreateDeckData {
  user_id: string;
  name: string;
  created_by_ai: boolean;
}

export class DeckService {
  /**
   * Create a new deck
   */
  static async createDeck(
    supabase: SupabaseClient,
    data: CreateDeckData
  ): Promise<DbDeck> {
    const { data: deck, error } = await supabase
      .from('decks')
      .insert({
        user_id: data.user_id,
        name: data.name,
        created_by_ai: data.created_by_ai
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create deck:', error);
      throw new Error(`Failed to create deck: ${error.message}`);
    }

    return deck;
  }

  /**
   * Get deck by ID (with ownership check)
   */
  static async getDeckById(
    supabase: SupabaseClient,
    deckId: string,
    userId: string
  ): Promise<DbDeck | null> {
    const { data, error } = await supabase
      .from('decks')
      .select()
      .eq('id', deckId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Failed to get deck:', error);
      throw new Error(`Failed to get deck: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete deck by ID (cascade deletes cards)
   */
  static async deleteDeck(
    supabase: SupabaseClient,
    deckId: string,
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to delete deck:', error);
      throw new Error(`Failed to delete deck: ${error.message}`);
    }
  }
}
```

---

### Krok 5: Implementuj CardService

**Plik**: `src/lib/services/card.service.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbCard } from '../../types';

export interface CreateCardData {
  deck_id: string;
  question: string;
  answer: string;
  ease_factor?: number;
  interval_days?: number;
  repetitions?: number;
  next_review_date?: string;
}

export class CardService {
  /**
   * Create multiple cards in batch (efficient for AI generation)
   */
  static async createCards(
    supabase: SupabaseClient,
    deckId: string,
    cards: Array<{ question: string; answer: string }>
  ): Promise<DbCard[]> {
    if (cards.length === 0) {
      return [];
    }

    const now = new Date().toISOString();

    const cardsToInsert = cards.map(card => ({
      deck_id: deckId,
      question: card.question,
      answer: card.answer,
      ease_factor: 2.50,
      interval_days: 1,
      repetitions: 0,
      next_review_date: now
    }));

    const { data, error } = await supabase
      .from('cards')
      .insert(cardsToInsert)
      .select();

    if (error) {
      console.error('Failed to create cards:', error);
      throw new Error(`Failed to create cards: ${error.message}`);
    }

    return data;
  }

  /**
   * Get card by ID (with ownership check via deck)
   */
  static async getCardById(
    supabase: SupabaseClient,
    cardId: string,
    userId: string
  ): Promise<DbCard | null> {
    const { data, error } = await supabase
      .from('cards')
      .select(`
        *,
        deck:decks!inner(user_id)
      `)
      .eq('id', cardId)
      .eq('deck.user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Failed to get card:', error);
      throw new Error(`Failed to get card: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete card by ID
   */
  static async deleteCard(
    supabase: SupabaseClient,
    cardId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', cardId);

    if (error) {
      console.error('Failed to delete card:', error);
      throw new Error(`Failed to delete card: ${error.message}`);
    }
  }
}
```

---

### Krok 6: Implementuj AILogService

**Plik**: `src/lib/services/ai-log.service.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbAILog } from '../../types';

export interface CreateAILogData {
  user_id: string;
  deck_id: string | null;
  input_text_length: number;
  generated_cards_count: number;
  error_message: string | null;
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
   * Get AI logs for user with pagination
   */
  static async getLogsByUser(
    supabase: SupabaseClient,
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ logs: DbAILog[]; total: number }> {
    // Get logs
    const { data: logs, error: logsError } = await supabase
      .from('ai_generation_logs')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (logsError) {
      console.error('Failed to get AI logs:', logsError);
      throw new Error(`Failed to get AI logs: ${logsError.message}`);
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('ai_generation_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Failed to count AI logs:', countError);
      throw new Error(`Failed to count AI logs: ${countError.message}`);
    }

    return {
      logs: logs || [],
      total: count || 0
    };
  }
}
```

---

### Krok 7: Implementuj AIDeckGenerationService (Orchestrator)

**Plik**: `src/lib/services/ai-deck-generation.service.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIDeckResponseDTO } from '../../types';
import { aiService, type GeneratedCard } from './ai.service';
import { DeckService } from './deck.service';
import { CardService } from './card.service';
import { AILogService } from './ai-log.service';
import { mapDeckToDTO, mapCardsToSimpleDTO, mapAILogToDTO } from './mappers';

export interface GenerateDeckFromTextInput {
  inputText: string;
  deckName?: string;
  maxCards: number;
}

export class AIDeckGenerationService {
  /**
   * Main orchestrator: Generate deck from text using AI
   * Handles entire flow: AI call → DB transaction → logging
   */
  static async generateDeckFromText(
    supabase: SupabaseClient,
    userId: string,
    input: GenerateDeckFromTextInput
  ): Promise<AIDeckResponseDTO> {
    const startTime = Date.now();
    let generatedCards: GeneratedCard[] = [];
    let deckId: string | null = null;

    try {
      // STEP 1: Generate cards with AI
      console.log(`Starting AI generation for user ${userId}, maxCards: ${input.maxCards}`);
      generatedCards = await aiService.generateFlashcardsFromText(
        input.inputText,
        input.maxCards
      );
      console.log(`AI generated ${generatedCards.length} cards`);

      // STEP 2: Create deck
      const deckName = input.deckName || this.generateDefaultDeckName();
      const deck = await DeckService.createDeck(supabase, {
        user_id: userId,
        name: deckName,
        created_by_ai: true
      });
      deckId = deck.id;
      console.log(`Created deck ${deckId}`);

      // STEP 3: Create cards (batch insert)
      const cards = await CardService.createCards(
        supabase,
        deck.id,
        generatedCards
      );
      console.log(`Created ${cards.length} cards`);

      // STEP 4: Create success log
      const log = await AILogService.createLog(supabase, {
        user_id: userId,
        deck_id: deck.id,
        input_text_length: input.inputText.length,
        generated_cards_count: cards.length,
        error_message: null
      });

      const duration = Date.now() - startTime;
      console.log(`AI deck generation completed in ${duration}ms`);

      // STEP 5: Map to DTOs and return
      return {
        deck: mapDeckToDTO(deck),
        cards: mapCardsToSimpleDTO(cards),
        log: mapAILogToDTO(log)
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`AI deck generation failed after ${duration}ms:`, error);

      // Try to log error (best effort)
      try {
        await AILogService.createLog(supabase, {
          user_id: userId,
          deck_id: deckId,
          input_text_length: input.inputText.length,
          generated_cards_count: generatedCards.length,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (logError) {
        console.error('Failed to log AI error:', logError);
      }

      // If deck was created but cards failed, clean up deck
      if (deckId && generatedCards.length > 0) {
        try {
          await DeckService.deleteDeck(supabase, deckId, userId);
          console.log(`Cleaned up orphaned deck ${deckId}`);
        } catch (cleanupError) {
          console.error('Failed to clean up deck:', cleanupError);
        }
      }

      // Re-throw original error
      throw error;
    }
  }

  /**
   * Generate default deck name with timestamp
   */
  private static generateDefaultDeckName(): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    return `AI Generated Deck - ${timestamp}`;
  }
}
```

---

### Krok 8: Implementuj mapper utilities

**Plik**: `src/lib/services/mappers.ts`

```typescript
/**
 * Mappers: Convert database entities (snake_case) to DTOs (camelCase)
 */

import type { DbDeck, DbCard, DbAILog, DeckDTO, AILogDTO } from '../../types';

/**
 * Map database deck to DeckDTO
 */
export function mapDeckToDTO(deck: DbDeck): DeckDTO {
  return {
    id: deck.id,
    name: deck.name,
    createdByAi: deck.created_by_ai,
    createdAt: deck.created_at,
    updatedAt: deck.updated_at
  };
}

/**
 * Map database cards to simplified card format (for AI deck response)
 */
export function mapCardsToSimpleDTO(cards: DbCard[]): Array<{
  id: string;
  question: string;
  answer: string;
}> {
  return cards.map(card => ({
    id: card.id,
    question: card.question,
    answer: card.answer
  }));
}

/**
 * Map database AI log to AILogDTO
 */
export function mapAILogToDTO(log: DbAILog): AILogDTO {
  return {
    id: log.id,
    deckId: log.deck_id,
    inputTextLength: log.input_text_length,
    generatedCardsCount: log.generated_cards_count,
    errorMessage: log.error_message,
    createdAt: log.created_at
  };
}
```

---

### Krok 9: Implementuj Rate Limiter

**Plik**: `src/lib/services/rate-limiter.service.ts`

```typescript
/**
 * RateLimiter - In-memory rate limiting for API endpoints
 * For production, consider using Redis for distributed rate limiting
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class RateLimiter {
  private requests = new Map<string, number[]>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if request is allowed under rate limit
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get existing requests for this key
    const userRequests = this.requests.get(key) || [];

    // Filter out requests outside the time window
    const validRequests = userRequests.filter(ts => ts > windowStart);

    // Check if limit exceeded
    if (validRequests.length >= config.maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const resetAt = oldestRequest + config.windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetAt
      };
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);

    return {
      allowed: true,
      remaining: config.maxRequests - validRequests.length,
      resetAt: now + config.windowMs
    };
  }

  /**
   * Get retry-after seconds for rate limited request
   */
  getRetryAfter(key: string, windowMs: number): number {
    const userRequests = this.requests.get(key) || [];
    if (userRequests.length === 0) return 0;

    const oldestRequest = Math.min(...userRequests);
    const resetAt = oldestRequest + windowMs;
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

    return Math.max(0, retryAfter);
  }

  /**
   * Cleanup old entries to prevent memory leaks
   */
  private cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, timestamps] of this.requests) {
      const validTimestamps = timestamps.filter(ts => now - ts < maxAge);
      
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }

    console.log(`Rate limiter cleanup: ${this.requests.size} active keys`);
  }

  /**
   * Clear all rate limit data (for testing)
   */
  reset() {
    this.requests.clear();
  }

  /**
   * Destroy rate limiter and cleanup interval
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Rate limit configurations
export const RATE_LIMITS = {
  AI_PER_MINUTE: {
    maxRequests: parseInt(import.meta.env.AI_RATE_LIMIT_PER_MINUTE || '10'),
    windowMs: 60 * 1000 // 1 minute
  },
  AI_PER_DAY: {
    maxRequests: parseInt(import.meta.env.AI_RATE_LIMIT_PER_DAY || '50'),
    windowMs: 24 * 60 * 60 * 1000 // 24 hours
  }
};
```

---

### Krok 10: Implementuj API Route Handler

**Plik**: `src/pages/api/v1/ai/decks/from-text.ts`

```typescript
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createAIDeckSchema } from './from-text.schema';
import { AIDeckGenerationService } from '../../../../../lib/services/ai-deck-generation.service';
import { AIServiceError, AITimeoutError, AIParsingError } from '../../../../../lib/services/ai.service';
import { rateLimiter, RATE_LIMITS } from '../../../../../lib/services/rate-limiter.service';
import type { 
  AIDeckResponseDTO, 
  ErrorResponse, 
  ValidationErrorResponse,
  UnprocessableErrorResponse 
} from '../../../../../types';

/**
 * POST /api/v1/ai/decks/from-text
 * Generate deck and cards from text using AI
 */
export const POST: APIRoute = async ({ request, locals }) => {
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

    // STEP 2: Rate Limiting - Per Minute
    const rateLimitMinute = rateLimiter.check(
      `ai:${user.id}:minute`,
      RATE_LIMITS.AI_PER_MINUTE
    );

    if (!rateLimitMinute.allowed) {
      const retryAfter = rateLimiter.getRetryAfter(`ai:${user.id}:minute`, RATE_LIMITS.AI_PER_MINUTE.windowMs);
      
      return new Response(
        JSON.stringify({
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Rate limit exceeded. Please try again later.',
            details: `AI endpoint limit: ${RATE_LIMITS.AI_PER_MINUTE.maxRequests} requests per minute`
          }
        } satisfies ErrorResponse),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': RATE_LIMITS.AI_PER_MINUTE.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitMinute.resetAt.toString()
          }
        }
      );
    }

    // STEP 3: Rate Limiting - Per Day
    const rateLimitDay = rateLimiter.check(
      `ai:${user.id}:day`,
      RATE_LIMITS.AI_PER_DAY
    );

    if (!rateLimitDay.allowed) {
      const retryAfter = rateLimiter.getRetryAfter(`ai:${user.id}:day`, RATE_LIMITS.AI_PER_DAY.windowMs);
      
      return new Response(
        JSON.stringify({
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Daily rate limit exceeded. Please try again tomorrow.',
            details: `AI endpoint limit: ${RATE_LIMITS.AI_PER_DAY.maxRequests} requests per day`
          }
        } satisfies ErrorResponse),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString()
          }
        }
      );
    }

    // STEP 4: Parse and validate request body
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
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    let validated;
    try {
      validated = createAIDeckSchema.parse(requestBody);
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

    // STEP 5: Generate deck using AI
    const response = await AIDeckGenerationService.generateDeckFromText(
      locals.supabase,
      user.id,
      {
        inputText: validated.inputText,
        deckName: validated.deckName,
        maxCards: validated.maxCards
      }
    );

    const duration = Date.now() - startTime;
    console.log(`POST /api/v1/ai/decks/from-text completed in ${duration}ms`);

    // STEP 6: Return success response
    return new Response(
      JSON.stringify(response satisfies AIDeckResponseDTO),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Duration': duration.toString()
        }
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`POST /api/v1/ai/decks/from-text failed after ${duration}ms:`, error);

    // Handle specific error types
    if (error instanceof AIParsingError) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Failed to parse AI response',
            details: import.meta.env.DEV ? error.message : undefined
          }
        } satisfies UnprocessableErrorResponse),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (error instanceof AITimeoutError) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'AI request timed out',
            details: 'Please try again with shorter input text or fewer cards'
          }
        } satisfies ErrorResponse),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (error instanceof AIServiceError) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to generate deck from text',
            details: import.meta.env.DEV ? error.message : 'AI service temporarily unavailable'
          }
        } satisfies ErrorResponse),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generic error handler
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate deck from text',
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

### Krok 11: Testy jednostkowe i integracyjne

**Plik**: `src/lib/services/ai.service.test.ts` (przykład)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService, AITimeoutError, AIParsingError } from './ai.service';

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
  });

  describe('generateFlashcardsFromText', () => {
    it('should generate valid flashcards', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '[{"question":"Q1","answer":"A1"},{"question":"Q2","answer":"A2"}]'
            }
          }]
        })
      });

      const result = await aiService.generateFlashcardsFromText('test input', 2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ question: 'Q1', answer: 'A1' });
    });

    it('should filter invalid cards', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '[{"question":"Q1","answer":"A1"},{"question":"","answer":"A2"}]'
            }
          }]
        })
      });

      const result = await aiService.generateFlashcardsFromText('test input', 2);

      expect(result).toHaveLength(1);
      expect(result[0].question).toBe('Q1');
    });

    it('should throw AIParsingError for invalid JSON', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'not valid json'
            }
          }]
        })
      });

      await expect(
        aiService.generateFlashcardsFromText('test input', 2)
      ).rejects.toThrow(AIParsingError);
    });
  });
});
```

**Plik**: `tests/api/ai-decks.test.ts` (integration test przykład)

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('POST /api/v1/ai/decks/from-text', () => {
  let authToken: string;

  beforeAll(async () => {
    // Setup: Get auth token for testing
    // (implementation depends on test setup)
  });

  it('should create deck with AI-generated cards', async () => {
    const response = await fetch('http://localhost:4321/api/v1/ai/decks/from-text', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputText: 'JavaScript is a programming language.',
        deckName: 'Test Deck',
        maxCards: 5
      })
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    
    expect(data.deck).toBeDefined();
    expect(data.deck.name).toBe('Test Deck');
    expect(data.deck.createdByAi).toBe(true);
    expect(data.cards).toBeInstanceOf(Array);
    expect(data.log).toBeDefined();
    expect(data.log.errorMessage).toBeNull();
  });

  it('should reject invalid input', async () => {
    const response = await fetch('http://localhost:4321/api/v1/ai/decks/from-text', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputText: '', // Invalid: empty
        maxCards: 5
      })
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should enforce rate limits', async () => {
    // Make 11 requests (limit is 10/min)
    const requests = Array(11).fill(null).map(() =>
      fetch('http://localhost:4321/api/v1/ai/decks/from-text', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputText: 'test',
          maxCards: 1
        })
      })
    );

    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status);

    expect(statusCodes).toContain(429);
  });
});
```

---

### Krok 12: Dokumentacja i deployment checklist

**Plik**: `.ai/api-implementation-checklist.md`

```markdown
# API Implementation Checklist: POST /api/v1/ai/decks/from-text

## Development
- [x] Zod validation schema created
- [x] AIService implemented with OpenRouter integration
- [x] DeckService, CardService, AILogService implemented
- [x] AIDeckGenerationService orchestrator implemented
- [x] Rate limiter implemented
- [x] API route handler implemented
- [x] Error handling for all scenarios
- [x] Mappers for DTO conversion
- [ ] Unit tests for services
- [ ] Integration tests for API endpoint
- [ ] Manual testing with Postman/curl

## Configuration
- [ ] Environment variables set (.env and production)
- [ ] OpenRouter API key configured
- [ ] Rate limit values tuned
- [ ] AI model selected and tested

## Database
- [ ] Verify tables exist (decks, cards, ai_generation_logs)
- [ ] Verify RLS policies are enabled
- [ ] Verify indexes exist
- [ ] Test database transaction rollback

## Security
- [ ] Auth middleware tested
- [ ] Rate limiting tested (minute + day)
- [ ] Input validation tested (Zod)
- [ ] CORS configured correctly
- [ ] HTTPS enforced in production
- [ ] Error messages don't leak sensitive info

## Performance
- [ ] AI call timeout tested (30s)
- [ ] Batch insert tested with 100 cards
- [ ] Rate limiter memory cleanup verified
- [ ] Load testing completed
- [ ] Monitoring metrics logged

## Production Deployment
- [ ] Environment variables deployed
- [ ] Database migrations applied
- [ ] API endpoint accessible
- [ ] Health check passed
- [ ] Error tracking configured (Sentry/similar)
- [ ] Rate limiter (consider Redis for multi-instance)
- [ ] Documentation updated
- [ ] Team notified of new endpoint

## Post-Deployment
- [ ] Monitor error rates
- [ ] Monitor AI call success rates
- [ ] Monitor p95 latency
- [ ] Check ai_generation_logs for errors
- [ ] Gather user feedback
```

---

### Krok 13: Finalizacja i dokumentacja

1. **Update API documentation** - dodaj przykłady użycia endpointu
2. **Update README** - opisz AI features i wymagane env vars
3. **Create migration guide** - jeśli są zmiany w schemacie DB
4. **Setup monitoring** - configure error tracking i alerting
5. **Team knowledge share** - prezentuj implementację zespołowi

---

## 10. Podsumowanie implementacji

### Utworzone pliki:
1. `src/pages/api/v1/ai/decks/from-text.ts` - główny handler API
2. `src/pages/api/v1/ai/decks/from-text.schema.ts` - Zod validation
3. `src/lib/services/ai.service.ts` - komunikacja z OpenRouter
4. `src/lib/services/deck.service.ts` - operacje na decks
5. `src/lib/services/card.service.ts` - operacje na cards
6. `src/lib/services/ai-log.service.ts` - operacje na ai_generation_logs
7. `src/lib/services/ai-deck-generation.service.ts` - orchestrator
8. `src/lib/services/rate-limiter.service.ts` - rate limiting
9. `src/lib/services/mappers.ts` - DTO mappers

### Kluczowe cechy implementacji:
- ✅ Pełna walidacja wejścia (Zod)
- ✅ Rate limiting (per-minute + per-day)
- ✅ AI integration z retry logic i timeout
- ✅ Transakcyjna integralność danych
- ✅ Comprehensive error handling
- ✅ Logging do ai_generation_logs
- ✅ Type-safe z TypeScript
- ✅ Zgodność z API specification
- ✅ Security best practices
- ✅ Performance optimizations

### Następne kroki:
1. Przetestuj wszystkie scenariusze (success + errors)
2. Dostosuj rate limits na podstawie testów
3. Wybierz optymalny AI model (cost vs quality)
4. Setup monitoring i alerting
5. Deploy do production

