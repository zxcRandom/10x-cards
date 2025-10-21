# Plan implementacji widoku Dashboard

## 1. Przegląd
Widok Dashboard jest centralnym punktem aplikacji (ścieżka "/"), umożliwiającym szybkie generowanie fiszek AI z wklejonego tekstu oraz podgląd ostatnio używanych/stworzonych talii. Interfejs ma być prosty (jednokolumnowy), z wyraźnym polem tekstowym, przyciskiem „Generuj/Anuluj”, stanem ładowania oraz czytelnymi komunikatami walidacji i błędów. W przypadku pomyślnej generacji użytkownik otrzymuje potwierdzenie i link do dalszych działań (docelowo: widok Recenzji).

## 2. Routing widoku
- Ścieżka: `/`
- Plik: `src/pages/index.astro`
- Widok korzysta z layoutu `src/layouts/Layout.astro` i osadza komponenty React przez client directives Astro (`client:load` / `client:idle`).

## 3. Struktura komponentów
Drzewo komponentów (wysoki poziom):

- `IndexPage` (Astro, `src/pages/index.astro`)
  - `DashboardShell` (Astro/React prosty wrapper, opcjonalne)
    - `AIFlashcardGenerator` (React, `src/components/dashboard/AIFlashcardGenerator.tsx`)
      - `Textarea` (shadcn/ui) dla `inputText`
      - `Input` (shadcn/ui) dla opcjonalnej `deckName`
      - `Input` typu number dla `maxCards` (domyślnie 20)
      - `Button` „Generuj”/„Anuluj” (toggle) + spinner
      - Licznik znaków i pomocniczy opis walidacji
    - `RecentDecksList` (React, `src/components/dashboard/RecentDecksList.tsx`)
      - `DeckCard` × N (shadcn/ui `Card`)
      - `EmptyState` (gdy brak talii)
  - `Toaster` (shadcn/ui; globalny, zwykle w layout)

Uwaga: jeśli `Toaster` nie jest jeszcze zainstalowany, dodać go do `Layout.astro` (zalecane), aby toasty działały globalnie.

## 4. Szczegóły komponentów

### AIFlashcardGenerator
- Opis: Formularz do generowania fiszek przez AI. Obsługuje wklejenie tekstu, opcjonalną nazwę talii i limit kart, uruchomienie generowania oraz anulowanie trwającej operacji.
- Główne elementy:
  - `Textarea` (shadcn/ui) dla `inputText` z licznikiem znaków (0–20 000) i `aria-describedby` dla komunikatów.
  - `Input` (opcjonalny) dla `deckName` (1–255)
  - `Input type=number` dla `maxCards` (1–100, default 20)
  - `Button` „Generuj” (gdy idle) / „Anuluj” (gdy loading); `aria-busy` + spinner w stanie ładowania.
  - Teksty pomocnicze: limit znaków, zasady walidacji.
- Obsługiwane interakcje:
  - `onChange` pól: aktualizacja stanu formularza i walidacja na bieżąco.
  - `onSubmit` (klik „Generuj” lub skrót klawiatury Ctrl/Cmd+Enter): wywołanie POST `/api/v1/ai/decks/from-text`.
  - `onCancel`: anulowanie aktywnego `fetch` poprzez `AbortController` (US-017), przycisk zmienia się z „Generuj” na „Anuluj”.
- Obsługiwana walidacja (w UI, przed wywołaniem API):
  - `inputText`: wymagane, `trim()`, długość 1–20 000.
  - `deckName` (opcjonalne): jeśli podane, `trim()`, długość 1–255.
  - `maxCards`: liczba całkowita 1–100, domyślnie 20.
  - Błędy wyświetlane inline pod polami oraz przez `Toast` przy błędach globalnych.
- Typy:
  - `CreateAIDeckCommand` (z `@/types`): { inputText: string; deckName?: string; maxCards?: number }
  - `AIDeckResponseDTO` (z `@/types`): { deck: DeckDTO; cards: Array<{ id: string; question: string; answer: string }>; log: AILogDTO }
  - `ErrorResponse | ValidationErrorResponse | UnprocessableErrorResponse` (z `@/types`).
  - ViewModel (frontend, lokalny): `AIGeneratorFormVM` i `AIGeneratorState` (sekcja 5).
- Propsy: komponent osadzony bez propsów, steruje własnym stanem i publikuje zdarzenia (np. `onSuccess?: (payload: AIDeckResponseDTO) => void`).

### RecentDecksList
- Opis: Lista ostatnio używanych/stworzonych talii użytkownika (np. 5–10 pozycji). Pozwala szybko przejść do pracy z talią.
- Główne elementy:
  - Nagłówek „Ostatnie talie” + link „Zobacz wszystkie” (gdy dostępny docelowy widok listy talii).
  - Siatka `DeckCard` (shadcn/ui `Card`) z nazwą talii, informacją „AI” (gdy `createdByAi = true`) i datą.
  - `EmptyState` z CTA do generacji lub tworzenia nowej talii.
- Obsługiwane interakcje:
  - Klik na kartę talii: przejście do widoku szczegółów/recenzji talii (docelowo np. `/review?deckId=...` lub `/decks/[id]`).
- Walidacja/warunki:
  - Brak walidacji wejścia (tylko parametry query w wywołaniu API).
- Typy:
  - `DecksListDTO` i `DeckDTO` (z `@/types`).
  - ViewModel (opcjonalny): `RecentDeckVM` (sekcja 5).
- Propsy: `limit?: number` (domyślnie 6–8), `sort?: 'updatedAt'|'createdAt'|'name'` (domyślnie `updatedAt`), `order?: 'desc'|'asc'` (domyślnie `desc`).

### DeckCard
- Opis: Karta prezentująca podstawowe informacje o talii (nazwa, znacznik AI, daty) i link do akcji.
- Elementy: `Card` (shadcn/ui) + `CardHeader` + `CardContent` + badge „AI” (gdy dotyczy), przycisk/Link do przejścia.
- Zdarzenia: `onClick` / Link.
- Propsy: `{ deck: DeckDTO }`.

### EmptyState
- Opis: Komponent prezentujący stan pusty listy talii.
- Elementy: ikona, krótki opis, CTA „Wygeneruj fiszki” (scroll/focus do generatora) albo „Stwórz talię”.
- Propsy: opcjonalne CTA.

## 5. Typy
- Z `@/types` (backend DTO):
  - `DeckDTO`, `DecksListDTO`, `AILogDTO`, `AILogsListDTO`, `AIDeckResponseDTO`, `ErrorResponse`, `ValidationErrorResponse`, `UnprocessableErrorResponse`.
- Nowe typy widoku (frontend):
  - `AIGeneratorFormVM`:
    - `inputText: string`
    - `deckName?: string`
    - `maxCards: number` (default 20)
  - `AIGeneratorState`:
    - `isLoading: boolean`
    - `error?: { code: string; message: string; details?: string }`
    - `abortController?: AbortController`
  - `RecentDeckVM` (opcjonalny adapter):
    - `id: string`
    - `name: string`
    - `createdByAi: boolean`
    - `updatedAt: string`

Uwaga: Typy DTO importujemy z `@/types` aby zachować spójność z backendem. Typy ViewModel są lokalne do komponentów (np. `src/components/dashboard/types.ts`).

## 6. Zarządzanie stanem
- `AIFlashcardGenerator`:
  - Lokalny `useReducer` lub `useState` do zarządzania formularzem i stanem zapytania.
  - `AbortController` przechowywany w stanie do anulowania aktywnego żądania (US-017).
  - `useCallback` dla handlerów, `useMemo` dla wyliczeń (np. licznik znaków), `useId` dla a11y.
  - `useTransition` (opcjonalnie) dla niekrytycznych aktualizacji UI.
- `RecentDecksList`:
  - `useEffect` + `useState` do pobrania danych po zamontowaniu.
  - `useMemo` do posortowania/przycięcia wyników jeśli potrzeba.
- Dedykowane hooki (zalecane):
  - `useAIGeneration()` zwraca `{ generate, cancel, state }`.
  - `useDecks(params)` zwraca `{ data, isLoading, error, refetch }`.

## 7. Integracja API
- Generowanie AI:
  - Endpoint: `POST /api/v1/ai/decks/from-text`
  - Body (`CreateAIDeckCommand`): `{ inputText: string; deckName?: string; maxCards?: number }`
  - Odpowiedź (`AIDeckResponseDTO`): `{ deck: DeckDTO; cards: {id,question,answer}[]; log: AILogDTO }`
  - Kody błędów: `400` (walidacja), `401`, `422` (parsowanie AI), `429` (rate limit), `500` (w tym timeout AI).
  - Implementacja: `fetch('/api/v1/ai/decks/from-text', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type':'application/json' }, signal: abortController.signal })`.
  - Obsługa nagłówków: `X-RateLimit-Remaining` (jeśli jest), `X-Request-Duration` (opcjonalnie do metryk UI).
- Ostatnie talie:
  - Endpoint: `GET /api/v1/decks?limit=6&offset=0&sort=updatedAt&order=desc`
  - Odpowiedź (`DecksListDTO`): `{ items: DeckDTO[]; total; limit; offset }`
  - Błędy: `401`, `500`.

## 8. Interakcje użytkownika
- Wklejenie/edycja tekstu w `Textarea`: natychmiastowa walidacja i licznik znaków.
- Klik „Generuj” lub skrót Ctrl/Cmd+Enter: walidacja → POST; przycisk zmienia się na „Anuluj”, pokazuje spinner i blokuje pola formularza.
- „Anuluj”: przerwanie żądania, powrót do stanu idle (toast: „Generowanie anulowane”).
- Sukces 201: toast „Wygenerowano X fiszek w talii ‘Nazwa’”; przycisk/link „Otwórz” (docelowo: widok Recenzji, tymczasowo: szczegóły talii gdy dostępne).
- Błąd/limit: toast z treścią i sugestią (np. „spróbuj ponownie później”).
- Pusta lista talii: `EmptyState` z CTA prowadzącym do generatora.

## 9. Warunki i walidacja
- Zgodnie z `createAIDeckSchema` (backend):
  - `inputText`: 1–20 000 znaków.
  - `deckName?`: jeśli podane, 1–255 znaków.
  - `maxCards`: int 1–100 (default 20).
- Komponent `AIFlashcardGenerator` weryfikuje te warunki przed wywołaniem API, aby ograniczyć błędy 400.
- Dla `GET /decks` parametry ustawiamy bezpiecznie (limit w przedziale 1–100, offset ≥ 0, sort/order z białej listy).
- A11y: `aria-invalid`, `aria-describedby` dla błędów, `aria-busy` w czasie ładowania, `aria-live=polite` dla komunikatów statusu.

## 10. Obsługa błędów
- 400 (VALIDATION_ERROR / BAD_REQUEST):
  - Mapowanie błędów pól do UI (np. `errors[].field` → odpowiednie pole).
  - Ogólny `Toast` z podsumowaniem.
- 401 (UNAUTHORIZED):
  - `Toast` + CTA do logowania lub przekierowanie do ekranu logowania (w zależności od strategii aplikacji).
- 422 (UNPROCESSABLE_ENTITY – AI parsing):
  - `Toast`: „Nie udało się przetworzyć odpowiedzi AI”. Sugeruj skrócenie tekstu/zmniejszenie `maxCards`.
- 429 (TOO_MANY_REQUESTS):
  - `Toast` z informacją o przekroczeniu limitu; jeśli dostępny nagłówek `X-RateLimit-Remaining`, pokaż jego wartość; (opcjonalnie) wyłącz przycisk na krótki czas.
- 500 (INTERNAL_SERVER_ERROR lub timeout AI):
  - `Toast`: „Wystąpił błąd serwera/limit czasu AI”. Sugeruj spróbować później.
- Anulowanie (client):
  - Jeśli `DOMException: AbortError`, pokazujemy łagodny komunikat i nie traktujemy jako błąd.

## 11. Kroki implementacji
1) UI i provider:
   - Upewnij się, że shadcn/ui jest zainicjowany; dodaj `Toaster` do `src/layouts/Layout.astro` (jeśli nie ma).
2) Struktura plików:
   - `src/components/dashboard/AIFlashcardGenerator.tsx`
   - `src/components/dashboard/RecentDecksList.tsx`
   - `src/components/dashboard/DeckCard.tsx`
   - `src/components/dashboard/types.ts` (ViewModel dla tego widoku)
3) Hooki:
   - `src/components/dashboard/hooks/useAIGeneration.ts`: implementacja `generate(payload)`, `cancel()` z `AbortController`, mapowanie błędów.
   - `src/components/dashboard/hooks/useDecks.ts`: pobieranie ostatnich talii, zarządzanie loading/error/success.
4) Implementacja `AIFlashcardGenerator`:
   - Formularz z walidacją po stronie klienta zgodną z `createAIDeckSchema`.
   - Obsługa „Generuj/Anuluj”, spinner, blokada pól przy loading.
   - `Toast` dla sukcesu i błędów; na sukces przekazuj `onSuccess` z payloadem.
5) Implementacja `RecentDecksList` i `DeckCard`:
   - Pobierz `GET /api/v1/decks?limit=6&sort=updatedAt&order=desc`.
   - Pokaż skeleton podczas ładowania; `EmptyState` przy `items.length === 0`.
6) Integracja na stronie:
   - W `src/pages/index.astro` załaduj komponenty React (`client:load`/`client:idle`).
   - Na sukces generowania (callback) pokaż CTA przejścia do dalszego kroku (docelowo widok Recenzji z `deck.id`).
7) A11y i UX szlify:
   - `aria-*`, focus management po błędach, skrót Ctrl/Cmd+Enter.
8) Testy ręczne scenariuszy:
   - Pusty input, za długi input, nazwa talii pusta/za długa, maxCards poza zakresem.
   - Anulowanie w trakcie.
   - Odpowiedzi 401/422/429/500.
9) Dokumentacja:
   - Krótka sekcja „Jak używać” w README lub notatka w `.ai/` z mapowaniem na endpointy.
