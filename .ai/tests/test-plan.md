# Plan testów – 10x Cards (MVP)

## 1. Wprowadzenie i cele testowania

Celem jest weryfikacja jakości i gotowości MVP aplikacji 10x Cards do wdrożenia produkcyjnego. Plan pokrywa testy warstw: UI (Astro/React), API (Astro Server Endpoints + Supabase), logikę domenową (services/hooks), integracje zewnętrzne (OpenRouter AI) oraz migracje bazy (Supabase). Priorytetem są ścieżki krytyczne: uwierzytelnianie, zarządzanie taliami i fiszkami, generowanie AI oraz sesje nauki (SM‑2).

## 2. Zakres testów

W zakresie:

- Frontend: strony Astro i interaktywne komponenty React (shadcn/ui, Tailwind 4).
- Backend: endpointy w `src/pages/api`, middleware, usługi w `src/lib/services`, hooki w `src/components/hooks`.
- Baza: schemat, migracje i RLS Supabase (własność zasobów, izolacja użytkowników).
- Integracje: OpenRouter (mock w testach), Supabase SDK.
- Skrypty testowe bash w repo (weryfikacja endpointów).

Poza zakresem w tej iteracji:

- Pełne testy na realnych modelach AI (testy integracyjne z AI będą oparte o mock/stub/MSW).
- Rozbudowane testy urządzeń mobilnych (minimum rozdzielczości + responsywność są w zakresie).

## 3. Typy testów

- Testy jednostkowe (Vitest):
  - `src/lib/services/*` (np. `card.service.ts`, `ai.service.ts`, `ai-log.service.ts`).
  - `src/components/hooks/*` (logika danych: `useDecks`, `useDeckDetails`, `useDueCards`, `useAIGeneration`, `useReviewSubmit`).
  - `src/lib/utils/*` i walidacje.
- Testy komponentów (React Testing Library + Astro Testing):
  - Komponenty UI (dialogi, formularze auth, listy decków/kart, widoki review/study).
  - A11y (axe) dla kluczowych stron Astro i komponentów interaktywnych.
- Testy integracyjne (API + DB):
  - Endpointy w `src/pages/api/*` z Supabase (lokalna baza testowa, migracje).
  - Weryfikacja RLS/ownership (np. tworzenie kart tylko w swoich taliach).
- Testy E2E (Playwright):
  - Rejestracja → logowanie → tworzenie talii → generowanie AI → zapis kart → nauka.
  - Nawigacja, ochrona tras, sesje, błędy.
- Testy wydajnościowe (k6/Artillery):
  - API generowania AI (limity, czasy), listy decków/kart, review submit.
- Testy bezpieczeństwa:
  - RLS Supabase (próby dostępu do cudzych zasobów), CSRF/SSRF (w obrębie możliwości), walidacje wejścia (Zod), rate‑limiting na krytycznych endpointach.
- Testy regresji wizualnej (Playwright screenshots) – krytyczne ekrany.
- Testy migracji DB (Supabase):
  - Aplikacja migracji, integralność schematu, zgodność ze stanem aplikacji.

## 4. Scenariusze testowe (kluczowe)

### 4.1. Uwierzytelnianie (Auth)

- Rejestracja nowego użytkownika:
  - Wejście: email/hasło (poprawne, niepoprawne, zduplikowany email).
  - Oczekiwane: konto utworzone, komunikaty błędów przy walidacji, brak wycieku szczegółów.
- Logowanie:
  - Poprawne dane → redirect do dashboardu.
  - Błędne hasło → kontrolowany błąd, brak informacji czy email istnieje.
- Reset hasła (OTP):
  - Żądanie OTP, weryfikacja formatu, czas ważności.
  - Ustawienie nowego hasła, ponowne logowanie działa.
- Sesja i nawigacja:
  - Dostęp do stron chronionych tylko dla zalogowanych.
  - Wylogowanie czyści stan i dostęp.

### 4.2. Talia (Decks)

- Tworzenie talia (CreateDeckDialog):
  - Walidacje (nazwa wymagana, max długości), sukces tworzenia, pojawia się w liście i ostatnich.
- Edycja i usuwanie talii:
  - Aktualizacja nazwy/opisu, potwierdzenia, komunikaty błędów.
- Lista talii (paginacja, sortowanie, filtr):
  - Paginacja działa deterministycznie, sort po dacie/nazwie, filtr tekstowy.
- Własność:
  - Użytkownik A nie widzi i nie może modyfikować talii użytkownika B (RLS).

### 4.3. Karty (Cards) – CardService

- Utworzenie pojedynczej karty (`createCard`):
  - Wejście: pytanie/odpowiedź (trim), deckId istnieje.
  - Oczekiwane: SM‑2 domyślne pola: `easeFactor=2.5`, `intervalDays=1`, `repetitions=0`, `nextReviewDate=now`.
  - Błędy: `DECK_NOT_FOUND` (23503), `DATABASE_ERROR`, `INTERNAL_SERVER_ERROR`.
- Batch tworzenie (`createCardsBatch`):
  - Sprawdzenie własności talii przed insertem (`verifyDeckOwnership`).
  - Case: deck nie istnieje → `DECK_NOT_FOUND`; cudzy deck → `FORBIDDEN`.
  - Sukces: liczba utworzonych = długość wejścia, mapowanie do DTO.
- Pobranie karty (`getCardById`):
  - Dostęp tylko właścicielowi (JOIN z `decks.user_id`).
  - Nieistniejąca lub cudza → `null`.
- Aktualizacja (`updateCard`):
  - Tylko `question`/`answer` (SM‑2 pola ignorowane); trim; cudza/nieistniejąca → `CARD_NOT_FOUND`.
- Lista (`listCards`):
  - Paginacja: `limit/offset` deterministyczna.
  - Sort: mapowanie pól na kolumny (`created_at`, `next_review_date` itd.).
  - Filtr: `q` → `ilike(question)`.
  - Zwraca `items`, `total`, `limit`, `offset`.

### 4.4. Generowanie AI (Generate)

- Generowanie kart (hook `useAIGeneration`, `ai.service.ts`):
  - Mock odpowiedzi modelu (MSW) w wariantach: poprawny, pusty, niespójny format.
  - Obsługa błędów (limity, 429/5xx), idempotencja UI, retry/backoff (jeśli zaimplementowane).
- Przegląd i edycja (`ReviewAICardsView`, `EditCardDialog`, `SaveBar`):
  - Edycja pytań/odpowiedzi, usunięcie pozycji, walidacje.
  - Zapis batch do wybranej talii → użycie `createCardsBatch` + własność.

### 4.5. Nauka (Study – SM‑2)

- Pobranie zaległych kart (`useDueCards`):
  - Kryterium daty `next_review_date <= now` dla zalogowanego użytkownika.
- Przebieg sesji (`StudySession`, `ReviewControls`):
  - Oceny odpowiedzi mapują na aktualizację SM‑2 (interval, repetitions, easeFactor, nextReviewDate) w API.
  - Zakończenie sesji → podsumowanie (`SessionSummary`), trwałość danych.
- Edge cases:
  - Brak kart do nauki (EmptyState), błędy API, powroty/nawigacja.

### 4.6. Dostępność (A11y) i UI

- Strony: `index.astro`, dashboard, widoki Decks/Generate/Study.
- Kontrast, fokus, role/aria (wg wytycznych w repo), klawiatura, `aria-live` dla zdarzeń.
- Visual regression: podstawowe reguły dla kluczowych ekranów (Playwright snapshots).

### 4.7. Wydajność i odporność

- API generowania AI: SLO p95 < 2.5s (mock), stabilność pod 30 RPS przez 1 min (baseline).
- Lista kart/decków: p95 < 300ms (lokalnie), paginacja nie degraduje pamięci.
- Odporność na błędy: kontrolowane komunikaty, brak crashy UI.

## 5. Środowisko testowe

- Runtime: Node zgodny z `package.json` (LTS), pnpm/npm jak w repo.
- Baza: lokalny Supabase z osobnym schematem testowym; migracje z `supabase/migrations/*` stosowane na starcie testów integracyjnych/E2E.
- Dane testowe: seed minimalny (użytkownicy testowi, przykładowe talie/karty) ładowany fixture’ami.
- Zmienne środowiskowe:
  - Supabase URL/anon/service dla środowiska testowego.
  - OpenRouter API key – w testach mock przez MSW; realny klucz tylko w dedykowanym środowisku integracyjnym.
- Przeglądarki: Playwright (Chromium jako minimum; opcjonalnie WebKit/Firefox w nightly).
- Systemy: CI na GitHub Actions (Ubuntu runner), lokalnie Windows (bash) + macOS (opcjonalnie).

## 6. Narzędzia do testowania

- Testy jednostkowe/integracyjne: Vitest (+ ts-node/tsx), Testing Library (React, Astro).
- E2E i wizualne: Playwright (+ @axe-core/playwright dla a11y).
- Mocki: MSW (AI/OpenRouter, opcjonalnie Supabase HTTP layer), test doubles.
- Wydajność: k6 lub Artillery (yaml scenariusze na kluczowe endpointy).
- Statyki: ESLint, TypeScript, Prettier.
- CI/CD: GitHub Actions – joby: lint, typecheck, unit+int, e2e, perf (opcjonalnie smoke), artefakty z raportami.
- Skrypty bash w repo: `test-*.sh` – jako dodatkowe smoke/manual harness dla API.

## 7. Harmonogram testów

- Tydzień 1:
  - Przygotowanie środowiska testowego, dane seed, szkielety testów, mocki MSW.
  - Testy jednostkowe usług i hooków (80% głównej logiki).
- Tydzień 2:
  - Testy integracyjne API + DB (auth, decks, cards, review, AI save).
  - A11y dla kluczowych ekranów, podstawowa regresja wizualna.
- Tydzień 3:
  - E2E krytycznych ścieżek (auth → deck → AI → save → study).
  - Testy wydajności (smoke + baseline), twarde hardening RLS/ownership.
- Tydzień 4:
  - Regresja pełna, polerka, stabilizacja flaków, finalne raporty.

## 8. Kryteria akceptacji

- Krytyczne ścieżki (auth, deck CRUD, AI generate→save, study review): 100% przejścia w E2E na main i w PR.
- Jednostkowe/integracyjne: pokrycie linii średnio ≥ 80%, logiki domenowej (services/hooks) ≥ 85%.
- A11y: brak krytycznych błędów axe; kontrasty i fokus poprawne na kluczowych widokach.
- Wydajność: spełnienie baseline (p95 zgodnie z sekcją 4.7) w CI (mock) i lokalnie.
- Bezpieczeństwo: negatywne scenariusze RLS/ownership odrzucone (403/404), brak wycieku danych.
- Brak otwartych defektów o priorytecie P0/P1 przed wydaniem.

## 9. Role i odpowiedzialności

- QA Lead: właściciel planu, przeglądy testów, raporty jakości, koordynacja regresji.
- Developerzy: implementacja testów jednostkowych/integracyjnych, wsparcie E2E, utrzymanie mocków i seedów.
- DevOps: konfiguracja CI/CD, tajemnice środowiskowe, artefakty raportów, joby parametrów.
- Product Owner: akceptacja kryteriów, priorytetyzacja defektów, decyzje releasowe.

## 10. Procedury raportowania błędów

- System: GitHub Issues w repo.
- Szablon zgłoszenia (wymagane):
  - Tytuł, wersja builda/commit SHA, środowisko.
  - Kroki do odtworzenia, oczekiwany vs rzeczywisty rezultat.
  - Logi (frontend console, network, backend), zrzuty ekranu.
  - Kategoria (area): auth/decks/cards/ai/study/api/ui/db, Priorytet (P0–P3), Typ (bug/security/perf/a11y/regression).
- Cykl życia:
  - Triage (QA Lead + PO), przypisanie, link do PR/testów naprawczych.
  - Definicja Done: naprawa + test(y) automatyczne zapobiegające regresji, zielone CI.

## 11. Organizacja testów w repo (proponowana)

- Jednostkowe/integracyjne: `src/**/__tests__/*.test.ts` lub sąsiednio `*.spec.ts`.
- Komponenty: `src/components/**/__tests__/*.test.tsx`.
- API integracyjne: `tests/api/*.spec.ts` (server harness) lub Playwright APIRequest.
- E2E: `tests/e2e/*.spec.ts` (Playwright), folder `tests/e2e/screenshots` dla regresji wizualnej.
- Perf: `tests/perf/*.k6.js` lub `*.artillery.yaml`.
- Fixtures/seed: `tests/fixtures/**`, `tests/mocks/msw/**`.

## 12. Ryzyka i mitigacje (skrót)

- Zewnętrzne AI (niestabilność, koszty) → mock MSW w CI; testy z realnym kluczem tylko w osobnym jobie nocnym.
- RLS/ownership – krytyczne bezpieczeństwo danych → szerokie testy negatywne i integracyjne.
- Flaki E2E → retry w Playwright, stabilne selektory, seed deterministyczny.
- Migracje DB → dedykowane testy migracji i rollback plan.
