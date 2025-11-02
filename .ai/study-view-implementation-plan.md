# Plan implementacji widoku Sesja nauki

## 1. Przegląd

Widok „Sesja nauki” umożliwia przeprowadzenie powtórek z wybranej talii zgodnie z algorytmem SM-2. Użytkownik widzi pytanie, może odsłonić odpowiedź, a następnie ocenia swoją wiedzę w skali 0–5. Po ocenieniu system zapisuje recenzję poprzez API i przechodzi do kolejnej fiszki. Gdy nie ma kart do nauki, widok pokazuje stan pusty; po zakończeniu sesji pokazuje podsumowanie w tym samym widoku i CTA „Powrót do talii”.

## 2. Routing widoku

- Ścieżka: `/decks/[deckId]/study`
- Plik strony: `src/pages/decks/[deckId]/study.astro`
- Architektura: strona Astro (layout, statyczna rama) + komponent React do interakcji (`StudySession.tsx`) osadzony z hydracją `client:load`.

## 3. Struktura komponentów

- `src/pages/decks/[deckId]/study.astro`
  - używa `Layout.astro`
  - renderuje klientowy komponent React: `<StudySession deckId={deckId} />`
- `src/components/study/StudySession.tsx` (React – logika sesji)
  - `LoadingState` (sekcja z loaderem)
  - `EmptyState` (brak kart do nauki)
  - `ErrorState` (błędy API i autoryzacji)
  - `StudyCard` (kontener pytania/odpowiedzi + sterowanie)
    - `QuestionView`
    - `AnswerView`
    - `ReviewControls` (przyciski 0–5)
  - `SessionSummary` (podsumowanie po zakończeniu)

## 4. Szczegóły komponentów

### Study page (`study.astro`)

- Opis: Ustalony szkielet strony z layoutem. Pobiera `deckId` z params i przekazuje do komponentu React.
- Główne elementy: kontener, nagłówek (nazwa „Sesja nauki”), slot na komponent React.
- Interakcje: brak (statyczny wrapper).
- Walidacja: brak (walidacja w komponencie React).
- Typy: `deckId: string` (UUID) z parametru trasy.
- Propsy: przekazanie `deckId` do `StudySession`.

### `StudySession`

- Opis: Główny komponent sterujący przebiegiem sesji – pobiera „due cards”, pokazuje aktualną fiszkę, odsłania odpowiedź, umożliwia ocenę, wysyła recenzję, przechodzi do kolejnej.
- Główne elementy:
  - Sekcje stanu: Loading, Empty, Error, Active, Done
  - Składowe: `StudyCard`, `ReviewControls`, `SessionSummary`
- Obsługiwane interakcje:
  - „Pokaż odpowiedź” – przełącza `showAnswer=true`
  - Ocena 0–5 – wysyła POST review i przechodzi do następnej karty
  - Skróty klawiaturowe: klawisze `0–5` jako alternatywa dla kliknięć (opcjonalne)
- Walidacja:
  - `deckId` zgodny z UUID (wstępnie po stronie klienta, aby uniknąć zbędnych wywołań)
  - Blokada przycisków oceny, dopóki odpowiedź nie jest odsłonięta
  - Debounce/blokada wielokrotnego kliknięcia w trakcie wysyłki (`isSubmitting`)
- Typy: `DueCardsListDTO`, `CardDTO`, `ReviewGrade`, `ReviewResponseDTO`, `ErrorResponse` (z `src/types.ts`) + własne VM (sekcja 5)
- Propsy: `{ deckId: string }`

### `StudyCard`

- Opis: Prezentacja jednej fiszki; w trybie pytania ukrywa odpowiedź, po kliknięciu pokazuje odpowiedź.
- Główne elementy:
  - Kontener `Card` (Shadcn/ui), tytuł „Pytanie”, treść pytania
  - Przycisk `Button` „Pokaż odpowiedź” (gdy `showAnswer=false`)
  - Sekcja odpowiedzi (gdy `showAnswer=true`)
- Interakcje: „Pokaż odpowiedź” – informuje rodzica (callback) o zmianie stanu
- Walidacja: przycisk pokazania odpowiedzi nieaktywny w trakcie ładowania/wysyłki
- Typy: `StudyCardVM`
- Propsy: `{ card: StudyCardVM; showAnswer: boolean; onShowAnswer: () => void }`

### `ReviewControls`

- The purpose: Zestaw 6 przycisków ocen (0–5) wraz z opisami: „Nic nie wiem”, „Źle”, „Trudno”, „Dobrze”, „Łatwo”, „Bardzo łatwo”.
- Główne elementy: 6 x `Button` (Shadcn/ui) z wariantami kolorystycznymi Tailwind.
- Interakcje: kliknięcie wysyła ocenę do rodzica: `onGrade(grade: ReviewGrade)`.
- Walidacja: disabled, jeśli `!showAnswer || isSubmitting`.
- Typy: `ReviewGrade`
- Propsy: `{ disabled: boolean; onGrade: (g: ReviewGrade) => void }`

### `SessionSummary`

- Opis: Podsumowanie sesji (liczba ocenionych kart, średnia ocena, CTA „Powrót do talii”).
- Główne elementy: `Card` z danymi podsumowania i `Button` do powrotu.
- Interakcje: kliknięcie CTA przenosi do `/decks/[deckId]`.
- Walidacja: brak (prezentacja z agregacji statystyk).
- Typy: `StudySessionStats`
- Propsy: `{ deckId: string; stats: StudySessionStats }`

## 5. Typy

- Istniejące (z `src/types.ts`):
  - `CardDTO`, `DueCardsListDTO`, `ReviewResponseDTO`, `ReviewGrade`, `ErrorResponse`, `HttpStatus`
- Nowe typy (lokalne dla widoku – w pliku komponentu lub `src/components/study/types.ts`):
  - `type StudyCardVM = {
  id: string;
  deckId: string;
  question: string;
  answer: string;
  nextReviewDate: string; // ISO-8601
  easeFactor?: number;
  intervalDays?: number;
  repetitions?: number;
}`
  - `type StudyState = 'loading' | 'ready' | 'submitting' | 'done' | 'error'`
  - `type StudySessionStats = {
  reviewedCount: number;
  gradesCount: Record<ReviewGrade, number>; // {0: n, 1: n, ..., 5: n}
  averageGrade: number; // 0..5
}`
  - `type ApiErrorUI = { status: number; code: string; message: string; details?: string }`

Uwaga: `StudyCardVM` jest projekcją `CardDTO` do potrzeb UI; można mapować bezpośrednio po pobraniu z API.

## 6. Zarządzanie stanem

- Stan źródłowy w `StudySession`:
  - `state: StudyState` – cykl: `loading` -> `ready` -> `submitting` (przejściowo) -> `done` lub `error`
  - `cards: StudyCardVM[]` – kolejka kart do nauki (posortowane wg `nextReviewDate` rosnąco)
  - `index: number` – wskaźnik bieżącej karty
  - `showAnswer: boolean` – czy odpowiedź jest odsłonięta
  - `isSubmitting: boolean` – blokada UI podczas POST
  - `stats: StudySessionStats` – akumulacja danych sesji
  - `error?: ApiErrorUI` – ostatni błąd krytyczny
- Hooki:
  - `useDueCards(deckId: string, opts?: { before?: string; limit?: number })`
    - cel: pobrać karty do nauki z `/api/v1/decks/{deckId}/cards/due`
    - zwraca: `{ data, loading, error, refetch, abort }`
  - `usePostReview()`
    - cel: wysyłka oceny do `/api/v1/cards/{cardId}/review`
    - zwraca: `{ submit: (cardId: string, grade: ReviewGrade, reviewDate?: string) => Promise<ReviewResponseDTO>, submitting, error }`
  - (opcjonalnie) `useHotkeys()` do obsługi 0–5

## 7. Integracja API

- Pobieranie kart do nauki:
  - GET `/api/v1/decks/{deckId}/cards/due?before=${encodeURIComponent(nowIso)}&limit=50&offset=0&order=asc`
  - Odpowiedź: `DueCardsListDTO` — `{ items: CardDTO[]; total: number; limit: number; offset: number }`
  - Mapowanie do `StudyCardVM`
- Zapisywanie oceny:
  - POST `/api/v1/cards/{cardId}/review`
  - Body: `{ grade: ReviewGrade, reviewDate?: string }`
  - Odpowiedź: `ReviewResponseDTO` — zawiera zaktualizowaną kartę (SM-2) i rekord recenzji
- Kody błędów do obsługi: `401`, `403`, `404`, `409`, `422`, `500` (w części 10 opisane strategie)

## 8. Interakcje użytkownika

- Wejście na stronę: pokazanie loadera -> pobranie kart -> jeden z widoków: Empty/Active/Error
- „Pokaż odpowiedź”: odsłonięcie odpowiedzi; fokus przenosi się na pierwszy przycisk oceny
- Ocena 0–5: natychmiastowy POST; przyciski zablokowane podczas wysyłki; po sukcesie przejście do kolejnej karty
- Koniec puli: pokazanie `SessionSummary` z wynikami i CTA „Powrót do talii”
- Dostępność:
  - Role/ARIA: `aria-live="polite"` dla komunikatów statusu; `aria-pressed` nie dotyczy (przyciski chwilowe)
  - Skróty `0–5` (opcjonalnie), `Enter` jako „Pokaż odpowiedź”
  - Widoczny fokus, odpowiednie `aria-label` z oceną i opisem

## 9. Warunki i walidacja

- `deckId` – wstępna walidacja formatem UUID (regex); w przypadku niezgodności: pokaż komunikat i nie wywołuj API
- Stany API:
  - `401` – wymagana autentykacja (komunikat + link/przycisk do logowania, w MVP komunikat)
  - `403` – brak dostępu do talii (komunikat)
  - `404` – talia nie istnieje (komunikat)
- Interfejs:
  - Przyciski ocen są dostępne tylko po odsłonięciu odpowiedzi
  - W trakcie POST przyciski są `disabled` (zapobieganie wielokrotnym wysyłkom)
  - Płynne przejście do następnej karty; jeśli nastąpi błąd przy POST, pozostajemy na tej samej karcie

## 10. Obsługa błędów

- GET due:
  - `401/403/404` – przejście do `ErrorState` z przyciskiem „Powrót do talii”
  - Inne błędy sieci/`500` – komunikat „Wystąpił błąd. Spróbuj ponownie.” + przycisk „Ponów próbę”
- POST review:
  - `400/422` – nieprawidłowe dane/semantyka: pokaż toast z komunikatem; pozostaw kartę (użytkownik może ponowić)
  - `409` – konflikt (np. równoczesna aktualizacja): strategia „refetch due list” i kontynuacja, lub komunikat i pominięcie karty
  - `401/403/404` – komunikat; możliwość powrotu
  - Błędy sieci: retry jednokrotny (opcjonalnie) albo komunikat i pozostanie na karcie
- A11y: komunikaty w `aria-live` dla stanów sukces/błąd

## 11. Kroki implementacji

1. Utwórz strukturę katalogów: `src/components/study/`
2. Dodaj stronę `src/pages/decks/[deckId]/study.astro`:
   - pobierz `deckId` z `Astro.params`
   - załaduj komponent `<StudySession deckId={deckId} client:load />`
3. Zaimplementuj `src/components/study/StudySession.tsx`:
   - stan: `state`, `cards`, `index`, `showAnswer`, `isSubmitting`, `stats`, `error`
   - efekt: fetch due cards (GET) po zamontowaniu, mapowanie do `StudyCardVM`
   - render: stany (Loading/Empty/Error/Active/Done)
   - logika: `onShowAnswer`, `onGrade` -> POST review -> aktualizacja `stats` -> przejście do następnej karty -> `done` jeśli koniec
4. Zaimplementuj `StudyCard.tsx` i `ReviewControls.tsx` (lub jako podkomponenty w `StudySession.tsx`):
   - wykorzystaj `Button` z `src/components/ui/button.tsx`
   - dodaj klasy Tailwind (min. odstępy, responsywność)
5. Zaimplementuj `SessionSummary.tsx`:
   - wyświetl `reviewedCount`, `averageGrade` (liczone z `stats`), CTA „Powrót do talii” (`/decks/${deckId}`)
6. (Opcjonalnie) Dodaj hooki `useDueCards` i `usePostReview` dla separacji logiki i łatwiejszego testowania.
7. Dodaj obsługę A11y:
   - `aria-live` dla komunikatów
   - etykiety `aria-label` dla przycisków ocen
   - fokus po odsłonięciu odpowiedzi na pierwszy przycisk oceny
8. Scenariusze brzegowe:
   - brak kart (EmptyState)
   - błędy GET/POST (ErrorState/Toast + retry)
   - `409` — refetch i kontynuuj lub omiń kartę
9. Ręczne sprawdzenie przepływu:
   - talia z kartami „due”: pełna sesja z kilkoma ocenami
   - talia bez kart „due”: pusty stan
   - symulacja błędu POST (np. odłączenie sieci): poprawne komunikaty i blokady UI
10. Drobne ulepszenia (później):

- skróty klawiaturowe `0–5`
- progres (np. „3/20”) i lekki wskaźnik postępu
- zapamiętanie ostatniej oceny w `stats` z rozbiciem

Uwagi implementacyjne zgodnie z projektem:

- Używaj Astro do layoutu i React tylko tam, gdzie potrzebna interaktywność.
- Stylowanie Tailwind 4 (klasy narzędziowe); spójne z projektem (Shadcn/ui `Button`).
- Walidacja i obsługa błędów zgodna z kontraktami endpointów i typami w `src/types.ts`.
- Brak modyfikacji modeli domenowych — VM są lokalne dla UI.
