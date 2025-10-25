**Opis Usługi**
- Usługa `OpenRouterService` udostępnia jednolity interfejs do wywoływania endpointu `POST https://openrouter.ai/api/v1/chat/completions` w kontekście Astro 5 i TypeScript 5.
- Odpowiada za budowę ładunku żądań (system/user messages, parametry modelu, response_format), autoryzację, logikę retry oraz walidację odpowiedzi pod schemat JSON.
- Integruje się z istniejącym katalogiem `src/lib/services` oraz z warstwą API (`src/pages/api/v1/ai/*`) zapewniając SSR-safe dostęp do klucza OpenRouter przechowywanego w `import.meta.env`.
- Współpracuje z istniejącymi hookami React (np. `useAIGeneration`) dostarczając im typowane DTO oraz opcję streamingu do UI Shadcn.
- Loguje zużycie tokenów i przekazuje dane do `rate-limit.service` w celu egzekwowania budżetu na użytkownika.

**Opis Konstruktora**
- Parametr `config: OpenRouterConfig` zawiera bazowy URL, nagłówki (`Authorization`, `HTTP-Referer`, `X-Title`), domyślny model i ustawienia retry – inicjalizowany przez fabrykę korzystającą z Zod do walidacji env.
- Parametr `httpClient: typeof fetch` domyślnie korzysta z globalnego `fetch`, ale może być wstrzyknięty (np. podczas testów jednostkowych z `undici`).
- Parametr `logger: Logger` zapewnia redagowane logi (np. pino) zgodne z polityką prywatności.
- Parametr `rateLimiter: RateLimitService` integruje kontrolę przepustowości z aktualnym użytkownikiem i scenariuszem (generacja talii, review).

**Publiczne Metody i Pola**
- `generateChat(request: ChatRequestDTO): Promise<ChatResponseDTO>` wykonuje pojedyncze żądanie czatu, waliduje odpowiedź i zwraca główny komunikat asystenta wraz z metadanymi modelu.
- `streamChat(request: ChatRequestDTO): AsyncGenerator<ChatStreamChunk>` inicjuje strumień; obsługuje transformację `ReadableStream` na asynchroniczny generator kompatybilny z Astro API Routes.
- `withOverrides(overrides: Partial<ChatDefaults>): OpenRouterService` zwraca sklonowaną instancję z nadpisanymi parametrami (np. inny model dla recenzji).
- `defaults` (pole tylko do odczytu) ujawnia aktywne ustawienia domyślne (model, `temperature`, `top_p`, schematy odpowiedzi) dla diagnostyki i testów.
- 1. System message example: `const systemMessage = { role: 'system', content: 'You are a concise flashcard generator for STEM topics.' };` wykorzystywany przy budowaniu `messages`.
- 2. User message example: `const userMessage = { role: 'user', content: 'Create 5 flashcards about Newtonian mechanics.' };` dodawany jako ostatni element żądania.
- 3. Response_format example: `const responseFormat = { type: 'json_schema', json_schema: { name: 'flashcard_batch', strict: true, schema: { type: 'object', required: ['cards'], properties: { cards: { type: 'array', items: { type: 'object', required: ['front','back'], properties: { front: { type: 'string' }, back: { type: 'string' }, hint: { type: 'string' } } } } } } } };` wstrzykiwany do payloadu, a wynik walidowany po stronie serwera.
- 4. Model name example: `const model = 'openrouter/anthropic/claude-3.5-sonnet';` ustawiany na poziomie instancji lub per wywołanie.
- 5. Model params example: `const params = { temperature: 0.4, top_p: 0.9, max_output_tokens: 1200, seed: 42 };` łączone z domyślnymi wartościami w metodzie `buildPayload`.

**Prywatne Metody i Pola**
- `buildPayload(request: ChatRequestDTO): OpenRouterPayload` łączy domyślne i dostarczone parametry, filtruje puste pola oraz wymusza spójność ról wiadomości.
- `executeFetch(payload: OpenRouterPayload, signal?: AbortSignal): Promise<Response>` dodaje nagłówki, ustawia timeout (np. `AbortController` z 30 s) i realizuje retry zgodnie z polityką.
- `parseResponse(res: Response): Promise<ChatResponseDTO>` obsługuje `res.json()`, walidację schematu poprzez Zod/Ajv oraz rekonstrukcję pełnej treści z `choices`.
- `handleStream(res: Response): AsyncGenerator<ChatStreamChunk>` mapuje strumień NDJSON na `ChatStreamChunk`, dołącza usage chunk i sygnalizuje koniec strumienia.
- `mapError(err: unknown, context: ErrorContext): OpenRouterError` klasyfikuje błędy i nadaje kody (np. `configuration`, `auth`, `throttled`, `upstream`, `schema`).
- Prywatne pola `config`, `logger`, `rateLimiter`, `defaults` oraz `abortTimeoutMs` przechowują zależności i ustawienia runtime.

**Obsługa Błędów**
- 1. Brak klucza w środowisku: rzucenie `ConfigurationError`, log ostrzegawczy i blokada konstruktora.
- 2. Odpowiedź 401/403: zamiana na `AuthenticationError`, informacja do UI bez ujawniania szczegółów; rekomendacja regeneracji klucza.
- 3. Limit 429: odczyt `retry-after`, wykorzystanie `rateLimiter.scheduleRetry()` i zwrot błędu `ThrottledError` z komunikatem o przeciążeniu.
- 4. Timeout/5xx: próba ponowienia (np. 3 razy z backoff), po przekroczeniu `ServiceUnavailableError` z sugestią ponowienia.
- 5. Nieważny JSON lub brak `{ choices }`: `SchemaValidationError` z dołączoną diagnostyką (ID logu) oraz fallback do tekstu surowego.
- 6. Zerwany stream lub abort klienta: przerwanie `AbortController`, log na poziomie debug i czyszczenie zasobów.
- 7. Przekroczenie budżetu tokenów: `QuotaExceededError` inicjowany przez `rateLimiter`, UI otrzymuje informację o konieczności poczekania.

**Kwestie Bezpieczeństwa**
- Przechowywać `OPENROUTER_API_KEY` wyłącznie po stronie serwera, używać prefiksu `PRIVATE_` lub `.env` bez eksportu do klienta.
- Redagować treści promptów w logach (`logger.redact(['messages.*.content'])`) by spełnić wymagania prywatności i RODO.
- Walidować payloady użytkownika Zodem przed wysłaniem do OpenRouter, chroniąc API przed injekcją poleceń.
- Używać HTTPS oraz nagłówka `HTTP-Referer` wskazującego domenę aplikacji, co podnosi zaufanie w OpenRouter.
- Ograniczać dostęp do endpointu przez middleware autoryzacyjne (np. Supabase session z `context.locals.supabase`).
- Obsługiwać anulowanie (AbortController) by uniknąć wycieków zasobów oraz niekontrolowanych połączeń utrzymanych przez długi czas.

**Plan Wdrożenia Krok Po Kroku**
- Skonfiguruj env: dodaj do `.env` zmienne `OPENROUTER_API_KEY`, `OPENROUTER_DEFAULT_MODEL`, `OPENROUTER_REFERRER`, upewnij się że są oznaczone jako server-only w `src/env.d.ts`.
- Utwórz `src/lib/services/openrouter/openrouter.config.ts` z walidacją Zod (`safeParse(import.meta.env)`), eksportując `createOpenRouterConfig()`.
- Dodaj `OpenRouterService` w `src/lib/services/openrouter/openrouter.service.ts` implementując konstruktor i metody opisane powyżej (TypeScript 5, moduły ESM).
- Rozszerz `src/lib/services/ai.service.ts` aby delegować zapytania do nowej usługi, zachowując istniejące interfejsy DTO.
- Dodaj adapter API w `src/pages/api/v1/ai/chat.ts`: `export const prerender = false`, pobierz supabase user, zweryfikuj quota, wywołaj `OpenRouterService.generateChat` lub `streamChat`.
- Zaimplementuj response_format JSON schema per use-case (np. generacja fiszek) i walidację wyników przy pomocy Ajv lub Zod (`safeParse` na zserializowanej treści).
- Przygotuj testy jednostkowe (`vitest`) mockujące `fetch` i `rateLimiter`, weryfikujące scenariusze błędów opisane w sekcji obsługi.
- Zaktualizuj hooki React (`useAIGeneration`, `useReviewSubmit`) aby korzystały z nowego endpointu i reagowały na komunikaty o throttlingu.
- Dodaj telemetry/observability: integracja z istniejącym loggerem, metryki (czas odpowiedzi, koszty) – rozważyć eksport do Supabase lub OpenTelemetry.
- Dokumentuj w README konfigurację środowiska i przykładowe wywołanie API (curl) wraz z opisem system/user messages i response_format.
- Wykonaj testy E2E (`npm run test:ai-endpoints`) oraz ręczne scenariusze streamingu, sprawdź logi pod kątem redakcji i braku wrażliwych danych.
