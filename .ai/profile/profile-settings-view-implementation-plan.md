# Plan implementacji widoku Ustawienia konta

## 1. Przegląd
Widok Ustawienia konta umożliwia użytkownikowi zarządzanie ustawieniami profilu aplikacji 10x-cards, w szczególności:
- przegląd statusu profilu (aktywny/usunięty),
- akceptację/wycofanie zgody na przetwarzanie treści przez AI (privacyConsent),
- soft delete konta (z ostrzeżeniem i potwierdzeniem),
- ewentualne przywrócenie konta w przyszłości (obsługiwane przez PATCH restore; link/CTA opcjonalny, jeśli profil jest usunięty).

Widok jest zgodny z PRD (sekcja 3.1 i US-004) oraz wykorzystuje istniejące endpointy profilu: GET, PATCH, DELETE.

## 2. Routing widoku
- Ścieżka: `/settings`
- Dostęp: tylko użytkownicy uwierzytelnieni (middleware Astro inicjalizuje `locals.supabase`; w razie 401 należy przekierować do `/login` lub wyświetlić komunikat i CTA logowania).
- Renderowanie: strona Astro z komponentami React dla interakcji (Shadcn/ui + Tailwind). SSR z interakcjami po hydracji (client:load dla komponentów dynamicznych).
- SEO/Meta: noindex (ustawienia konta), brak potrzeby indeksowania.

## 3. Struktura komponentów
- Layout: `src/layouts/Layout.astro`
  - Breadcrumb: `Moje konto > Ustawienia`
  - Główna zawartość: `SettingsPage` (React) w Astro wrapperze
    - `ProfileSummaryCard`
    - `PrivacyConsentCard`
    - `DangerZoneDeleteAccountCard`
    - Global `Toast` (Shadcn/ui)

Hierarchia (drzewo):
- Page `/settings`
  - Layout.astro
    - SettingsPage (React)
      - ProfileSummaryCard
      - PrivacyConsentCard
        - Button Save
        - Switch/Checkbox privacyConsent
      - DangerZoneDeleteAccountCard
        - Button Delete Account (otwiera Dialog)
        - ConfirmDeleteDialog (Dialog+Input/Checkbox)
      - ToastProvider/Toaster

## 4. Szczegóły komponentów
### SettingsPage
- Opis: Kontener widoku, odpowiada za pobranie profilu, trzymanie lokalnego stanu formularzy i orkiestrację mutacji (PATCH/DELETE).
- Główne elementy: sekcja z nagłówkiem, grid z kartami, provider `Toast`.
- Obsługiwane interakcje: inicjalne `GET /api/v1/profile`; odświeżenie po mutacjach; obsługa błędów.
- Obsługiwana walidacja:
  - Brak pól wejściowych bezpośrednio; deleguje do dzieci.
- Typy:
  - DTO: ProfileDTO, UpdateProfileCommand, ProfileDeletedDTO
  - VM: ProfileVM, SettingsState (definicje w sekcji 5)
- Propsy: brak (top-level); wewnętrznie używa hooków i serwisu HTTP.

### ProfileSummaryCard
- Opis: Wyświetla skrócone informacje o profilu: status (aktywny/soft-deleted), createdAt, updatedAt, deletedAt.
- Główne elementy: `Card` z tytułem, listą metadanych, badge statusu.
- Interakcje: brak aktywnych, ewentualnie przycisk „Odśwież profil”.
- Walidacja: n/d.
- Typy: ProfileVM (read-only).
- Propsy: `{ profile: ProfileVM, onRefresh?: () => void }`.

### PrivacyConsentCard
- Opis: Formularz do zarządzania zgodą privacyConsent (AI processing opt-in).
- Główne elementy: `Card`, `Switch` lub `Checkbox` + `Button` Zapisz, opis tekstowy z linkiem do Polityki Prywatności.
- Interakcje:
  - Zmiana przełącznika `privacyConsent` (onChange)
  - Zapis formularza (onSubmit) → PATCH `/api/v1/profile` z `{ privacyConsent }`
- Walidacja:
  - Typ boolean; brak dodatkowych ograniczeń.
  - Jeśli profil ma `deletedAt != null` i nie wykonujemy `restore` równocześnie, według planu endpointu może zwrócić 422 – UI powinno blokować zapis i wyświetlić hint: „Najpierw przywróć konto”.
- Typy:
  - DTO: UpdateProfileCommand
  - VM: PrivacyConsentFormVM `{ value: boolean; dirty: boolean; submitting: boolean; error?: string }`
- Propsy: `{ profile: ProfileVM, onUpdated: (nextProfile: ProfileVM) => void }`.

### DangerZoneDeleteAccountCard
- Opis: Sekcja „Strefa zagrożenia” z wyraźnym oznaczeniem, umożliwia soft delete konta po potwierdzeniu.
- Główne elementy: `Card` w wariancie destrukcyjnym, `Button` Usuń konto, tekst ostrzegawczy.
- Interakcje:
  - Klik „Usuń konto” → otwarcie ConfirmDeleteDialog
  - Po potwierdzeniu → DELETE `/api/v1/profile`
- Walidacja:
  - W dialogu wymagane świadome potwierdzenie: checkbox „Rozumiem konsekwencje” i/lub wpisanie słowa kluczowego (np. „USUŃ”)
- Typy:
  - DTO: ProfileDeletedDTO
  - VM: DeleteAccountState `{ confirming: boolean; loading: boolean; confirmed: boolean; error?: string }`
- Propsy: `{ disabled?: boolean, onDeleted: (deletedAt: string) => void }`.

### ConfirmDeleteDialog
- Opis: Dialog potwierdzający usunięcie konta.
- Główne elementy: `Dialog`, `Input` (opcjonalny), `Checkbox`, `Button` Potwierdź/Anuluj.
- Interakcje:
  - Zaznaczenie checkbox/ wpisanie frazy → aktywuje przycisk Potwierdź.
  - Submit → wywołuje akcję rodzica.
- Walidacja:
  - `confirmed === true` oraz (opcjonalnie) `confirmationText === "USUŃ"`.
- Typy: `{ open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => Promise<void>; loading: boolean }`.
- Propsy: jw.

## 5. Typy
- Istniejące (z `src/types.ts`):
  - ProfileDTO: `{ id: string; privacyConsent: boolean; deletedAt: string | null; createdAt: string; updatedAt: string }`
  - UpdateProfileCommand: `{ privacyConsent?: boolean; restore?: boolean }`
  - ProfileDeletedDTO: `{ status: 'deleted'; deletedAt: string }`

- Nowe typy (ViewModel i stan UI):
  - `type ProfileVM = {
      id: string;
      privacyConsent: boolean;
      status: 'active' | 'deleted';
      createdAt: string;
      updatedAt: string;
      deletedAt: string | null;
    }`
    - Mapa z DTO: `status = deletedAt ? 'deleted' : 'active'`.
  - `type SettingsState = {
      loading: boolean;
      error?: string;
      profile?: ProfileVM;
    }`
  - `type PrivacyConsentFormVM = {
      value: boolean;
      dirty: boolean;
      submitting: boolean;
      error?: string;
    }`
  - `type DeleteAccountState = {
      confirming: boolean;
      loading: boolean;
      confirmed: boolean;
      error?: string;
    }`
  - `type ApiError = { code: string; message: string; details?: string }` – zgodny z ErrorResponse.

## 6. Zarządzanie stanem
- Lokalny stan w `SettingsPage`:
  - `state: SettingsState` trzyma profil i globalny błąd ładowania.
  - Dla `PrivacyConsentCard`: osobny lokalny stan `PrivacyConsentFormVM` (kontroluje dirty/submitting/disabled).
  - Dla `DangerZoneDeleteAccountCard`: `DeleteAccountState` (steruje dialogiem i wywołaniem DELETE).
- Custom hooki:
  - `useProfile()` w `src/components/hooks/useProfile.ts` (do utworzenia):
    - `getProfile(): Promise<ProfileDTO>`
    - `updateProfile(cmd: UpdateProfileCommand): Promise<ProfileDTO>`
    - `deleteProfile(): Promise<ProfileDeletedDTO>`
    - Zwraca także wygodne metody i statusy (loading, error) oraz mapowanie do `ProfileVM`.
- Synchronizacja:
  - Po PATCH lub DELETE wykonaj odświeżenie profilu (GET) i zaktualizuj `SettingsState.profile`.
- Optymalizacje:
  - Optimistic UI dla privacyConsent (opcjonalnie): natychmiastowy toggle z rollbackiem przy błędzie.
  - Debounce zapisu – nie wymagane, zapis jest jawny (przycisk „Zapisz”).

## 7. Integracja API
- GET `/api/v1/profile`
  - Request: bez body
  - Response: ProfileDTO
  - Błędy: 401, 404, 500
- PATCH `/api/v1/profile`
  - Request: `UpdateProfileCommand` (np. `{ privacyConsent: true }`)
  - Response: ProfileDTO
  - Błędy: 400 (walidacja Zod), 401, 404, 409 (restore aktywnego profilu), 422 (update usuniętego profilu bez restore), 500
- DELETE `/api/v1/profile`
  - Request: bez body
  - Response: ProfileDeletedDTO
  - Błędy: 401, 500 (lub 200 idempotentnie jeśli już usunięty)

Kontrakty: używamy JSON, ISO-8601 daty. Błędy w formacie `ErrorResponse`.

## 8. Interakcje użytkownika
- Wejście na `/settings`:
  - UI pokazuje skeleton/loading; po sukcesie prezentuje trzy karty.
  - 401 → komunikat „Twoja sesja wygasła” + CTA „Zaloguj ponownie” (przekierowanie do `/login`).
- Zmiana `privacyConsent` i Zapis:
  - Użytkownik przełącza switch → `dirty=true` → aktywuje się przycisk „Zapisz”.
  - Klik „Zapisz” → PATCH; w trakcie disabled i spinner → Po sukcesie Toast „Zapisano” i reset dirty.
  - 422 gdy konto usunięte → komunikat inline + link/CTA „Przywróć konto”.
- Usunięcie konta (soft delete):
  - Klik „Usuń konto” → dialog z ostrzeżeniem; wymagany checkbox/tekst.
  - Po potwierdzeniu → DELETE; sukces → Toast „Konto zostało oznaczone jako usunięte”; karta Privacy pokazuje blokadę edycji; karta Summary pokazuje `status: deleted` i `deletedAt`.
  - Kolejne DELETE są idempotentne – UI może pokazać ten sam komunikat.

## 9. Warunki i walidacja
- Formularz privacyConsent:
  - `privacyConsent` jest boolean; zapis dozwolony, gdy `dirty==true` i nie ma aktywnego zapytania.
  - Jeśli `profile.status === 'deleted'`, blokuj zapis i pokaż komunikat z CTA „Przywróć konto” (wysyła PATCH `{ restore: true }`).
- Delete Account:
  - W dialogu wymagaj zaznaczenia „Rozumiem konsekwencje” oraz (opcjonalnie) wprowadzenia frazy „USUŃ”.
  - Przycisk „Potwierdź” odblokowany tylko, gdy warunki spełnione.
- API constraints (z .ai/api-plan.md):
  - 401: wymaga zalogowania.
  - 404: profil nie istnieje – pokaż ekran błędu z „Skontaktuj się z supportem”.
  - 409: przy restore aktywnego profilu – UI powinien nie wywoływać takiej operacji (disable CTA, ale na wszelki wypadek pokaż Toast konfliktu).
  - 422: update usuniętego profilu bez restore – sygnalizuj i podpowiedz restore.

## 10. Obsługa błędów
- Mapowanie kodów na UI (Shadcn Toast + inline):
  - 401: Toast „Sesja wygasła” + CTA do logowania; opcjonalny redirect.
  - 404: Sekcja błędu na stronie („Nie znaleziono profilu”) + link do `/`.
  - 409: Toast „Konflikt stanu. Odśwież stronę i spróbuj ponownie.”
  - 422: Inline pod kontrolką + Toast skrótowy.
  - 429 (nie dotyczy tych endpointów zwykle): ogólne „Zbyt wiele prób, spróbuj później”.
  - 500/Network: Toast „Wystąpił błąd. Spróbuj ponownie.” + możliwość retrial.
- A11y: aria-live="polite" przy błędach formularzy; fokus wraca do problematycznej kontrolki.

## 11. Kroki implementacji
1. Routing i strona Astro
   - Utwórz `src/pages/settings.astro` z użyciem `Layout.astro` i osadź `SettingsPage` (React)
   - Dodaj link do nawigacji (sidebar) „Ustawienia” → `/settings`
2. Komponenty UI (React + Shadcn/ui)
   - Folder `src/components/settings/`
     - `SettingsPage.tsx` (kontener; fetch profilu; render kart; Toaster)
     - `ProfileSummaryCard.tsx`
     - `PrivacyConsentCard.tsx`
     - `DangerZoneDeleteAccountCard.tsx`
     - `ConfirmDeleteDialog.tsx`
3. Hook i klient API (frontend)
   - `src/components/hooks/useProfile.ts`:
     - `getProfile`, `updateProfile`, `deleteProfile` (fetch do `/api/v1/profile`)
     - Mapowanie DTO → ProfileVM
     - Zwrot: `{ profile, loading, error, refresh, updateConsent, restore, deleteAccount }`
4. Typy i utils
   - Dodać lokalne typy VM do komponentów lub do `src/types.ts` (sekcja UI-only – opcjonalnie oddzielny plik `src/types.ui.ts`)
   - Helper do obsługi błędów API (parsowanie `ErrorResponse`)
5. Walidacje i UX
   - Blokada edycji privacyConsent, gdy profil jest usunięty (zamiast 422 z serwera)
   - Confirm dialog z checkboxem/tekstem „USUŃ”
   - Stany ładowania: skeleton w kartach, disabled przycisków; spinnery w przyciskach
6. A11y i i18n
   - Dodać etykiety dla Switch/Checkbox (aria-label)
   - aria-describedby dla komunikatów walidacji
   - Teksty w osobnym module (opcjonalnie) dla łatwej lokalizacji
7. Testy (minimalny zakres)
   - Test hooka `useProfile` (mock fetch; scenariusze 200/401/422/500)
   - Testy komponentów: render z różnymi stanami (aktywny/usunięty profil)
8. Integracja z middleware
   - Upewnić się, że `src/middleware/index.ts` dostarcza `locals.supabase` do API (już istnieje)
9. Drobne usprawnienia
   - Po DELETE pokaż CTA „Przywróć konto” (wywołuje PATCH `{ restore: true }`)
   - Po RESTORE automatycznie odblokuj privacyConsent
10. Dokumentacja
   - Uzupełnij README/Docs (krótka sekcja: jak działa `/settings`)

---

Dane wejścia/wyjścia (kontrakt komponentu i API)
- Wejście (UI): wartości boolean (privacyConsent), potwierdzenie usunięcia (checkbox/tekst)
- Wyjście (API): ProfileDTO / ProfileDeletedDTO
- Tryby błędu: 401/404/409/422/500 zgodnie z .ai/api-plan.md
- Kryteria sukcesu: zmienione `privacyConsent` odzwierciedlone w UI; `status: deleted` po udanym DELETE; poprawna obsługa błędów i blokad

Edge cases
- Brak profilu (404): pokaż komunikat i CTA do pulpitu
- Profil już usunięty: DELETE → 200 OK (idempotentnie) – UI nie zmienia stanu poza potwierdzeniem
- Sieć offline: pokaż banner offline i pozwól na retry
- Szybkie, wielokrotne kliknięcia: disabled przyciski podczas requestów

Wymagania dostępności i ARIA
- Formularze: aria-describedby dla błędów, aria-live="polite"; Dialog z focus trap, zamykany klawiszem Esc, return focus po zamknięciu

Zgodność z Tech Stack
- Astro + React 19, Tailwind 4, Shadcn/ui
- Walidacje po stronie klienta proste (typy/warunki), po stronie serwera Zod (już istnieje)
- Supabase używane wyłącznie w warstwie API (frontend korzysta z `/api/v1/...`)