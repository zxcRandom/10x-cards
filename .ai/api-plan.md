# REST API Plan

## 1. Resources

- profiles → `public.profiles`
- decks → `public.decks`
- cards → `public.cards`
- reviews → `public.reviews`
- aiGenerationLogs → `public.ai_generation_logs`

Notes
- Users are managed by Supabase Auth (`auth.users`). `profiles.id` references `auth.users.id` (1:1).
- Row Level Security (RLS) is enabled on all tables. Policies must allow authenticated users to access only their own resources. Until policies are added, database access is denied; server routes must either use a service role and enforce authorization in code or RLS policies must be created prior to enabling user-bound access.
- Important indexes (from schema) to leverage in API queries:
  - `idx_decks_user_id` (filter decks by owner)
  - `idx_cards_deck_id`, `idx_cards_next_review_date`, `idx_cards_deck_review` (filter/sort cards by deck and due date)
  - `idx_reviews_card_id`, `idx_reviews_user_id`, `idx_reviews_review_date`, `idx_reviews_user_date`
  - `idx_ai_logs_user_id`, `idx_ai_logs_deck_id`, `idx_ai_logs_created_at`

## 2. Endpoints

Conventions
- Base path: `/api/v1`
- Request/response: JSON; timestamps are ISO-8601 strings (UTC)
- Pagination: `limit` (default 20, max 100), `cursor` (opaque string) OR `offset` (for simpler lists). We provide offset-based pagination for simplicity; endpoints that can benefit from chronological traversal also support `cursor`.
- Sorting: `sort` (field), `order` (`asc`|`desc`)
- Filtering: explicit query parameters described per endpoint

### 2.1 Profiles

1) GET /api/v1/profile
- Method: GET
- Path: `/api/v1/profile`
- Description: Get the authenticated user profile
- Query params: none
- Request JSON: n/a
- Response JSON:
  {
    "id": "uuid",
    "privacyConsent": boolean,
    "deletedAt": string | null,
    "createdAt": string,
    "updatedAt": string
  }
- Success: 200 OK
- Errors: 401 Unauthorized, 404 Not Found (if profile missing), 500 Internal Server Error

2) PATCH /api/v1/profile
- Method: PATCH
- Path: `/api/v1/profile`
- Description: Update privacy consent or soft-delete restore
- Request JSON:
  {
    "privacyConsent"?: boolean,
    "restore"?: boolean  // when true, sets deletedAt to null
  }
- Response JSON: same as GET
- Success: 200 OK
- Errors: 400 Bad Request (invalid fields), 401, 409 Conflict, 422 Unprocessable Entity, 500

3) DELETE /api/v1/profile
- Method: DELETE
- Path: `/api/v1/profile`
- Description: Soft delete profile (sets `deletedAt`)
- Request JSON: n/a
- Response JSON:
  { "status": "deleted", "deletedAt": string }
- Success: 200 OK
- Errors: 401, 409, 500

### 2.2 Decks

1) GET /api/v1/decks
- Method: GET
- Path: `/api/v1/decks`
- Description: List the authenticated user’s decks
- Query params:
  - `limit`?: number (1–100; default 20)
  - `offset`?: number (default 0)
  - `sort`?: `createdAt|updatedAt|name`
  - `order`?: `asc|desc` (default `desc`)
  - `createdByAi`?: boolean
  - `q`?: string (case-insensitive name contains)
- Response JSON:
  {
    "items": [
      { "id": "uuid", "name": "string", "createdByAi": boolean, "createdAt": string, "updatedAt": string },
    ],
    "total": number,
    "limit": number,
    "offset": number
  }
- Success: 200 OK
- Errors: 401, 500

2) POST /api/v1/decks
- Method: POST
- Path: `/api/v1/decks`
- Description: Create a new deck
- Request JSON:
  { "name": "string", "createdByAi"?: boolean }
- Response JSON:
  { "id": "uuid", "name": "string", "createdByAi": boolean, "createdAt": string, "updatedAt": string }
- Success: 201 Created
- Errors: 400 (name empty/too long), 401, 422, 500

3) GET /api/v1/decks/{deckId}
- Method: GET
- Path: `/api/v1/decks/{deckId}`
- Description: Get a deck by id (owned by requester)
- Response JSON: same as POST response
- Success: 200 OK
- Errors: 401, 404 (not found or not owner), 500

4) PATCH /api/v1/decks/{deckId}
- Method: PATCH
- Path: `/api/v1/decks/{deckId}`
- Description: Update deck name
- Request JSON:
  { "name"?: "string" }
- Response JSON: deck object
- Success: 200 OK
- Errors: 400, 401, 403, 404, 422, 500

5) DELETE /api/v1/decks/{deckId}
- Method: DELETE
- Path: `/api/v1/decks/{deckId}`
- Description: Delete deck (cascades to cards via FK)
- Response JSON: { "status": "deleted" }
- Success: 200 OK
- Errors: 401, 403, 404, 500

### 2.3 Cards

1) GET /api/v1/decks/{deckId}/cards
- Method: GET
- Path: `/api/v1/decks/{deckId}/cards`
- Description: List cards in a deck (owned by requester)
- Query params:
  - `limit`?: number (1–100; default 20)
  - `offset`?: number (default 0)
  - `sort`?: `createdAt|updatedAt|nextReviewDate|easeFactor|intervalDays|repetitions`
  - `order`?: `asc|desc`
  - `q`?: string (question contains; simple search)
- Response JSON:
  {
    "items": [
      {
        "id": "uuid", "deckId": "uuid",
        "question": "string", "answer": "string",
        "easeFactor": number, "intervalDays": number, "repetitions": number,
        "nextReviewDate": string,
        "createdAt": string, "updatedAt": string
      }
    ],
    "total": number,
    "limit": number,
    "offset": number
  }
- Success: 200 OK
- Errors: 401, 403, 404 (deck), 500

2) POST /api/v1/decks/{deckId}/cards
- Method: POST
- Path: `/api/v1/decks/{deckId}/cards`
- Description: Create a card in the deck
- Request JSON:
  { "question": "string", "answer": "string" }
- Response JSON: card object
- Success: 201 Created
- Errors: 400 (empty question/answer; >10000 chars), 401, 403, 404 (deck), 422, 500

3) GET /api/v1/cards/{cardId}
- Method: GET
- Path: `/api/v1/cards/{cardId}`
- Description: Get a card (ownership enforced via deck’s user)
- Response JSON: card object
- Success: 200 OK
- Errors: 401, 403, 404, 500

4) PATCH /api/v1/cards/{cardId}
- Method: PATCH
- Path: `/api/v1/cards/{cardId}`
- Description: Update card content (question/answer only; SM-2 fields are managed via review endpoint)
- Request JSON:
  { "question"?: "string", "answer"?: "string" }
- Response JSON: card object
- Success: 200 OK
- Errors: 400, 401, 403, 404, 422, 500

5) DELETE /api/v1/cards/{cardId}
- Method: DELETE
- Path: `/api/v1/cards/{cardId}`
- Description: Delete a card
- Response JSON: { "status": "deleted" }
- Success: 200 OK
- Errors: 401, 403, 404, 500

6) GET /api/v1/decks/{deckId}/cards/due
- Method: GET
- Path: `/api/v1/decks/{deckId}/cards/due`
- Description: List cards due for review (uses `next_review_date <= before`)
- Query params:
  - `before`?: string (ISO date; default now)
  - `limit`?: number (1–100; default 50)
  - `offset`?: number (default 0)
  - `sort`?: `nextReviewDate`
  - `order`?: `asc|desc` (default `asc`)
- Response JSON: same list shape as cards list
- Success: 200 OK
- Errors: 401, 403, 404 (deck), 500

### 2.4 Reviews (SM‑2 review flow)

1) POST /api/v1/cards/{cardId}/review
- Method: POST
- Path: `/api/v1/cards/{cardId}/review`
- Description: Submit a review grade (0–5) and update SM‑2 fields on the card; append review row
- Request JSON:
  { "grade": 0|1|2|3|4|5, "reviewDate"?: string }
- Response JSON:
  {
    "card": {
      "id": "uuid",
      "easeFactor": number,
      "intervalDays": number,
      "repetitions": number,
      "nextReviewDate": string,
      "updatedAt": string
    },
    "review": {
      "id": "uuid",
      "cardId": "uuid",
      "userId": "uuid",
      "grade": number,
      "reviewDate": string
    }
  }
- Success: 200 OK
- Errors: 400 (invalid grade), 401, 403, 404 (card), 409 (concurrent updates), 422, 500

2) GET /api/v1/reviews
- Method: GET
- Path: `/api/v1/reviews`
- Description: List reviews for the authenticated user
- Query params:
  - `cardId`?: uuid
  - `deckId`?: uuid (implies join via cards)
  - `from`?: string (ISO)
  - `to`?: string (ISO)
  - `limit`?: number (1–100; default 50)
  - `offset`?: number (default 0)
  - `sort`?: `reviewDate`
  - `order`?: `asc|desc` (default `desc`)
- Response JSON:
  { "items": [ { "id": "uuid", "cardId": "uuid", "userId": "uuid", "grade": number, "reviewDate": string } ], "total": number, "limit": number, "offset": number }
- Success: 200 OK
- Errors: 401, 500

### 2.5 AI Generation Logs and Deck Generation

1) POST /api/v1/ai/decks/from-text
- Method: POST
- Path: `/api/v1/ai/decks/from-text`
- Description: Generate a deck and cards from input text using AI; logs the attempt in `ai_generation_logs`
- Request JSON:
  {
    "inputText": "string",
    "deckName"?: "string",
    "maxCards"?: number (default 20, max 100)
  }
- Response JSON:
  {
    "deck": { "id": "uuid", "name": "string", "createdByAi": true, "createdAt": string, "updatedAt": string },
    "cards": [ { "id": "uuid", "question": "string", "answer": "string" } ],
    "log": { "id": "uuid", "deckId": "uuid|null", "inputTextLength": number, "generatedCardsCount": number, "errorMessage": string | null, "createdAt": string }
  }
- Success: 201 Created (even if 0 cards created, errorMessage null indicates success)
- Errors: 400 (too long input, empty input), 401, 422, 429 (rate limited), 500

2) GET /api/v1/ai/logs
- Method: GET
- Path: `/api/v1/ai/logs`
- Description: List AI generation logs for the authenticated user
- Query params:
  - `deckId`?: uuid
  - `from`?: string (ISO)
  - `to`?: string (ISO)
  - `limit`?: number (1–100; default 20)
  - `offset`?: number (default 0)
  - `sort`?: `createdAt`
  - `order`?: `asc|desc` (default `desc`)
- Response JSON:
  { "items": [ { "id": "uuid", "deckId": "uuid|null", "inputTextLength": number, "generatedCardsCount": number, "errorMessage": string|null, "createdAt": string } ], "total": number, "limit": number, "offset": number }
- Success: 200 OK
- Errors: 401, 500

### 2.6 Health and Metadata

1) GET /api/v1/health
- Method: GET
- Path: `/api/v1/health`
- Description: Liveness and DB connectivity check
- Response JSON: { "status": "ok", "time": string }
- Success: 200 OK
- Errors: 500 (if DB or dependencies are down)

## 3. Authentication and Authorization

- Auth: Supabase JWT (access token) in `Authorization: Bearer <token>` header.
- Astro 5 middleware: Use `locals.supabase` (bound to the request user) inside API routes in `src/pages/api/**`. Avoid importing a global client; follow workspace rule: use `supabase` from `context.locals`.
- RLS policies (to be defined) should enforce:
  - profiles: user can select/update/delete only where `profiles.id = auth.uid()`
  - decks: user can CRUD only where `decks.user_id = auth.uid()`
  - cards: user can CRUD only where `cards.deck_id in (select id from decks where user_id = auth.uid())`
  - reviews: user can select/insert only where `reviews.user_id = auth.uid()`
  - ai_generation_logs: user can select/insert only where `user_id = auth.uid()`
- Until RLS policies are in place, server routes MUST verify ownership via joins and `user_id` comparisons before calling Supabase (or use RPC functions with `security definer` to encapsulate logic safely).
- Authorization checks per endpoint:
  - All resource endpoints require an authenticated user.
  - Deck/card operations check ownership; card ownership is resolved by joining `cards.deck_id -> decks.user_id`.
  - Review creation enforces `reviews.user_id = auth.uid()` and that `cardId` belongs to user.

Rate Limiting and Abuse Protection
- Global per-IP and per-user rate limits (e.g., 100 req/min; stricter on AI endpoints, e.g., 10 req/min).
- AI deck generation: additional quota controls (daily cap) and size limits (`inputTextLength` and `maxCards`).

Transport and Headers
- HTTPS only; reject requests without TLS in production.
- CORS: allow frontend origin(s) only; block generic `*` in production.

## 4. Validation and Business Logic

Validation (apply with Zod on input; enforce server-side)
- profiles
  - `privacyConsent`: boolean
  - DELETE sets `deletedAt` to now (schema check ensures `deleted_at <= now()` if present)
- decks
  - `name`: required, trimmed, non-empty, length ≤ 255 (schema `non_empty_name`)
- cards
  - `question`, `answer`: required, trimmed, non-empty; length ≤ 10000 (schema `non_empty_*` and length constraints)
- reviews
  - `grade`: integer 0–5 (schema `valid_grade`)
  - `reviewDate`: optional ISO string; default server `now()`
- ai_generation_logs
  - `inputTextLength`: ≥ 0; `generatedCardsCount`: ≥ 0
  - API input `inputText`: trimmed, length ≥ 1; enforce maximum (e.g., 20k chars) before AI call

Business Logic
- SM‑2 Update (on review)
  - Input `grade` (0–5) drives updates to `ease_factor`, `interval_days`, `repetitions`, and `next_review_date` for the card.
  - Use standard SM‑2 rules:
    - If `grade < 3`: set `repetitions = 0`, `interval_days = 1` (or minimal), and reduce `ease_factor` moderately; `next_review_date = now() + interval_days`.
    - Else: increment `repetitions`, compute `interval_days` per SM‑2 (e.g., 1, 6, and thereafter `round(interval_days * ease_factor)`), and adjust `ease_factor = max(1.3, ease_factor + 0.1 - (5 - grade) * 0.08)`.
  - All updates must occur in a single transaction that also inserts a `reviews` row.
- AI Deck Generation
  - Create deck with `created_by_ai = true` (and optional provided name).
  - Generate up to `maxCards` cards; validate each card’s question/answer against length and non-empty rules.
  - Insert an `ai_generation_logs` row capturing `input_text_length`, `generated_cards_count`, and any `error_message`.
  - If generation fails, return 500 and still append a log row with `error_message`.

Error Model
- 200/201 success responses as defined above.
- 400 Bad Request: input validation failures (detail included).
- 401 Unauthorized: missing/invalid token.
- 403 Forbidden: authenticated but not owner.
- 404 Not Found: resource does not exist or not owned.
- 409 Conflict: concurrent update or state conflict.
- 422 Unprocessable Entity: semantically invalid but well-formed (e.g., failing domain rules).
- 429 Too Many Requests: rate limit exceeded (especially AI endpoints).
- 500 Internal Server Error: unhandled errors.

Implementation Notes (Astro + Supabase)
- Place handlers under `src/pages/api/v1/**`. Use the Astro `context.locals.supabase` client bound to the request (workspace rule).
- Validate inputs with Zod schemas co-located per route.
- Use offset-based pagination via `limit` and `offset`; return `total` by running a count query when needed (be mindful of performance; allow client to opt-out of total with `includeTotal=false`).
- Prefer indexed access paths based on schema indexes (e.g., filter cards by `deck_id`; sort due queries by `next_review_date asc`).
- Wrap multi-step operations (e.g., review write + SM‑2 update) in a transaction (use Postgres RPC or a server-side transaction if using a service key).
- Add RLS policies corresponding to authorization rules before deploying user-bound access in production.


