# Plan implementacji widoku Recenzja fiszek AI

## 1. Przegląd
Widok pozwala użytkownikowi przejrzeć fiszki wygenerowane przez AI, opcjonalnie je edytować lub odrzucić, a następnie zapisać wybrane fiszki do nowej lub istniejącej talii. W aktualnym API generowanie tworzy już talię i fiszki w bazie; widok działa więc jako ekran „przeglądu i finalizacji”, który stosuje edycje i selekcję (usunięcia/przeniesienia) przed zakończeniem procesu i przekierowaniem do widoku talii.

## 2. Routing widoku
- Ścieżka: `/generate/review`
- Wejście do widoku:
  - Query param: `deckId` (wymagane) – identyfikator talii utworzonej przez endpoint AI.
  - Opcjonalnie: `state` z nawigacji zawierający wynik `AIDeckResponseDTO` (jeśli przychodzimy bezpośrednio po wygenerowaniu), co pozwoli uniknąć dodatkowego fetcha na start.

## 3. Struktura komponentów
- `src/pages/generate/review.astro` (Astro)
  - Osadzony komponent React: `<ReviewAICardsView />`
    - `Toolbar`
      - `DeckDestinationSelector` (radio: „Nowa talia”/„Istniejąca talia”)
      - `DeckNameInput` (dla „Nowej talii”)
      - `ExistingDeckSelect` (dla „Istniejącej talii”)
      - `BulkActions` (np. „Zachowaj wszystkie”, „Odznacz wszystkie”)
    - `CardsList`
      - wiele `AICardItem`
        - `Checkbox` (zaznaczenie do zapisu)
        - `CardContent` (pytanie/odpowiedź)
        - `ActionButtons` (Edytuj | Odrzuć | Zachowaj)
        - `EditCardDialog` (modal do edycji)
    - `SaveBar` (przyklejony do dołu): „Zapisz wybrane (N)” + opcjonalnie „Anuluj”
    - `Toasts` (powiadomienia o sukcesie/błędach)

Uwaga: UI bazuje na shadcn/ui oraz Tailwind. Komponenty o większej logice w React, layout i stałe elementy w Astro.

## 4. Szczegóły komponentów
### ReviewAICardsView (root)
- Opis: Orkiestruje stan widoku, integrację z API i renderuje podkomponenty.
- Główne elementy: Toolbar, CardsList, SaveBar, Toasts.
- Interakcje: inicjalizacja danych, zarządzanie selekcją/edycją/odrzuceniem, zapis.
- Walidacja: weryfikacja docelowej talii (nazwa lub wybór istniejącej), podstawowe reguły treści kart.
- Typy: wykorzystuje `DeckDTO`, `CardDTO`, `AIDeckResponseDTO`, `CreateCardCommand`, `UpdateCardCommand` + własne ViewModel-e (sekcja 5).
- Propsy: brak (root w widoku), czyta `deckId` z URL oraz opcjonalny `state`.

### Toolbar
- Opis: Pasek działań nad listą.
- Elementy: RadioGroup (docelowa talia), Input (nazwa dla „nowej”), Select (lista istniejących talii), przyciski masowe.
- Interakcje: zmiana trybu docelowej talii, ustawienie nazwy/wyboru talii, akcje masowe: „Zachowaj wszystkie”, „Odznacz wszystkie”.
- Walidacja: nazwa talii (min. 1 znak po trimie), wybór istniejącej talii gdy wybrano tryb „istniejąca”.
- Typy: `DeckDestinationVM`.
- Propsy: `{ destination, onChange, onKeepAll, onUncheckAll, decks, decksLoading }`.

### CardsList
- Opis: Lista fiszek do przeglądu; wspiera przewijanie.
- Elementy: Container z siatką/listą kart, opcjonalnie wirtualizacja przy większych listach.
- Interakcje: sterowanie zaznaczeniem wszystkich/wybranych, przekazanie akcji do `AICardItem`.
- Walidacja: brak własnej (deleguje do itemów i zapisu).
- Typy: `ReviewCardVM[]`.
- Propsy: `{ items, onEdit, onDiscard, onToggleSelect }`.

### AICardItem
- Opis: Pojedyncza fiszka z checkboxem i akcjami.
- Elementy: `Card` (shadcn), Checkbox, przyciski Edytuj/Odrzuć/Zachowaj, pola pytania/odpowiedzi w skrócie.
- Interakcje: zaznaczenie (checkbox), otwarcie dialogu, lokalne oznaczenie jako odrzucone, oznaczenie „zachowaj”.
- Walidacja: podglądowa (np. pokazanie, że pole po edycji nie może być puste — docelowo w dialogu).
- Typy: `ReviewCardVM`.
- Propsy: `{ card, onEdit, onDiscard, onToggleSelect }`.

### EditCardDialog
- Opis: Modal do edycji pytania/odpowiedzi.
- Elementy: Dialog (shadcn), `Input` + `Textarea` (lub dwa `Textarea`), przyciski „Zapisz zmiany”/„Anuluj”.
- Interakcje: walidacja treści, zapis zmian do stanu (nie do API od razu).
- Walidacja: minimalnie `question.trim().length > 0`, `answer.trim().length > 0`; opcjonalnie limity długości zgodne z serwerem.
- Typy: `EditCardForm`.
- Propsy: `{ open, initialValue, onClose, onSubmit, pending }`.

### SaveBar
- Opis: Pasek na dole z podsumowaniem i CTA.
- Elementy: licznik wybranych, główny przycisk „Zapisz wybrane (N)”, opcjonalne „Anuluj”.
- Interakcje: trigger procesu zapisu; blokada podczas trwania zapisu.
- Walidacja: przycisk aktywny, gdy N > 0 oraz poprawnie ustawione miejsce docelowe.
- Typy: proste prymitywy, ewentualnie `SavePlan` dla tooltipu podglądu.
- Propsy: `{ selectedCount, disabled, onSave }`.

## 5. Typy
- Z API (`src/types.ts`):
  - `DeckDTO`, `CardDTO`, `AIDeckResponseDTO`, `CreateCardCommand`, `UpdateCardCommand`, `DeckDeletedDTO`, `ErrorResponse`, `ValidationErrorResponse`.
- Nowe ViewModel-e (frontend):
  - `type ReviewCardVM = {
      id: string;
      question: string;
      answer: string;
      selected: boolean;      // domyślnie true
      edited: boolean;        // true po lokalnej edycji
      original: { question: string; answer: string };
      // statusy procesu zapisu (opcjonalnie):
      saveState?: 'pending' | 'success' | 'error';
      errorMessage?: string;
    }`
  - `type DeckDestinationVM = {
      mode: 'new' | 'existing';
      newName: string;           // wymagane gdy mode = 'new' (może nadpisać nazwę AI talii)
      existingDeckId?: string;   // wymagane gdy mode = 'existing'
    }`
  - `type EditCardForm = { question: string; answer: string }`
  - `type SavePlan = {
      // dla mode = 'new':
      renameDeck?: { deckId: string; name: string };
      patchCards?: Array<{ cardId: string; data: UpdateCardCommand }>;
      deleteCards?: string[];
      // dla mode = 'existing':
      createInDeckId?: string;
      createCards?: Array<{ deckId: string; data: CreateCardCommand; sourceCardId: string }>; // do ew. usunięcia źródłowych
      deleteSourceCards?: string[];
      maybeDeleteSourceDeck?: { deckId: string };
    }`

## 6. Zarządzanie stanem
- Hooki customowe:
  - `useAICardReviewState(initial: { deck: DeckDTO; cards: CardDTO[] })`
    - Stan: `cards: ReviewCardVM[]`, `destination: DeckDestinationVM`, `dirty: boolean`, `pending: boolean`.
    - Akcje: `toggleSelect(id)`, `selectAll()`, `uncheckAll()`, `edit(id, form)`, `discard(id)`, `setDestination(dest)`.
  - `useDecks()` – pobiera listę istniejących talii do selecta (z paginacją i filtrem nazwy, lazy load).
  - `useSavePlan({ deckId, vm })` – buduje plan zapisu na podstawie stanu i trybu.
  - `useUnsavedChangesPrompt(dirty)` – ostrzega przed utratą zmian przy opuszczeniu widoku.
- Techniki: `useReducer` dla spójności zmian na `cards`, `useTransition` podczas zapisu, optymistyczne flagi na itemach.

## 7. Integracja API
- Wejście danych:
  - Preferowane: `AIDeckResponseDTO` w `state` po navigacji z ekranu generowania (unikanie fetchu).
  - Alternatywa: fetch na starcie według `deckId`:
    - `GET /api/v1/decks/{deckId}` → `DeckDTO`
    - `GET /api/v1/decks/{deckId}/cards?limit=100&offset=0` → `CardsListDTO`
  - Dla listy istniejących talii: `GET /api/v1/decks?limit=50&offset=0` → `DecksListDTO` (pag. klienta/serwera).

- Zapis – tryb „Nowa talia” (talia AI już istnieje):
  1) Jeśli nazwa została zmieniona: `PATCH /api/v1/decks/{deckId}` z `UpdateDeckCommand`.
  2) Dla każdego zaznaczonego i edytowanego: `PATCH /api/v1/cards/{cardId}` z `UpdateCardCommand`.
  3) Dla każdego NIEzaznaczonego: `DELETE /api/v1/cards/{cardId}`.

- Zapis – tryb „Istniejąca talia”:
  1) Dla każdego zaznaczonego (z uwzględnieniem lokalnych edycji):
     `POST /api/v1/decks/{targetDeckId}/cards` z `CreateCardCommand`.
  2) Po sukcesie tworzenia – usunąć źródłowe fiszki z talii AI: `DELETE /api/v1/cards/{cardId}`.
  3) (Opcjonalnie) Jeśli talia AI została opróżniona: `DELETE /api/v1/decks/{sourceDeckId}`.

- Statusy i błędy:
  - `401/403` – przekierowanie do logowania lub komunikat o braku uprawnień.
  - `404` – komunikat o braku talii/karty; reweryfikacja danych.
  - `422` – błędy walidacji (pokaż inline w dialogu i/lub toast z listą).
  - `500` – ogólny błąd – pokaż toast, umożliw retry.

- Uwierzytelnienie: wywołania do `/api` w tej samej domenie, cookies przekazywane automatycznie; brak bezpośrednich wywołań do Supabase z frontu.

## 8. Interakcje użytkownika
- Zaznacz/odznacz pojedynczą fiszkę – checkbox zmienia `selected`.
- „Zachowaj wszystkie” – ustawia `selected=true` dla wszystkich nieodrzuconych.
- „Odznacz wszystkie” – ustawia `selected=false` dla wszystkich.
- „Edytuj” – otwiera modal; po „Zapisz zmiany” karta ma `edited=true` i wartości w VM zaktualizowane.
- „Odrzuć” – usuwa kartę z listy UI (soft-delete), oznacza do usunięcia na etapie zapisu.
- Zmiana docelowej talii – przełącza UI i walidację (nazwa vs. wybór istniejącej).
- „Zapisz wybrane (N)” – uruchamia proces zapisu zgodnie z `SavePlan` i pokazuje postęp (możliwe porcjowanie żądań). Po sukcesie – redirect do widoku talii docelowej z komunikatem o liczbie zapisanych.

## 9. Warunki i walidacja
- Karta:
  - question: `trim().length > 0` (UI), docelowo 422 jeśli serwer odrzuci (np. limit długości).
  - answer: `trim().length > 0` (UI), jw.
- Docelowa talia:
  - mode = `new`: `newName.trim().length > 0` (jeśli różna od nazwy AI – wykona się `PATCH`).
  - mode = `existing`: `existingDeckId` wymagane; walidacja, że deck istnieje na liście.
- Zapis aktywny tylko gdy `selectedCount > 0` i warunki docelowej talii spełnione.

## 10. Obsługa błędów
- Walidacja klienta: inline (pod polami) i toast z podsumowaniem.
- Walidacja serwera (422): mapowanie `ValidationErrorResponse.error.errors[]` do pól w dialogu edycji.
- Błędy sieci/500: toast, możliwość ponowienia akcji (np. per-karta przy symbolu błędu w itemie).
- Częściowe sukcesy (tryb „istniejąca talia”): raport ile kart skopiowano, ile nie; umożliwić retry tylko dla nieudanych.
- `401`: przekierowanie do logowania lub wyświetlenie CTA „Zaloguj ponownie”.
- `403/404`: komunikat i powrót do listy talii/generowania.

## 11. Kroki implementacji
1. Routing
   - Utwórz `src/pages/generate/review.astro` z osadzeniem `<ReviewAICardsView />` i pobieraniem `deckId` z URL.
2. Typy i kontrakty
   - Dodaj ViewModel-e w `src/types.ts` (lub lokalne typy w folderze komponentu) zgodnie z sekcją 5.
3. UI i komponenty
   - Utwórz `src/components/generate/ReviewAICardsView.tsx` (root) + podkomponenty (`Toolbar`, `DeckDestinationSelector`, `CardsList`, `AICardItem`, `EditCardDialog`, `SaveBar`).
   - Wykorzystaj shadcn/ui: `Card`, `Button`, `Dialog`, `Checkbox`, `Input`, `Textarea`, `Select`, `Toast`.
   - Styluj Tailwindem; zadbaj o focus ringi i ARIA (role, aria-label, aria-describedby, aria-expanded, aria-controls, aria-current gdzie sensowne).
4. Hooki i stan
   - Zaimplementuj `useAICardReviewState`, `useDecks`, `useSavePlan`, `useUnsavedChangesPrompt`.
   - Domyślnie wszystkie karty `selected=true`.
5. Inicjalizacja danych
   - Jeśli w `history.state` jest `AIDeckResponseDTO`, zainicjalizuj z niego.
   - W innym przypadku pobierz: `GET /api/v1/decks/{deckId}` oraz `GET /api/v1/decks/{deckId}/cards`.
   - Równolegle pobierz listę istniejących talii do selecta (`GET /api/v1/decks`).
6. Walidacja UI
   - Dodaj zod (opcjonalnie) do formularza edycji karty i nazwy talii, mapuj błędy do komponentów.
7. Zapis (akcja CTA)
   - Zbuduj `SavePlan` na podstawie stanu (mode `new` lub `existing`).
   - Wykonuj żądania sekwencyjnie lub porcjami (np. 5–10 równolegle) z kontrolą błędów.
   - Po sukcesie: redirect do `/decks/{targetDeckId}` + toast „Zapisano N fiszek”.
8. Edge cases i UX
   - Potwierdzenie wyjścia przy niezapisanych zmianach.
   - Skeletony/ładowanie dla list i selecta.
   - Empty states: brak kart po odrzuceniu wszystkich – CTA „Wróć do generowania”.
9. Testy (opcjonalnie)
   - Jednostkowe dla `useSavePlan` (happy path + błędy 422/500).
   - Snapshoty bazowych komponentów UI.
10. Dostępność
   - Zapewnij focus management w dialogu, odpowiednie role ARIA, widoczne stany fokus/hover.

---

Notatki zgodności ze stosami:
- Astro 5 + React 19 – komponenty interaktywne wyłącznie w React; layout i routy w Astro.
- Tailwind 4 – klasy utility, dark mode, responsive warianty.
- shadcn/ui – spójne, dostępne komponenty (Dialog, Card, Button, Checkbox, Input, Textarea, Select, Toast).
- Integracja z API – wyłącznie przez ścieżki `/api/v1/...`, bezpośredni Supabase tylko w backendzie Astro.
- Zod – walidacja wejścia na froncie spójna z walidacją w API.
