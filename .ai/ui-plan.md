# Architektura UI dla 10x-cards

## 1. Przegląd struktury UI

Architektura interfejsu użytkownika (UI) dla aplikacji 10x-cards została zaprojektowana z myślą o prostocie, szybkości wdrożenia i skupieniu na kluczowych funkcjonalnościach MVP. UI będzie minimalistyczne i responsywne, zbudowane w oparciu o Astro (dla statycznych layoutów) i React (dla interaktywnych komponentów), z wykorzystaniem biblioteki komponentów Shadcn/ui i stylizacji Tailwind CSS.

Główna struktura opiera się na kilku kluczowych widokach, które prowadzą użytkownika przez podstawowe przepływy: od generowania fiszek za pomocą AI, przez zarządzanie taliami, aż po sesję nauki. Nawigacja jest prosta i intuicyjna, wykorzystując **górny pasek nawigacyjny (top bar)** zamiast sidebara - prostsze rozwiązanie wystarczające dla MVP. Zarządzanie stanem po stronie klienta będzie realizowane za pomocą wbudowanych hooków React (`useState`, `useEffect`), a obsługa błędów zostanie uproszczona do globalnego komponentu `Toast`.

**Nota MVP (26.10.2025)**: Pierwotnie planowano sidebar (desktop) + hamburger menu (mobile), ale dla MVP zaimplementowano prosty top bar z wszystkimi potrzebnymi linkami. Breadcrumbs zostały pominięte jako niepotrzebne dla obecnych widoków.

## 2. Lista widoków

### Widok: Logowanie
- **Ścieżka widoku**: `/login`
- **Status**: Poza MVP (placeholder)
- **Główny cel**: Umożliwienie użytkownikowi zalogowania się na swoje konto.
- **Kluczowe informacje do wyświetlenia**: Formularz z polami na e-mail i hasło, link do resetowania hasła.
- **Kluczowe komponenty widoku**: `Card`, `Input`, `Button`, `Toast` (dla błędów).
- **UX, dostępność i względy bezpieczeństwa**: Komunikaty walidacji dla pól formularza. Komponent `Toast` do informowania o błędach logowania. Pola hasła powinny maskować wprowadzany tekst.

### Widok: Rejestracja
- **Ścieżka widoku**: `/register`
- **Status**: Poza MVP (placeholder)
- **Główny cel**: Umożliwienie nowemu użytkownikowi założenia konta.
- **Kluczowe informacje do wyświetlenia**: Formularz z polami na e-mail i hasło (z potwierdzeniem).
- **Kluczowe komponenty widoku**: `Card`, `Input`, `Button`, `Toast`.
- **UX, dostępność i względy bezpieczeństwa**: Walidacja formatu e-mail i wymagań dotyczących siły hasła. Jasne komunikaty o błędach (np. zajęty e-mail).

### Widok: Reset hasła
- **Ścieżka widoku**: `/reset-password`
- **Status**: Poza MVP (placeholder)
- **Główny cel**: Umożliwienie ustawienia nowego hasła z linku.
- **Kluczowe informacje do wyświetlenia**: Pola nowe hasło + potwierdzenie.
- **Kluczowe komponenty widoku**: `Card`, `Input`, `Button`, `Toast`.
- **UX, dostępność i względy bezpieczeństwa**: Jasny komunikat o powodzeniu i link do logowania.

### Widok: Dashboard (Panel główny)
- **Ścieżka widoku**: `/`
- **Główny cel**: Centralny punkt aplikacji, umożliwiający szybki dostęp do generowania fiszek AI i przeglądania istniejących talii.
- **Kluczowe informacje do wyświetlenia**: Komponent do generowania fiszek z tekstu, lista ostatnio używanych/stworzonych talii.
- **Kluczowe komponenty widoku**: `Card`, `Input` (dla tekstu do AI), `Button`, `Toast`.
- **UX, dostępność i względy bezpieczeństwa**: Prosty, jednokolumnowy układ. Stan ładowania podczas generowania fiszek przez AI. Obsługa stanu pustego (brak talii). Jeden przycisk „Generuj/Anuluj” (toggle w trakcie przetwarzania); bez paska progresu — tylko spinner i zwięzły komunikat.

### Widok: Recenzja fiszek AI
- **Ścieżka widoku**: `/generate/review`
- **Główny cel**: Przegląd, edycja i zapis fiszek wygenerowanych przez AI.
- **Kluczowe informacje do wyświetlenia**: Lista wygenerowanych par pytanie-odpowiedź, opcje zapisu do nowej lub istniejącej talii.
- **Kluczowe komponenty widoku**: `Card`, `Button`, `Dialog` (do edycji fiszki), `Checkbox`, `Input`.
- **UX, dostępność i względy bezpieczeństwa**: Domyślnie wszystkie fiszki są zaznaczone. Użytkownik może łatwo odznaczyć niechciane fiszki. Edycja w modalu upraszcza interfejs.

### Widok: Lista talii
- **Ścieżka widoku**: `/decks`
- **Główny cel**: Wyświetlenie wszystkich talii użytkownika i umożliwienie zarządzania nimi.
- **Kluczowe informacje do wyświetlenia**: Lista talii w formie kart, przycisk do tworzenia nowej talii.
- **Kluczowe komponenty widoku**: `Card`, `Button`, `Dialog` (do tworzenia/edycji/usuwania talii).
- **UX, dostępność i względy bezpieczeństwa**: Paginacja "Wstecz"/"Dalej" dla długich list. Obsługa stanu pustego.

### Widok: Szczegóły talii
- **Ścieżka widoku**: `/decks/[deckId]`
- **Główny cel**: Wyświetlenie zawartości talii, zarządzanie fiszkami i rozpoczęcie sesji nauki.
- **Kluczowe informacje do wyświetlenia**: Nazwa talii, lista fiszek (pytanie/odpowiedź), przycisk "Ucz się".
- **Kluczowe komponenty widoku**: `Card`, `Button`, `Dialog` (do dodawania/edycji/usuwania fiszek), `Breadcrumb`.
- **UX, dostępność i względy bezpieczeństwa**: Nawigacja okruszkowa (`Moje talie > Nazwa talii`) ułatwiająca powrót. Paginacja dla listy fiszek.

### Widok: Sesja nauki
- **Ścieżka widoku**: `/decks/[deckId]/study`
- **Główny cel**: Przeprowadzenie sesji powtórkowej z wykorzystaniem algorytmu SM-2.
- **Kluczowe informacje do wyświetlenia**: Pytanie z fiszki, przycisk do pokazania odpowiedzi, przyciski oceny (0-5). Po zakończeniu sesji — stan „done” w tej samej trasie z podsumowaniem: liczba ocenionych kart, średnia ocena oraz CTA „Powrót do talii”.
- **Kluczowe komponenty widoku**: `Card`, `Button`.
- **UX, dostępność i względy bezpieczeństwa**: Minimalistyczny interfejs skupiający uwagę na jednej fiszce. Podsumowanie bez dodatkowej nawigacji (ten sam widok), wyraźne CTA „Powrót do talii”.

## 3. Mapa podróży użytkownika

Główny przepływ użytkownika (happy path) koncentruje się na jak najszybszym stworzeniu materiałów do nauki i rozpoczęciu powtórek.

1.  **Start (Dashboard)**: Użytkownik ląduje na panelu głównym. Wkleja tekst (np. fragment dokumentacji) w pole generatora AI i klika "Generuj".
2.  **Recenzja fiszek AI**: Aplikacja przechodzi do widoku recenzji, gdzie wyświetla listę proponowanych fiszek. Użytkownik przegląda listę, odznacza kilka niechcianych fiszek za pomocą checkboxów i klika "Zapisz".
3.  **Zapis do talii**: W prostym formularzu użytkownik tworzy nową talię o nazwie "React Hooks".
4.  **Przekierowanie do talii**: Po zapisie użytkownik jest automatycznie przenoszony do widoku szczegółów nowo utworzonej talii.
5.  **Rozpoczęcie nauki**: W widoku talii użytkownik widzi listę swoich nowych fiszek i klika przycisk "Ucz się".
6.  **Sesja nauki**: Rozpoczyna się sesja nauki. Użytkownikowi prezentowane są po kolei pytania. Po każdej odpowiedzi ocenia swoją wiedzę za pomocą przycisków (0-5).
7.  **Zakończenie sesji**: Po przejściu przez wszystkie fiszki przeznaczone na daną sesję, wyświetla się ekran podsumowania z gratulacjami. Użytkownik klika przycisk "Powrót do talii".
8.  **Powrót**: Użytkownik wraca do widoku szczegółów talii.

## 4. Układ i struktura nawigacji

### Decyzja MVP (Zaimplementowane - 26 października 2025):
**Top bar navigation zamiast Sidebar** ⭐

Nawigacja została **uproszczona dla MVP** z myślą o szybkiej implementacji i wystarczającej funkcjonalności.

- **Główny układ**: Aplikacja wykorzystuje **górny pasek nawigacyjny (top bar)** zamiast bocznego sidebara. Jest to prostsze rozwiązanie wystarczające dla MVP (4-5 głównych linków).
- **Pasek nawigacyjny (AuthNav)**: Horizontal top bar zawierający:
    - **Logo "10x Cards"** (link do Dashboard)
    - **Dashboard** (`/`)
    - **Moje talie** (`/decks`)
    - **Ustawienia** (`/account/settings`) - ukryte na mobile (<768px)
    - **Email użytkownika** (display only, ukryty na małych ekranach)
    - **Wyloguj** (zawsze widoczny)
- **Responsive design**: 
    - Desktop (>1024px): wszystkie linki widoczne
    - Tablet (768-1024px): "Ustawienia" ukryte
    - Mobile (<768px): tylko logo, Dashboard, Moje talie, Wyloguj
- **Nawigacja okruszkowa (Breadcrumb)**: ❌ **Pominięte w MVP** (nie wymagane dla obecnych widoków)
- **Przekierowania**: Kluczowe akcje, takie jak utworzenie talii czy zakończenie sesji nauki, kończą się automatycznym przekierowaniem do odpowiedniego widoku, aby zapewnić płynność przepływu.

### Przyszłe rozbudowy (Post-MVP):
- **Sidebar (desktop)**: Dla lepszego UX gdy będzie więcej linków nawigacyjnych
- **Hamburger menu (mobile)**: Slide-in menu z pełną listą linków
- **Breadcrumbs**: W zagnieżdżonych widokach dla lepszej hierarchii

**Notatka**: Pierwotny plan zakładał sidebar + hamburger, ale dla MVP wystarczający jest prosty top bar.

## 5. Kluczowe komponenty

Poniższe komponenty z biblioteki Shadcn/ui stanowią fundament interfejsu i będą używane w wielu widokach w celu zapewnienia spójności i szybkości rozwoju.

- **`Button`**: Używany do wszystkich akcji wykonywanych przez użytkownika, takich jak "Generuj", "Zapisz", "Ucz się", "Pokaż odpowiedź" oraz przycisków oceny.
- **`Input`**: Podstawowy komponent do wprowadzania tekstu. Używany w formularzach logowania, rejestracji, a także jako pole do wklejania tekstu dla generatora AI.
- **`Card`**: Służy jako kontener do grupowania powiązanych informacji. Będzie używany do wyświetlania talii na liście, fiszek w talii oraz jako główny element interfejsu w sesji nauki.
- **`Dialog`**: Komponent modalny używany do akcji, które wymagają dodatkowego kontekstu lub potwierdzenia, bez opuszczania bieżącego widoku. Przykłady użycia: edycja fiszki, tworzenie nowej talii, potwierdzenie usunięcia.
- **`Toast`**: Służy do wyświetlania krótkich, globalnych powiadomień. W MVP będzie używany głównie do informowania o błędach API w generyczny sposób (np. "Wystąpił błąd. Spróbuj ponownie.").
- **`Checkbox`**: Używany w widoku recenzji fiszek AI do zaznaczania/odznaczania kart przeznaczonych do zapisu.
- **`Breadcrumb`**: Komponent nawigacyjny ułatwiający orientację w hierarchii widoków.

## 6. Stany błędów i limity

W MVP korzystamy z globalnego komponentu `Toast` do komunikatów, ale rozróżniamy klasy błędów i sugerowane działania. Dodatkowo w formularzach prezentujemy walidację inline bezpośrednio pod polami. Poniżej mapowanie statusów HTTP → wzorce UI.

### Mapowanie klas błędów (HTTP → UI)

- 401/403 — Autoryzacja/Uprawnienia
    - Komunikat: „Twoja sesja wygasła” (401) lub „Nie masz uprawnień do tego zasobu” (403).
    - Działania: przycisk „Zaloguj ponownie” (→ `/login`) oraz „Przejdź do pulpitu”. Zapamiętujemy intencję (docelową ścieżkę) w stanie/URL, aby po zalogowaniu wrócić do poprzedniego miejsca.
    - Widoki: ukrywamy/wyłączamy akcje modyfikujące, gdy zasób nie jest własnością użytkownika.

- 404 — Nie znaleziono
    - Komunikat: „Nie znaleziono zasobu (np. talii lub fiszki). Mógł zostać usunięty.”
    - Działania: „Powrót do listy talii” (→ `/decks`). Opcjonalnie automatyczny redirect po 3–5 s.

- 429 — Rate limit (szczególnie AI)
    - Komunikat: „Przekroczono limit żądań. Poczekaj X s i spróbuj ponownie.” (jeśli nagłówek Retry-After) lub „Zbyt wiele prób, spróbuj za chwilę”.
    - Działania: dezaktywacja przycisku „Generuj” z odliczaniem; podpowiedź: „Skróć tekst wejściowy” lub „Zmniejsz liczbę kart”.

- 422 — Walidacja
    - Generator AI: „Tekst jest pusty lub za długi.” Wyświetlany licznik znaków i twardy limit; fokus wraca na pole.
    - Talia: „Nazwa wymagana (≤ 255 znaków).”
    - Fiszka: „Pytanie i odpowiedź są wymagane (≤ 10000 znaków).”
    - UI: błędy inline pod polami + skrótowy `Toast`; region statusu z aria-live="polite".

- 409 — Konflikt (opcjonalnie, np. konkurencyjne zmiany)
    - Komunikat: „Zasób został zmieniony równolegle. Odśwież widok i spróbuj ponownie.”
    - Działania: „Odśwież”.

- 500/Network — Błąd serwera lub sieci
    - Komunikat: „Wystąpił błąd. Spróbuj ponownie.”
    - Działania: „Spróbuj ponownie” (ponów żądanie), „Przejdź do pulpitu”.
    - Offline: banner „Jesteś offline” z automatycznym ukryciem po odzyskaniu połączenia.

### Zasady prezentacji i dostępności

- `Toast`: zwięzły (1–2 zdania), aria-live="polite"; nie zasłania kluczowych CTA.
- Walidacja formularzy: inline pod polami, z czytelnym opisem błędu i powiązaniem przez aria-describedby.
- Przyciski akcji: w trakcie żądania disabled + spinner; dla 429 licznik ponowienia.
- Fokus i klawiatura: po błędzie fokus wraca do problematycznego pola; Esc zamyka dialogi; breadcrumb oznacza aktywny element aria-current="page".

### Punkty integracji w widokach

- Dashboard/Generator AI: 422 (limity treści), 429 (limity AI), 500/Network.
- Recenzja AI (zapis): 422 (walidacja kart/nazwy talii), 500; w przypadku wielu kart iteracyjny zapis powinien agregować błędy do jednego `Toast` + oznaczyć problematyczne pozycje.
- Lista talii i Szczegóły talii (CRUD): 404 (brak zasobu), 401/403 (uprawnienia), 422 (walidacja), 500.
- Sesja nauki: 404 (karta), 409 (konflikty), 500; przy braku due kart stan pusty z informacją.

## 7. Limity wejścia AI

Zgodnie z PRD (US-018) i możliwościami API, UI egzekwuje limity danych wejściowych do generowania fiszek przez AI.

### Limit znaków dla „InputText”
- Twardy limit w MVP: 10 000 znaków (po trim). Dalsze dostosowanie do limitu backendu możliwe w przyszłości.
- Licznik znaków zawsze widoczny obok pola: „X / 10 000”.
- Kolorystyka/stan:
    - < 80% limitu: neutralny.
    - 80–100%: stan ostrzegawczy.
    - > 100%: stan błędu.
- Zachowanie przycisku „Generuj”:
    - Disabled, gdy tekst jest pusty po trim lub przekracza 10 000 znaków.
    - Po kliknięciu wykonywana jest walidacja końcowa (client-side); przy błędzie – komunikat inline i skrócony `Toast`.
- Komunikaty walidacyjne (inline):
    - Pusty tekst: „Wklej tekst, aby rozpocząć.”
    - Przekroczony limit: „Przekroczono limit 10 000 znaków. Skróć tekst i spróbuj ponownie.”
- Dostępność: komunikaty błędów wiązane przez aria-describedby; pole ma etykietę i opis limitu.

### Parametr „maxCards”
- Zakres: 1–100 (domyślnie 20) – zgodnie z API.
- UI: pole liczbowe lub suwak z wyświetlaniem aktualnej wartości i opisem („Maksymalna liczba kart do wygenerowania”).
- Walidacja:
    - Poza zakresem: błąd inline „Dozwolony zakres to 1–100.” i disabled „Generuj”.
    - Wartości niecałkowite zaokrąglane w dół lub blokowane przez kontrolkę.

### Interakcje i stany
- Live-walidacja: licznik i status aktualizują się onInput; walidacja ponawiana onBlur i onSubmit.
- Nadmiernie długi tekst wklejony jednorazowo: UI nie obcina treści automatycznie, ale wyraźnie informuje o przekroczeniu i wskazuje liczbę znaków do usunięcia.
- Anulowanie generowania: w stanie „ładowania” dostępny przycisk „Anuluj”; po anulowaniu neutralny komunikat i CTA „Edytuj tekst” / „Spróbuj ponownie”.

### Zgodność z backendem i bezpieczeństwo
- Wysyłka danych: zawsze z trimmingiem w UI; backend dodatkowo egzekwuje własne limity (np. 20k) i zwraca 422 przy przekroczeniu.
- Prywatność: obok pola tekstowego widoczna informacja, że treść jest wysyłana do dostawcy AI w celu przetworzenia (link do polityki prywatności).
