# Plan implementacji widoku Lista talii (/decks)

## 1. Przegląd
Widok prezentuje listę talii (decks) zalogowanego użytkownika i umożliwia ich tworzenie, edycję nazwy oraz usuwanie (z potwierdzeniem). Wspiera paginację, sortowanie, filtrowanie, wyszukiwanie po nazwie oraz obsługę stanów: ładowanie, pusty, błąd.

## 2. Routing widoku
- Ścieżka: `/decks`
- Plik strony: `src/pages/decks/index.astro`
- Renderowanie: Astro layout + komponent(y) React do interaktywności (dialogi, formularze, akcje CRUD)

## 3. Struktura komponentów
- `src/pages/decks/index.astro`
  - Używa `src/layouts/Layout.astro`
  - Montuje Reactowy kontener: `<DecksPage client:load />`
- `src/components/decks/DecksPage.tsx` (kontener widoku)
  - `DecksToolbar` (wyszukiwarka, sort, przycisk „Nowa talia”)
  - `DecksGrid` (siatka kart talii) lub `EmptyState` (gdy brak danych)
  - `PaginationControls`
  - `CreateDeckDialog` (modal)
  - `EditDeckDialog` (modal)
  - `DeleteDeckDialog` (modal z potwierdzeniem)

## 4. Szczegóły komponentów
### DecksPage (kontener)
- Opis: Odpowiada za pobieranie danych, zarządzanie stanem (query params, paginacja, sortowanie), oraz orkiestrację dialogów CRUD.
- Główne elementy: toolbar, grid/empty, paginacja, modale.
- Zdarzenia:
  - Zmiana wyszukiwarki/sortu/filtra → aktualizacja zapytania i refetch.
  - Klik „Nowa talia” → otwórz `CreateDeckDialog`.
  - Akcje na karcie: Edytuj/Usuń → odpowiednie dialogi.
  - Zmiana strony/limit → refetch z nowymi parametrami.
- Walidacja: Delegowana do formularzy w dialogach; sprawdzanie zakresów paginacji (limit 1–100, offset ≥ 0).
- Typy: korzysta z `DecksListDTO`, `DeckDTO` oraz ViewModeli: `DeckListQuery`, `PaginationState`, `SortState`.
- Propsy: brak (komponent wejściowy widoku).

### DecksToolbar
- Opis: Steruje parametrami zapytania listy: wyszukiwarka (q), sort, order oraz zawiera CTA „Stwórz nową talię”.
- Główne elementy: `Input` (q), `Select` (sort: createdAt|updatedAt|name), `Select` (order: asc|desc), `Button` (Nowa talia). Opcjonalnie filtr `createdByAi` (checkbox).
- Zdarzenia: onSearchChange, onSortChange, onOrderChange, onToggleCreatedByAi, onCreate.
- Walidacja: brak (proste sterowanie stanem).
- Typy: `SortField`, `SortOrder`, `DeckListQuery`.
- Propsy: `{ query: DeckListQuery; onChange: (next: DeckListQuery) => void; onCreateClick: () => void }`.

### DecksGrid
- Opis: Prezentuje karty talii w responsywnej siatce.
- Główne elementy: lista `DeckCard`.
- Zdarzenia: przekazuje w dół handlery edycji/usuwania.
- Walidacja: brak.
- Typy: `DeckDTO`, `DeckCardViewModel`.
- Propsy: `{ items: DeckDTO[]; onEdit: (deck: DeckDTO) => void; onDelete: (deck: DeckDTO) => void }`.

### DeckCard
- Opis: Pojedyncza karta talii; pokazuje nazwę, (opcjonalnie) badge „AI”, daty utworzenia/aktualizacji, akcje.
- Główne elementy: `Card`, `Button` (Otwórz), `Button` (Edytuj), `Button` (Usuń).
- Zdarzenia: onOpen (link do `/decks/[deckId]`), onEdit, onDelete.
- Walidacja: brak.
- Typy: `DeckDTO`.
- Propsy: `{ deck: DeckDTO; onEdit: (deck: DeckDTO) => void; onDelete: (deck: DeckDTO) => void }`.

### EmptyState
- Opis: Stan pusty z komunikatem i CTA do stworzenia pierwszej talii.
- Główne elementy: ikonka/ilustracja, tekst, `Button` „Stwórz nową talię”.
- Zdarzenia: onCreateClick.
- Walidacja: brak.
- Typy: —
- Propsy: `{ onCreateClick: () => void }`.

### PaginationControls
- The purpose: Nawigacja po stronach wyników.
- Główne elementy: „Wstecz”/„Dalej”, opcjonalnie wybór `limit`.
- Zdarzenia: onPrev, onNext, onLimitChange.
- Walidacja: blokada przycisków na krańcach (offset=0 lub offset+limit ≥ total).
- Typy: `PaginationState`.
- Propsy: `{ total: number; limit: number; offset: number; onChange: (next: { limit: number; offset: number }) => void }`.

### CreateDeckDialog
- Opis: Modal z formularzem tworzenia talii.
- Główne elementy: `Dialog`, `Input` (name), opcjonalny `Checkbox` createdByAi, `Button` (Anuluj/Zapisz).
- Zdarzenia: onSubmit → POST /api/v1/decks; onClose.
- Walidacja: name wymagane, długość ≤ 255; disabled podczas requestu; reset po sukcesie.
- Typy: `CreateDeckCommand`, `DeckDTO`, `CreateDeckForm`.
- Propsy: `{ open: boolean; onOpenChange: (v:boolean)=>void; onSuccess: (created: DeckDTO) => void }`.

### EditDeckDialog
- Opis: Modal do zmiany nazwy talii.
- Główne elementy: `Dialog`, `Input` (name), `Button` (Anuluj/Zapisz).
- Zdarzenia: onSubmit → PATCH /api/v1/decks/{deckId}; onClose.
- Walidacja: name wymagane, długość ≤ 255; disabled podczas requestu.
- Typy: `UpdateDeckCommand`, `DeckDTO`, `UpdateDeckForm`.
- Propsy: `{ open: boolean; deck: DeckDTO|null; onOpenChange:(v:boolean)=>void; onSuccess:(updated: DeckDTO)=>void }`.

### DeleteDeckDialog
- Opis: Modal z potwierdzeniem destruktywnej akcji (kaskadowe usunięcie talii i fiszek).
- Główne elementy: `Dialog`, ostrzeżenie, `Checkbox` „Rozumiem konsekwencje”, pole opcjonalne potwierdzenia nazwy, `Button` (Anuluj/Usuń).
- Zdarzenia: onSubmit → DELETE /api/v1/decks/{deckId}; onClose.
- Walidacja: przycisk „Usuń” aktywny dopiero po zaznaczeniu checkboxa; (opcjonalnie) dopasowanie wpisanej nazwy do `deck.name`.
- Typy: `DeleteDeckForm`.
- Propsy: `{ open: boolean; deck: DeckDTO|null; onOpenChange:(v:boolean)=>void; onSuccess: (deletedId: string)=>void }`.

## 5. Typy
- Wykorzystanie istniejących DTO z `src/types.ts`:
  - `DeckDTO`, `DecksListDTO`, `CreateDeckCommand`, `UpdateDeckCommand`.
- Nowe typy (ViewModel i stan):
  - `type SortField = 'createdAt' | 'updatedAt' | 'name'`
  - `type SortOrder = 'asc' | 'desc'`
  - `interface DeckListQuery { limit: number; offset: number; sort: SortField; order: SortOrder; createdByAi?: boolean; q?: string }`
  - `interface PaginationState { total: number; limit: number; offset: number }`
  - `interface CreateDeckForm { name: string; createdByAi: boolean }`
  - `interface UpdateDeckForm { name: string }`
  - `interface DeleteDeckForm { acknowledge: boolean; confirmName?: string }`
  - `type DeckCardViewModel = DeckDTO`

Każde pole typów formularzy odwzorowuje kontrolki i walidację po stronie UI.

## 6. Zarządzanie stanem
- Lokalny stan w `DecksPage` (React):
  - `query: DeckListQuery` (kontroluje GET listy)
  - `data: DecksListDTO | null`, `loading: boolean`, `error: Error | null`
  - sterowanie modalami: `isCreateOpen`, `editDeck`, `deleteDeck`
- Custom hooki:
  - `useDecksList(query)` → { data, loading, error, refetch }
  - `useDialogState()` (opcjonalnie) → proste zarządzanie open/close.
- Synchronizacja URL (opcjonalnie): odzwierciedlenie `q`, `sort`, `order`, `limit`, `offset` w query string, by umożliwić deeplinki i nawigację wstecz.

## 7. Integracja API
- Lista talii: GET `/api/v1/decks`
  - Query: `limit, offset, sort, order, createdByAi?, q?`
  - Response: `DecksListDTO`
  - Błędy: `401`, `400 (walidacja zapytań)`, `500`
- Tworzenie talii: POST `/api/v1/decks`
  - Body: `CreateDeckCommand` { name: string; createdByAi?: boolean }
  - Response: `DeckDTO`, status `201`, nagłówek `Location`
  - Błędy: `400`, `401`, `422`, `500`
- Edycja nazwy: PATCH `/api/v1/decks/{deckId}`
  - Body: `UpdateDeckCommand` { name?: string }
  - Response: `DeckDTO`, status `200`
  - Błędy: `400`, `401`, `404`, `422`, `500`
- Usunięcie talii: DELETE `/api/v1/decks/{deckId}`
  - Response: brak treści, status `204`
  - Błędy: `401`, `404`, `500`

Uwierzytelnienie: po stronie UI wywołania są same-origin do serwera Astro; sesja/JWT obsługiwane przez middleware/Supabase (brak ręcznej obsługi tokena w UI).

## 8. Interakcje użytkownika
- Wpisz frazę w wyszukiwarkę → lista filtruje się po nazwie (q); reset offset do 0.
- Zmień sort/order → refetch z nowymi parametrami; reset offset do 0.
- Kliknij „Nowa talia” → otwiera się dialog; po sukcesie toast + odświeżenie listy (lub optymistyczne dodanie na początek).
- Na karcie klik „Edytuj” → dialog; po sukcesie toast + aktualizacja tej karty.
- Na karcie klik „Usuń” → dialog; po potwierdzeniu i sukcesie toast + usunięcie z listy; jeśli lista pusta na stronie >1, przesuń offset wstecz.
- Paginacja: „Wstecz”/„Dalej” aktualizują offset; disabled na krańcach.
- Klik „Otwórz” → przejście do `/decks/[deckId]`.

## 9. Warunki i walidacja
- Formularze:
  - `name`: wymagane, `.trim().length >= 1`, `length <= 255`.
  - `createdByAi`: boolean (domyślnie false).
  - Usuwanie: checkbox „Rozumiem konsekwencje” = true; (opcjonalnie) `confirmName === deck.name`.
- Parametry listy:
  - `limit` w [1,100]; `offset >= 0`; `sort ∈ {createdAt, updatedAt, name}`; `order ∈ {asc, desc}`.
- UI dezaktywuje przyciski submit podczas żądań; zapobiega double-submit; fokus wraca na pierwsze nieprawidłowe pole.

## 10. Obsługa błędów
- Mapowanie wg `.ai/ui-plan.md`:
  - 401/403: komunikat „Twoja sesja wygasła” + CTA logowania/redirect.
  - 404: „Nie znaleziono zasobu” + link „Powrót do listy talii”.
  - 422/400: walidacja inline + krótki toast.
  - 409 (opcjonalnie): komunikat o konflikcie + CTA „Odśwież”.
  - 429 (mało prawdopodobne tu): komunikat o limicie, dezaktywacja akcji na chwilę.
  - 500/Network: toast „Wystąpił błąd. Spróbuj ponownie.”, możliwość ponowienia.
- A11y: region statusu `aria-live="polite"` dla komunikatów, opisy pól przez `aria-describedby`.

## 11. Kroki implementacji
1. Struktura plików (bez logiki):
   - `src/pages/decks/index.astro`
   - `src/components/decks/DecksPage.tsx`
   - `src/components/decks/DecksToolbar.tsx`
   - `src/components/decks/DecksGrid.tsx`
   - `src/components/decks/DeckCard.tsx`
   - `src/components/decks/EmptyState.tsx`
   - `src/components/decks/PaginationControls.tsx`
   - `src/components/decks/CreateDeckDialog.tsx`
   - `src/components/decks/EditDeckDialog.tsx`
   - `src/components/decks/DeleteDeckDialog.tsx`
2. UI bazowy: layout, nagłówek „Moje talie”, toolbar z kontrolkami (bez akcji), siatka placeholderów, paginacja stub.
3. Hook `useDecksList(query)`: fetch GET `/api/v1/decks`; obsługa `loading/error`; integracja z toolbar/paginacją.
4. Render listy: `DecksGrid` z danymi; stan pusty `EmptyState` gdy `total===0`.
5. Dialog „Nowa talia”: formularz, walidacja, POST; po sukcesie zamknięcie, toast, refetch/optimistic update.
6. Dialog „Edycja”: edycja nazwy, walidacja, PATCH; po sukcesie aktualizacja karty.
7. Dialog „Usuń”: checkbox potwierdzenia, DELETE; po sukcesie usunięcie z listy, korekta offsetu jeżeli trzeba.
8. A11y + UX: focus management przy otwarciu/zamknięciu dialogów, aria-atributy, blokady przycisków podczas requestów.
9. Stylowanie: Tailwind (utility classes), spójność z `shadcn/ui` (Button, Dialog, Input, Select). W razie brakujących komponentów – dodać do `src/components/ui`.
10. Testy ręczne: ścieżki szczęśliwe i błędy (401, 400/422, 404, 500), zachowanie paginacji i pustej listy.
11. Refaktoryzacja/porządki: wyodrębnienie wspólnych helperów (format daty, klasy), lekkie memo/`useCallback`.

