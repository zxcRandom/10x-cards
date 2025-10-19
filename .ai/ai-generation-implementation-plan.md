# AI Generation Implementation Plan - Dokończenie

## 1. Przegląd obecnego stanu

### ✅ **Zaimplementowane:**
- **AIService** - Kompletny serwis komunikacji z OpenRouter API
- **POST /api/v1/ai/decks/from-text** - Częściowo (tylko test AI, brak DB)
- **Zod Schema** - Walidacja input dla AI generation

### ❌ **Brakuje:**
- **GET /api/v1/ai/logs** - Całkowicie brakuje
- **Database Services** - DeckService, CardService, AILogService
- **RLS Policies** - Dla tabeli `ai_generation_logs`
- **Rate Limiting** - Dla AI endpoints
- **Proper Response Format** - AIDeckResponseDTO

---

## 2. Endpointy do implementacji

### 2.1 POST /api/v1/ai/decks/from-text (DOKOŃCZENIE)

**Obecny stan:** Test AI service, brak integracji z bazą danych

**Co trzeba dodać:**
1. **Database Services** - DeckService, CardService, AILogService
2. **Transakcyjność** - Atomic operation (deck + cards + log)
3. **Proper Response** - AIDeckResponseDTO format
4. **Rate Limiting** - 10 req/min per user
5. **Error Recovery** - Rollback przy błędach

**Oczekiwany flow:**
```
1. Validate input (✅ już jest)
2. Check rate limits (❌ brakuje)
3. Generate cards via AI (✅ już jest)
4. Create deck in DB (❌ brakuje)
5. Create cards in DB (❌ brakuje)
6. Log generation attempt (❌ brakuje)
7. Return AIDeckResponseDTO (❌ brakuje)
```

### 2.2 GET /api/v1/ai/logs (NOWY)

**Obecny stan:** Całkowicie brakuje

**Co trzeba zaimplementować:**
1. **AILogService** - Service do operacji na logach
2. **API Route Handler** - GET endpoint
3. **Zod Schema** - Walidacja query params
4. **RLS Policies** - Dla tabeli `ai_generation_logs`

**Funkcjonalności:**
- Lista logów generowania AI dla użytkownika
- Filtrowanie po deckId, date range
- Paginacja (limit/offset)
- Sortowanie po createdAt

---

## 3. Szczegóły implementacji

### 3.1 Database Services

#### DeckService
```typescript
// src/lib/services/deck.service.ts
export class DeckService {
  async createDeck(userId: string, name: string, createdByAi: boolean = false): Promise<DeckDTO>
  async getDeckById(deckId: string, userId: string): Promise<DeckDTO>
  async updateDeck(deckId: string, userId: string, data: UpdateDeckCommand): Promise<DeckDTO>
  async deleteDeck(deckId: string, userId: string): Promise<void>
  async listDecks(userId: string, filters: ListDecksFilters): Promise<DecksListDTO>
}
```

#### CardService
```typescript
// src/lib/services/card.service.ts
export class CardService {
  async createCard(deckId: string, userId: string, data: CreateCardCommand): Promise<CardDTO>
  async createCardsBatch(deckId: string, userId: string, cards: CreateCardCommand[]): Promise<CardDTO[]>
  async getCardById(cardId: string, userId: string): Promise<CardDTO>
  async updateCard(cardId: string, userId: string, data: UpdateCardCommand): Promise<CardDTO>
  async deleteCard(cardId: string, userId: string): Promise<void>
  async listCards(deckId: string, userId: string, filters: ListCardsFilters): Promise<CardsListDTO>
}
```

#### AILogService
```typescript
// src/lib/services/ai-log.service.ts
export class AILogService {
  async createLog(data: CreateAILogData): Promise<AILogDTO>
  async listLogs(userId: string, filters: ListLogsFilters): Promise<AILogsListDTO>
  async getLogById(logId: string, userId: string): Promise<AILogDTO>
}
```

### 3.2 Rate Limiting

**Implementacja:** Middleware lub service-level

```typescript
// src/lib/services/rate-limit.service.ts
export class RateLimitService {
  async checkAIRateLimit(userId: string): Promise<boolean>
  async incrementAIRateLimit(userId: string): Promise<void>
  async getRemainingRequests(userId: string): Promise<number>
}
```

**Limity:**
- AI Generation: 10 requests/minute per user
- AI Logs: 100 requests/minute per user

### 3.3 Transakcyjność

**Problem:** Supabase JS SDK nie wspiera natywnych transakcji

**Rozwiązania:**
1. **Opcja A (preferowana):** PostgreSQL RPC function
2. **Opcja B:** Sequential operations z rollback logic
3. **Opcja C:** Service role + raw SQL transactions

---

## 4. Struktura plików do utworzenia

```
src/
├── lib/
│   └── services/
│       ├── deck.service.ts          # Nowy - operacje na deckach
│       ├── card.service.ts          # Nowy - operacje na kartach  
│       ├── ai-log.service.ts        # Nowy - operacje na logach AI
│       └── rate-limit.service.ts    # Nowy - rate limiting
├── pages/
│   └── api/
│       └── v1/
│           └── ai/
│               ├── decks/
│               │   └── from-text.ts # Dokończyć - dodać DB integration
│               └── logs/
│                   ├── index.ts     # Nowy - GET /api/v1/ai/logs
│                   └── index.schema.ts # Nowy - Zod schema dla logs
```

---

## 5. Etapy implementacji

### Etap 1: Database Services (PRIORYTET 1)

**1.1 DeckService**
- Implementacja CRUD operations
- Weryfikacja własności (user_id)
- Error handling
- Unit tests

**1.2 CardService** 
- Implementacja CRUD operations
- Batch creation dla AI-generated cards
- Weryfikacja własności przez deck
- Error handling

**1.3 AILogService**
- Create log entry
- List logs z filtrowaniem
- Paginacja i sortowanie
- Error handling

### Etap 2: RLS Policies (PRIORYTET 1)

**2.1 AI Generation Logs Policies**
```sql
-- SELECT policy
CREATE POLICY "Users can view their own AI logs"
ON ai_generation_logs FOR SELECT
USING (user_id = auth.uid());

-- INSERT policy  
CREATE POLICY "Users can create AI logs"
ON ai_generation_logs FOR INSERT
WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE policies (logs are immutable)
```

### Etap 3: Rate Limiting (PRIORYTET 2)

**3.1 RateLimitService**
- Redis-based rate limiting
- Per-user counters
- TTL-based expiration
- Error responses (429 Too Many Requests)

**3.2 Integration**
- Middleware dla AI endpoints
- Headers z remaining requests
- Graceful degradation

### Etap 4: Dokończenie POST /api/v1/ai/decks/from-text (PRIORYTET 1)

**4.1 Database Integration**
- Replace test response z proper AIDeckResponseDTO
- Integracja z DeckService, CardService, AILogService
- Atomic operation (deck + cards + log)

**4.2 Error Handling**
- Rollback przy błędach
- Proper error responses
- Logging failed attempts

**4.3 Response Format**
```typescript
// AIDeckResponseDTO
{
  deck: DeckDTO,
  cards: Array<{ id: string, question: string, answer: string }>,
  log: AILogDTO
}
```

### Etap 5: GET /api/v1/ai/logs (PRIORYTET 2)

**5.1 API Route Handler**
- GET endpoint implementation
- Query params validation
- Integration z AILogService
- Error handling

**5.2 Zod Schema**
- Walidacja query params (deckId, from, to, limit, offset, sort, order)
- Type safety

**5.3 Response Format**
```typescript
// AILogsListDTO
{
  items: AILogDTO[],
  total: number,
  limit: number,
  offset: number
}
```

### Etap 6: Testing & Optimization (PRIORYTET 3)

**6.1 Unit Tests**
- Service layer tests
- API endpoint tests
- Error scenario tests

**6.2 Integration Tests**
- End-to-end AI generation flow
- Database transaction tests
- Rate limiting tests

**6.3 Performance Optimization**
- Database query optimization
- Caching strategies
- Connection pooling

---

## 6. Szczegółowe kroki implementacji

### Krok 1: Utworzenie Database Services

**1.1 DeckService** (`src/lib/services/deck.service.ts`)

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DeckDTO, CreateDeckCommand, UpdateDeckCommand, DecksListDTO } from '../../../types';

export class DeckService {
  constructor(private supabase: SupabaseClient) {}

  async createDeck(userId: string, name: string, createdByAi: boolean = false): Promise<DeckDTO> {
    const { data, error } = await this.supabase
      .from('decks')
      .insert({
        user_id: userId,
        name: name.trim(),
        created_by_ai: createdByAi,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create deck: ${error?.message}`);
    }

    return this.dbDeckToDTO(data);
  }

  private dbDeckToDTO(deck: any): DeckDTO {
    return {
      id: deck.id,
      name: deck.name,
      createdByAi: deck.created_by_ai,
      createdAt: deck.created_at,
      updatedAt: deck.updated_at,
    };
  }
}
```

**1.2 CardService** (`src/lib/services/card.service.ts`)

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CardDTO, CreateCardCommand } from '../../../types';

export class CardService {
  constructor(private supabase: SupabaseClient) {}

  async createCardsBatch(deckId: string, userId: string, cards: CreateCardCommand[]): Promise<CardDTO[]> {
    // Verify deck ownership first
    await this.verifyDeckOwnership(deckId, userId);

    const cardInserts = cards.map(card => ({
      deck_id: deckId,
      question: card.question.trim(),
      answer: card.answer.trim(),
    }));

    const { data, error } = await this.supabase
      .from('cards')
      .insert(cardInserts)
      .select();

    if (error || !data) {
      throw new Error(`Failed to create cards: ${error?.message}`);
    }

    return data.map(this.dbCardToDTO);
  }

  private async verifyDeckOwnership(deckId: string, userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('decks')
      .select('id')
      .eq('id', deckId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('Deck not found or access denied');
    }
  }

  private dbCardToDTO(card: any): CardDTO {
    return {
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
    };
  }
}
```

**1.3 AILogService** (`src/lib/services/ai-log.service.ts`)

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AILogDTO, AILogsListDTO } from '../../../types';

export interface CreateAILogData {
  userId: string;
  deckId: string | null;
  inputTextLength: number;
  generatedCardsCount: number;
  errorMessage: string | null;
}

export interface ListLogsFilters {
  deckId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
  sort: string;
  order: 'asc' | 'desc';
}

export class AILogService {
  constructor(private supabase: SupabaseClient) {}

  async createLog(data: CreateAILogData): Promise<AILogDTO> {
    const { data: log, error } = await this.supabase
      .from('ai_generation_logs')
      .insert({
        user_id: data.userId,
        deck_id: data.deckId,
        input_text_length: data.inputTextLength,
        generated_cards_count: data.generatedCardsCount,
        error_message: data.errorMessage,
      })
      .select()
      .single();

    if (error || !log) {
      throw new Error(`Failed to create AI log: ${error?.message}`);
    }

    return this.dbLogToDTO(log);
  }

  async listLogs(userId: string, filters: ListLogsFilters): Promise<AILogsListDTO> {
    let query = this.supabase
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

    // Apply sorting and pagination
    query = query
      .order(filters.sort === 'createdAt' ? 'created_at' : filters.sort, { 
        ascending: filters.order === 'asc' 
      })
      .range(filters.offset, filters.offset + filters.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch AI logs: ${error.message}`);
    }

    return {
      items: (data || []).map(this.dbLogToDTO),
      total: count || 0,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  private dbLogToDTO(log: any): AILogDTO {
    return {
      id: log.id,
      deckId: log.deck_id,
      inputTextLength: log.input_text_length,
      generatedCardsCount: log.generated_cards_count,
      errorMessage: log.error_message,
      createdAt: log.created_at,
    };
  }
}
```

### Krok 2: RLS Policies Migration

**Plik:** `supabase/migrations/YYYYMMDDHHMMSS_add_ai_logs_rls_policies.sql`

```sql
-- ============================================================================
-- Migration: Add RLS policies for ai_generation_logs table
-- Description: Enable users to create and view their own AI generation logs
-- ============================================================================

-- Policy for SELECT - users can view their own logs
CREATE POLICY "Users can view their own AI logs"
ON public.ai_generation_logs FOR SELECT
USING (user_id = auth.uid());

-- Policy for INSERT - users can create logs for their own operations
CREATE POLICY "Users can create AI logs"
ON public.ai_generation_logs FOR INSERT
WITH CHECK (user_id = auth.uid());

-- No UPDATE policy - logs are immutable (append-only)
-- No DELETE policy - logs are permanent (audit trail)

-- Add comments
COMMENT ON POLICY "Users can view their own AI logs" ON public.ai_generation_logs IS 
  'Allow users to SELECT their own AI generation logs';
  
COMMENT ON POLICY "Users can create AI logs" ON public.ai_generation_logs IS 
  'Allow users to INSERT logs for their own AI generation operations';
```

### Krok 3: Rate Limiting Service

**Plik:** `src/lib/services/rate-limit.service.ts`

```typescript
export class RateLimitService {
  private readonly limits = {
    aiGeneration: { requests: 10, windowMs: 60 * 1000 }, // 10 req/min
    aiLogs: { requests: 100, windowMs: 60 * 1000 },      // 100 req/min
  };

  async checkAIRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    // Simple in-memory implementation (for MVP)
    // In production, use Redis
    const key = `ai_gen:${userId}`;
    const now = Date.now();
    const window = this.limits.aiGeneration.windowMs;
    
    // Get current count from memory/Redis
    const current = await this.getCurrentCount(key, now, window);
    const remaining = Math.max(0, this.limits.aiGeneration.requests - current);
    
    return {
      allowed: current < this.limits.aiGeneration.requests,
      remaining,
    };
  }

  async incrementAIRateLimit(userId: string): Promise<void> {
    const key = `ai_gen:${userId}`;
    const now = Date.now();
    await this.incrementCount(key, now);
  }

  private async getCurrentCount(key: string, now: number, windowMs: number): Promise<number> {
    // Implementation depends on storage (memory/Redis)
    // For MVP: simple in-memory Map
    return 0; // Placeholder
  }

  private async incrementCount(key: string, timestamp: number): Promise<void> {
    // Implementation depends on storage
    // For MVP: simple in-memory Map
  }
}
```

### Krok 4: Dokończenie POST /api/v1/ai/decks/from-text

**Aktualizacja:** `src/pages/api/v1/ai/decks/from-text.ts`

```typescript
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createAIDeckSchema } from './from-text.schema';
import { aiService, AIServiceError, AITimeoutError, AIParsingError } from '../../../../../lib/services/ai.service';
import { DeckService } from '../../../../../lib/services/deck.service';
import { CardService } from '../../../../../lib/services/card.service';
import { AILogService } from '../../../../../lib/services/ai-log.service';
import { RateLimitService } from '../../../../../lib/services/rate-limit.service';
import type { 
  AIDeckResponseDTO,
  ErrorResponse, 
  ValidationErrorResponse,
  UnprocessableErrorResponse 
} from '../../../types';

export const POST: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();

  try {
    // STEP 1: Authentication
    const { data: { user }, error: authError } = await locals.supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        } satisfies ErrorResponse),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // STEP 2: Rate limiting
    const rateLimitService = new RateLimitService();
    const rateLimit = await rateLimitService.checkAIRateLimit(user.id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: { 
            code: 'TOO_MANY_REQUESTS', 
            message: 'Rate limit exceeded. Please try again later.' 
          }
        } satisfies ErrorResponse),
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': rateLimit.remaining.toString()
          } 
        }
      );
    }

    // STEP 3: Parse and validate request body
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: { code: 'BAD_REQUEST', message: 'Invalid JSON in request body' }
        } satisfies ErrorResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // STEP 4: Generate cards using AI
    console.log(`🤖 AI generation for user ${user.id}, maxCards: ${validated.maxCards}`);
    
    const generatedCards = await aiService.generateFlashcardsFromText(
      validated.inputText,
      validated.maxCards
    );

    // STEP 5: Create deck and cards in database
    const deckService = new DeckService(locals.supabase);
    const cardService = new CardService(locals.supabase);
    const aiLogService = new AILogService(locals.supabase);

    let deck;
    let cards = [];
    let log;

    try {
      // Create deck
      const deckName = validated.deckName || `AI Generated Deck - ${new Date().toLocaleDateString()}`;
      deck = await deckService.createDeck(user.id, deckName, true);

      // Create cards
      if (generatedCards.length > 0) {
        cards = await cardService.createCardsBatch(deck.id, user.id, generatedCards);
      }

      // Create log entry
      log = await aiLogService.createLog({
        userId: user.id,
        deckId: deck.id,
        inputTextLength: validated.inputText.length,
        generatedCardsCount: generatedCards.length,
        errorMessage: null,
      });

      // Increment rate limit
      await rateLimitService.incrementAIRateLimit(user.id);

    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      
      // Log the failed attempt
      try {
        await aiLogService.createLog({
          userId: user.id,
          deckId: null,
          inputTextLength: validated.inputText.length,
          generatedCardsCount: 0,
          errorMessage: dbError instanceof Error ? dbError.message : 'Unknown database error',
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      throw new Error('Failed to save generated content to database');
    }

    const duration = Date.now() - startTime;
    console.log(`✅ AI generation completed in ${duration}ms: ${cards.length} cards created`);

    // STEP 6: Return success response
    const response: AIDeckResponseDTO = {
      deck: {
        id: deck.id,
        name: deck.name,
        createdByAi: deck.createdByAi,
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt,
      },
      cards: cards.map(card => ({
        id: card.id,
        question: card.question,
        answer: card.answer,
      })),
      log: {
        id: log.id,
        deckId: log.deckId,
        inputTextLength: log.inputTextLength,
        generatedCardsCount: log.generatedCardsCount,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Duration': duration.toString(),
        'X-RateLimit-Remaining': (rateLimit.remaining - 1).toString(),
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ AI generation failed after ${duration}ms:`, error);

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
        { status: 422, headers: { 'Content-Type': 'application/json' } }
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
        { status: 500, headers: { 'Content-Type': 'application/json' } }
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
        { status: 500, headers: { 'Content-Type': 'application/json' } }
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
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const prerender = false;
```

### Krok 5: GET /api/v1/ai/logs

**Plik:** `src/pages/api/v1/ai/logs/index.schema.ts`

```typescript
import { z } from 'zod';

export const listAILogsQuerySchema = z.object({
  deckId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  includeTotal: z.coerce.boolean().default(true),
});

export type ListAILogsQuery = z.infer<typeof listAILogsQuerySchema>;
```

**Plik:** `src/pages/api/v1/ai/logs/index.ts`

```typescript
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { listAILogsQuerySchema } from './index.schema';
import { AILogService } from '../../../../lib/services/ai-log.service';
import type { 
  AILogsListDTO,
  ErrorResponse, 
  ValidationErrorResponse 
} from '../../../types';

export const GET: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();

  try {
    // STEP 1: Authentication
    const { data: { user }, error: authError } = await locals.supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        } satisfies ErrorResponse),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
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
      includeTotal: url.searchParams.get('includeTotal') || undefined,
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
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // STEP 3: Fetch logs from database
    const aiLogService = new AILogService(locals.supabase);
    const result = await aiLogService.listLogs(user.id, {
      deckId: validated.deckId,
      from: validated.from,
      to: validated.to,
      limit: validated.limit,
      offset: validated.offset,
      sort: validated.sort,
      order: validated.order,
    });

    const duration = Date.now() - startTime;
    console.log(`GET /api/v1/ai/logs completed in ${duration}ms (${result.items.length} items)`);

    // STEP 4: Return success response
    return new Response(JSON.stringify(result satisfies AILogsListDTO), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Duration': duration.toString()
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`GET /api/v1/ai/logs failed after ${duration}ms:`, error);

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch AI generation logs',
          details: import.meta.env.DEV && error instanceof Error ? error.message : undefined
        }
      } satisfies ErrorResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const prerender = false;
```

---

## 7. Testowanie

### 7.1 Test Scenarios

**POST /api/v1/ai/decks/from-text:**
1. ✅ Happy path - successful generation
2. ✅ Empty input text - validation error
3. ✅ Too long input text - validation error
4. ✅ Invalid maxCards - validation error
5. ✅ Rate limit exceeded - 429 error
6. ✅ AI service timeout - 500 error
7. ✅ AI parsing error - 422 error
8. ✅ Database error - 500 error with log
9. ✅ Zero cards generated - still success with log

**GET /api/v1/ai/logs:**
1. ✅ List all logs (default params)
2. ✅ Filter by deckId
3. ✅ Filter by date range
4. ✅ Pagination (limit/offset)
5. ✅ Sorting (asc/desc)
6. ✅ Empty result set
7. ❌ Invalid date format - 400 error
8. ❌ Invalid UUID - 400 error

### 7.2 cURL Examples

```bash
# POST AI generation
curl -X POST "http://localhost:4321/api/v1/ai/decks/from-text" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "inputText": "JavaScript is a programming language...",
    "deckName": "JavaScript Basics",
    "maxCards": 10
  }'

# GET AI logs
curl -X GET "http://localhost:4321/api/v1/ai/logs?limit=20&order=desc" \
  -H "Authorization: Bearer <token>"

# GET AI logs with filters
curl -X GET "http://localhost:4321/api/v1/ai/logs?deckId={deckId}&from=2025-01-01T00:00:00Z" \
  -H "Authorization: Bearer <token>"
```

---

## 8. Checklist przed wdrożeniem

- [ ] DeckService implementowany i przetestowany
- [ ] CardService implementowany i przetestowany  
- [ ] AILogService implementowany i przetestowany
- [ ] RateLimitService implementowany (basic version)
- [ ] RLS policies dodane do ai_generation_logs
- [ ] Migracja RLS uruchomiona
- [ ] POST /api/v1/ai/decks/from-text dokończony
- [ ] GET /api/v1/ai/logs zaimplementowany
- [ ] Zod schemas dla logs endpoint
- [ ] Testy manualne przeprowadzone
- [ ] Error handling przetestowany
- [ ] Rate limiting przetestowany
- [ ] Database transactions przetestowane
- [ ] Linter errors rozwiązane
- [ ] TypeScript compilation bez błędów

---

## 9. Znane ograniczenia i future improvements

### Obecne ograniczenia:
1. **Rate limiting** - Simple in-memory implementation (MVP)
2. **Transakcyjność** - Sequential operations, nie fully atomic
3. **Error recovery** - Basic rollback, nie full transaction rollback
4. **Caching** - Brak cache dla AI responses
5. **Monitoring** - Brak detailed metrics dla AI operations

### Planowane usprawnienia:
1. **Redis rate limiting** - Production-ready rate limiting
2. **PostgreSQL RPC** - Atomic transactions dla AI generation
3. **AI response caching** - Cache podobnych requests
4. **Advanced monitoring** - AI success rates, response times
5. **Batch operations** - Bulk AI generation
6. **AI model selection** - User choice of AI model
7. **Custom prompts** - User-defined AI prompts

---

**Koniec planu dokończenia AI Generation.**

