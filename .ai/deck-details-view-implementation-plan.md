# Plan implementacji widoku Szczegóły talii

## 1. Przegląd

Widok „Szczegóły talii” służy do przeglądania zawartości wybranej talii (lista fiszek), wykonywania operacji CRUD na fiszkach (dodaj/edytuj/usuń), zarządzania samą talią (zmiana nazwy, usunięcie) oraz rozpoczęcia sesji nauki (SM‑2) dla kart wymagających powtórki. Widok łączy statyczny layout Astro z interaktywnymi komponentami React i korzysta z istniejących endpointów API v1.

## 2. Routing widoku

- Ścieżka: `/decks/[deckId]`
- Przekierowania/akcje:
  - „Ucz się” → `/decks/[deckId]/study`
  - Po usunięciu talii → `/decks`

## 3. Struktura komponentów

- `src/pages/decks/[deckId].astro` (strona)
  - Layout: `src/layouts/Layout.astro`
  - `Breadcrumb` (Astro/React prosty)
  - `DeckHeader` (React): nazwa talii + akcje (Ucz się, Zmień nazwę, Usuń talię)
  - `DeckCardsPanel` (React):
    - `CardsToolbar` (wyszukiwarka, rozmiar strony, „Dodaj fiszkę”)
    - `CardsTable` (lista fiszek z akcjami Edytuj/Usuń)
    - `Pagination` (paginacja na podstawie limit/offset)
  - Dialogi (React):
    - `CardDialog` (Dodaj/Edytuj fiszkę)
    - `ConfirmDialog` (Usuń fiszkę / Usuń talię)
  - Globalny `Toast` (obsługa komunikatów)

Proponowana lokalizacja komponentów:

- `src/components/deck/DeckHeader.tsx`
- `src/components/deck/DeckCardsPanel.tsx`
- `src/components/deck/CardsToolbar.tsx`
- `src/components/deck/CardsTable.tsx`
- `src/components/deck/CardDialog.tsx`
- `src/components/ui/ConfirmDialog.tsx`
- `src/components/ui/Pagination.tsx`
- (opcjonalnie) `src/components/ui/Breadcrumb.tsx`

## 4. Szczegóły komponentów

### DeckHeader

- Opis: Wyświetla nazwę talii oraz akcje: „Ucz się”, „Zmień nazwę”, „Usuń talię”. Obsługuje dialog zmiany nazwy i potwierdzenie usunięcia.
- Główne elementy: `h1`, przyciski (`Button` shadcn/ui), `Dialog` (zmiana nazwy), `ConfirmDialog` (usunięcie).
- Obsługiwane interakcje:
  - Klik „Ucz się” → nawigacja do `/decks/[deckId]/study` (po opcjonalnym sprawdzeniu, czy są karty do powtórki).
  - Klik „Zmień nazwę” → otwiera dialog, `PATCH /api/v1/decks/{deckId}`.
  - Klik „Usuń talię” → potwierdzenie, `DELETE /api/v1/decks/{deckId}`, po sukcesie redirect.
- Walidacja:
  - Nazwa talii: string 1–255 (zachowawczo), trim; puste niedozwolone.
- Typy: `DeckDTO` (src/types.ts), `UpdateDeckCommand` (częściowy: `{ name?: string }`).
- Propsy:
  - `deck: DeckDTO`
  - `onRenamed(newName: string): void`
  - `onDeleted(): void`
  - `canStudy?: boolean` (enable/disable przycisk „Ucz się”).

### DeckCardsPanel

- Opis: Kontener logiki listowania kart. Zarządza stanem zapytań (limit, offset, sort, order, q) i odświeżaniem po operacjach CRUD.
- Główne elementy: `CardsToolbar`, `CardsTable`, `Pagination`.
- Interakcje:
  - Zmiana `q`, `limit`, sortowania, strony → `GET /api/v1/decks/{deckId}/cards`.
  - „Dodaj fiszkę” → `CardDialog` → `POST /api/v1/decks/{deckId}/cards` po submit.
  - Edycja/Usunięcie pojedynczej karty → `PATCH/DELETE /api/v1/cards/{cardId}`.
- Walidacja:
  - Wyszukiwanie `q`: max 100 znaków (z backendu), trim.
  - Rozmiar strony: 1–100.
- Typy: `CardsListDTO`, `CardDTO`, `CreateCardCommand`, `UpdateCardCommand`.
- Propsy:
  - `deckId: string`

### CardsToolbar

- Opis: Pasek narzędzi nad listą (wyszukiwarka, selektor rozmiaru strony, przycisk „Dodaj fiszkę”).
- Główne elementy: `Input`, `Select`, `Button`.
- Interakcje:
  - `onSearch(q: string)` (debounce 300 ms).
  - `onPageSizeChange(limit: number)`.
  - `onCreateClick()` → otwiera `CardDialog` (tryb create).
- Walidacja: `q` ≤ 100 znaków, trim; limit ∈ {10,20,50,100}.
- Typy: proste prymitywy.
- Propsy:
  - `q: string`
  - `limit: number`
  - `onSearch(q: string): void`
  - `onLimitChange(n: number): void`
  - `onCreate(): void`

### CardsTable

- Opis: Tabela listy fiszek z kolumnami: Pytanie, Odpowiedź, Następna powtórka, Powtórzenia, EF, Zmieniono, Akcje.
- Główne elementy: tabela z `thead/tbody`, przyciski akcji na wierszu.
- Interakcje:
  - Sortowanie po kliknięciu w nagłówki (pola: `createdAt`, `updatedAt`, `nextReviewDate`, `easeFactor`, `intervalDays`, `repetitions`).
  - „Edytuj” → otwiera `CardDialog` w trybie edit.
  - „Usuń” → `ConfirmDialog` → `DELETE`.
- Walidacja: brak dodatkowej, poza sterowaniem sortem i akcjami.
- Typy: `CardRowVM[]` (VM, patrz sekcja 5), `CardDTO` (źródło danych), sort/order.
- Propsy:
  - `items: CardRowVM[]`
  - `sort: CardsSort`
  - `order: SortOrder`
  - `onSortChange(next: { sort: CardsSort; order: SortOrder }): void`
  - `onEdit(card: CardDTO): void`
  - `onDelete(card: CardDTO): void`

### CardDialog

- Opis: Modal formularza dodawania/edycji karty.
- Główne elementy: `Dialog`, `Textarea` dla „Pytania” i „Odpowiedzi”, przyciski Zapisz/Anuluj.
- Interakcje:
  - Submit create → `POST /api/v1/decks/{deckId}/cards`.
  - Submit edit → `PATCH /api/v1/cards/{cardId}`.
- Walidacja (Zod na froncie):
  - `question`: string (trim) długość 1–10000.
  - `answer`: string (trim) długość 1–10000.
- Typy: `CreateCardCommand`, `UpdateCardCommand`, lokalny `CardFormValues`.
- Propsy:
  - `open: boolean`
  - `mode: 'create' | 'edit'`
  - `initial?: { question: string; answer: string; cardId?: string }`
  - `onClose(): void`
  - `onSubmit(values: CardFormValues): Promise<void>` (zarządza loadingiem/disable).

### ConfirmDialog

- Opis: Uniwersalny modal potwierdzenia akcji destrukcyjnej.
- Główne elementy: `Dialog`, opis, dwa przyciski.
- Interakcje: potwierdzenie/annulowanie.
- Walidacja: brak.
- Typy: proste prymitywy.
- Propsy:
  - `open: boolean`
  - `title: string`
  - `description?: string`
  - `confirmLabel?: string`
  - `destructive?: boolean`
  - `onConfirm(): void`
  - `onCancel(): void`

### Pagination

- Opis: Sterowanie stronicowaniem oparte na `total`, `limit`, `offset`.
- Główne elementy: przyciski „Wstecz/Dalej”, wskaźnik strony.
- Interakcje: `onPageChange(nextOffset)`.
- Walidacja: granice paginacji (0 ≤ offset < total).
- Typy: prymitywy.
- Propsy:
  - `total: number`
  - `limit: number`
  - `offset: number`
  - `onChange(offset: number): void`

## 5. Typy

Wykorzystujemy istniejące DTO z `src/types.ts` oraz definiujemy lekkie ViewModele do prezentacji.

- Istniejące DTO:
  - `DeckDTO`: { id: string; name: string; createdByAi: boolean; createdAt: string; updatedAt: string }
  - `CardsListDTO`: { items: CardDTO[]; total: number; limit: number; offset: number }
  - `CardDTO`: { id, deckId, question, answer, easeFactor, intervalDays, repetitions, nextReviewDate, createdAt, updatedAt }
  - `CreateCardCommand`: { question: string; answer: string }
  - `UpdateCardCommand`: { question?: string; answer?: string }

- Nowe typy (frontend ViewModel i pomocnicze):
  - `type CardsSort = 'createdAt' | 'updatedAt' | 'nextReviewDate' | 'easeFactor' | 'intervalDays' | 'repetitions'`
  - `type SortOrder = 'asc' | 'desc'`
  - `interface CardRowVM { id: string; question: string; answer: string; nextReviewDate?: string; repetitions: number; easeFactor: number; intervalDays: number; updatedAt: string; raw: CardDTO }`
  - `interface PaginationState { limit: number; offset: number; total: number }`
  - `interface DeckDetailsState { deck?: DeckDTO; cards: CardDTO[]; total: number; limit: number; offset: number; sort: CardsSort; order: SortOrder; q: string; loading: boolean; error?: string; }`
  - `interface CardFormValues { question: string; answer: string }`

## 6. Zarządzanie stanem

- Źródła prawdy: backend (API). Front zarządza lokalnym stanem listy jako wyników zapytań.
- Custom hook: `useDeckDetails(deckId)` w `src/components/deck/hooks/useDeckDetails.ts`:
  - Stan: jak w `DeckDetailsState`.
  - Akcje: `loadDeck()`, `loadCards()`, `createCard(values)`, `updateCard(cardId, values)`, `deleteCard(cardId)`, `renameDeck(name)`, `deleteDeck()`.
  - Obsługa zależności: przeładowanie kart po zmianie `q`, `limit`, `offset`, `sort`, `order`.
  - Optymalizacje: `useTransition` dla przełączeń sort/paginacji; `useCallback` dla handlerów; `useMemo` do mapowania `CardRowVM`.
  - Anulowanie żądań: `AbortController` przy zmieniającym się `q` (debounce + abort poprzedniego).

## 7. Integracja API

- `GET /api/v1/decks/{deckId}` → `DeckDTO`
- `PATCH /api/v1/decks/{deckId}` body: `{ name?: string }` → `DeckDTO`
- `DELETE /api/v1/decks/{deckId}` → 204 No Content
- `GET /api/v1/decks/{deckId}/cards` query: `{ limit, offset, sort, order, q }` → `CardsListDTO`
- `POST /api/v1/decks/{deckId}/cards` body: `CreateCardCommand` → `CardDTO`
- `PATCH /api/v1/cards/{cardId}` body: `UpdateCardCommand` → `CardDTO`
- `DELETE /api/v1/cards/{cardId}` → `{ status: 'deleted' }`
- (Opcjonalnie, do stanu „Ucz się”): `GET /api/v1/decks/{deckId}/cards/due?limit=1` → jeśli `total > 0`, aktywuj CTA; w przeciwnym razie pokaż komunikat.

Obsługa błędów wg `ErrorResponse` i kodów `HttpStatus`/`ErrorCode`:

- 400/422 → walidacja (pokazuj błędy pól, fallback: toast)
- 401/403 → komunikat o autoryzacji; opcjonalnie redirect do logowania
- 404 → komunikat „Nie znaleziono”; dla talii — sekcja „Not Found”
- 429 → „Zbyt wiele zapytań” + proponuj spróbować później
- 500 → „Wystąpił błąd serwera”

## 8. Interakcje użytkownika

- Wejście na `/decks/[deckId]` → ładowanie talii i pierwszej strony kart; stan ładowania w tabeli.
- Wpisanie w wyszukiwarkę → debounce 300 ms → reset offset=0 → reload listy.
- Zmiana rozmiaru strony → reset offset=0 → reload listy.
- Klik nagłówka tabeli → zmiana sort/order → reload listy.
- „Dodaj fiszkę” → dialog → walidacja → POST → zamknięcie dialogu → toast „Dodano” → reload listy (offset=0).
- „Edytuj” → dialog z wstępnymi wartościami → PATCH → toast „Zapisano” → odśwież wiersz/listę.
- „Usuń” (karta) → confirm → DELETE → toast „Usunięto” → reload listy (utrzymaj offset, skoryguj jeśli pusta strona).
- „Zmień nazwę” (talii) → dialog → PATCH → aktualizacja nagłówka → toast.
- „Usuń talię” → confirm → DELETE → redirect `/decks` + toast.
- „Ucz się” → jeśli brak due → toast/info; jeśli są due → nawigacja do `/decks/[deckId]/study`.

## 9. Warunki i walidacja

- `CardDialog`:
  - `question` i `answer`: trim; długość 1–10000; w przypadku naruszenia pokaż pod polem; blokuj Submit.
- `CardsToolbar`:
  - `q`: trim; długość ≤ 100; przekroczenia obcinaj lub blokuj wpis.
  - `limit`: {10,20,50,100}; fallback 20.
- `DeckHeader` rename:
  - `name`: trim; niepuste; długość konserwatywnie ≤ 255.
- Paginacja: `offset` w granicach; przy usunięciu ostatniego elementu na stronie przejdź do poprzedniej strony.
- „Ucz się”: przycisk nieaktywny gdy trwa ładowanie sprawdzenia due; komunikat, gdy `total === 0`.

## 10. Obsługa błędów

- Mapowanie `ErrorResponse.error.code` → komunikaty przyjazne użytkownikowi (Toast + opis):
  - `VALIDATION_ERROR`/`BAD_REQUEST` → pokaż błędy pól; highlight invalid.
  - `UNAUTHORIZED`/`FORBIDDEN` → „Wymagane logowanie lub brak uprawnień”.
  - `NOT_FOUND`/`DECK_NOT_FOUND`/`CARD_NOT_FOUND` → informacja + CTA powrotu.
  - `TOO_MANY_REQUESTS` → „Przekroczono limit — spróbuj później”.
  - `INTERNAL_SERVER_ERROR` → „Wystąpił błąd. Spróbuj ponownie”.
- Retry: nie dla mutacji; dla listy — wbudowany przycisk „Spróbuj ponownie”.
- Anulowanie: AbortController dla wyszukiwarki; ignoruj spóźnione odpowiedzi.

## 11. Kroki implementacji

1. Utwórz stronę `src/pages/decks/[deckId].astro` z layoutem i kontenerem React (`DeckCardsPanel`) oraz SSR fetchem `GET /api/v1/decks/{deckId}` do nagłówka (lub pierwsze renderowanie client-side, jeśli wolisz uproszczenie).
2. Zaimplementuj `DeckHeader` z dialogiem zmiany nazwy i potwierdzeniem usunięcia; podłącz `PATCH` i `DELETE` endpointy; obsłuż toasty i redirect.
3. Zaimplementuj `DeckCardsPanel` i hook `useDeckDetails(deckId)` (stan: limit=20, offset=0, sort='createdAt', order='desc', q='').
4. Zaimplementuj `CardsToolbar` (debounce wyszukiwarki, selektor limitu, przycisk „Dodaj…”).
5. Zaimplementuj `CardsTable` z sortowaniem po dopuszczalnych kolumnach i akcjami wiersza (Edytuj/Usuń).
6. Zaimplementuj `CardDialog` (Zod walidacja) dla create/edit; podłącz `POST`/`PATCH`.
7. Zaimplementuj `ConfirmDialog` (wspólny) i `Pagination` (poprawne wyliczanie next/prev offsetu).
8. Do „Ucz się”: dodaj lekkie sprawdzenie `GET /api/v1/decks/{deckId}/cards/due?limit=1` do aktywacji CTA; obsłuż brak due (info) vs nawigacja do `/study`.
9. Dodaj `Toast` dla powodzeń i błędów; ustandaryzuj mapowanie błędów.
10. Stylizacja Tailwind 4 + shadcn/ui (Button, Dialog, Input, Select, Textarea, Table). Zapewnij dostępność ARIA dla dialogów i kontrolki formularzy (aria-\*).
11. Testy ręczne i szybkie: scenariusze z US‑009/010/011 + błędy (401/404/422) + pusta lista + wyszukiwanie + sort/paginacja.
12. Refaktoryzacja: ewentualny wydzielony `apiClient` (fetchJson) w `src/lib/utils.ts` i typowane wywołania.
