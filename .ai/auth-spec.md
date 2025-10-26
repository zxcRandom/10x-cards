# Specyfikacja architektury modułu autentykacji (rejestracja, logowanie, reset hasła)

Dokument opisuje architekturę funkcjonalności autentykacji użytkowników dla 10x-cards zgodnie z PRD oraz stackiem technologicznym. Uwzględnia istniejącą strukturę projektu i dobre praktyki wskazane w `.github/copilot-instructions.md`.

- Frontend: Astro 5 + React 19 + TypeScript 5 + Tailwind 4 + shadcn/ui
- Backend: Supabase (Auth, Postgres), API w Astro (`src/pages/api`), SSR (`output: "server"`, adapter node)
- Walidacja: Zod
- RLS: włączone w produkcji (zgodnie z PRD), w dev może być tymczasowo wyłączone (migracja już to odzwierciedla)


## 1) Architektura interfejsu użytkownika

### 1.1. Widoki/strony i layouty (auth vs non-auth)

- Layout główny: `src/layouts/Layout.astro`
  - Odpowiedzialność: wspólna nawigacja, kontener, motyw. Nie zawiera logiki autentykacji, ale może renderować różne elementy nawigacji w zależności od stanu sesji.
  - SSR: w skrypcie serwerowym strony można odczytać sesję z `Astro.locals.supabase` (ustawiane w middleware) i przekazać minimalny stan do komponentów (np. flaga `isAuthenticated`).
  - Dostępność (A11y): linki nawigacyjne z odpowiednimi etykietami ARIA, focus state.

- Strony publiczne (non-auth):
  - `src/pages/index.astro` (landing) — bez zmian w zachowaniu; dodać CTA do logowania/rejestracji.
  - `src/pages/privacy-policy.astro` — bez zmian.

- Strony auth (nowe):
  - `src/pages/auth/login.astro` — hostuje formularz logowania w React.
  - `src/pages/auth/register.astro` — hostuje formularz rejestracji w React.
  - `src/pages/auth/forgot-password.astro` — formularz zgłoszenia resetu hasła (email).
  - `src/pages/auth/reset.astro` — formularz ustawienia nowego hasła po wejściu z linku (kod w query: `code`, patrz 3.3).
  - (opcjonalnie) `src/pages/auth/callback.astro` — strona pośrednia do potwierdzenia wymiany kodu na sesję; może być zrealizowana jako endpoint API (patrz 2.2) i redirect.

- Widoki wymagające autentykacji (chronione):
  - `src/pages/decks/index.astro` i `src/pages/decks/[deckId].astro` + podstrony talii.
  - `src/pages/generate/review.astro` (przegląd wygenerowanych kart) oraz inne widoki AI/study.
  - Dostęp kontrolowany w middleware (patrz 3.4). Niezalogowanych przekierowujemy do `/auth/login?next=...` (lub przez `rewrite` z nagłówkiem `x-redirect-to`).
  - `src/pages/account/settings.astro` — ustawienia konta (zmiana hasła, usunięcie konta). Chronione.


### 1.2. Komponenty React i podział odpowiedzialności

- Miejsce: `src/components/auth/`
  - `LoginForm.tsx`
  - `RegisterForm.tsx`
  - `ForgotPasswordForm.tsx`
  - `ResetPasswordForm.tsx`
  - `ChangePasswordForm.tsx`
  - `DeleteAccountSection.tsx`

- Odpowiedzialność formularzy (client-side):
  - Render UI (shadcn/ui: `input`, `button`, `label`, `sonner` do powiadomień).
  - Walidacja client-side (Zod) z natychmiastową walidacją i komunikatami błędów pod polami.
  - Wywołania `fetch` do endpointów API (`/api/v1/auth/...`).
  - Obsługa stanów: `isSubmitting`, `error`, `success`, `useTransition` dla płynności UI; `useId()` do a11y; tryb optymistyczny dla części UI (np. powiadomienie "Zalogowano" przed redirectem po 150–300 ms).
  - Przekierowania po sukcesie (na `next` z query lub na `/decks`).
  - Dla ustawień konta: po zmianie hasła komunikat sukcesu; po usunięciu konta — natychmiastowe wylogowanie i redirect do `/` lub `/auth/login`.

- Odpowiedzialność stron Astro (server-side):
  - Minimalna logika SSR: odczyt sesji z `Astro.locals.supabase` (np. do ukrycia formularza, gdy użytkownik już zalogowany — redirect 302 do `/decks`).
  - Hostowanie komponentów React (import komponentu i render `client:idle`/`client:load` tylko dla formularzy; reszta to statyczny markup Astro).

- Integracja z nawigacją:
  - W Layout/Nawigacji, gdy zalogowany: pokaż "Moje talie", "Ucz się", menu użytkownika z akcją "Wyloguj" (link do endpointu lub akcja `POST` z fetch).
  - Gdy niezalogowany: "Zaloguj się", "Utwórz konto".


### 1.3. Walidacja i komunikaty błędów (frontend)

- Zod schematy klienta (kopie uproszczone do UX, źródłowe schematy są na backendzie):
  - Email: `z.string().email("Nieprawidłowy adres e-mail")`.
  - Password: `z.string().min(8, "Hasło musi mieć co najmniej 8 znaków")`.
  - Confirm password: `refine` zgodności haseł z błędem na polu `confirm`.
- Błędy systemowe i neutralne komunikaty:
  - Logowanie: zawsze neutralny komunikat przy niepowodzeniu (bez ujawniania, czy e-mail istnieje).
  - Rejestracja: przy kolizji e-mail — komunikat przyjazny, ale neutralny.
  - Reset hasła (żądanie): zawsze komunikat typu "Jeśli adres istnieje, wysłaliśmy instrukcje resetu".


### 1.4. Scenariusze kluczowe

- Logowanie:
  - success: ustawienie sesji przez backend; redirect do `next` (jeśli ustawione) lub `/decks`.
  - error: neutralny komunikat + marker pola; pozostań na stronie.

- Rejestracja:
  - success: auto-logowanie (MVP) i redirect do `/decks`.
  - e-mail zajęty: komunikat neutralny ("nie można utworzyć konta").

- Reset hasła:
  - request: success zawsze (neutral); backend uruchamia wysyłkę linku z `redirectTo` na `/auth/reset`.
  - reset page: przy wejściu z linku, backend wymienia `code` na sesję (patrz 3.3), formularz ustala nowe hasło, komunikat success i redirect do `/auth/login` (lub auto-logowanie jeśli sesja już jest ustawiona).

- Wylogowanie: unieważnienie sesji (patrz 3.2), redirect do `/` lub `/auth/login`.

- Zmiana hasła (US-003):
  - Formularz: stare hasło, nowe hasło, potwierdzenie nowego.
  - Backend: re-autoryzacja poprzez `signInWithPassword` i `updateUser({ password })`.
  - Sukces: komunikat i (opcjonalnie) wymuszenie ponownego logowania.

- Usunięcie konta (US-004):
  - Wymaga wyraźnego potwierdzenia w UI (np. wpisanie e-maila lub słowa „DELETE”).
  - Backend: Admin API Supabase (service_role) do trwałego usunięcia użytkownika, następnie `signOut()`.
  - Po sukcesie: redirect do `/`.


## 2) Logika backendowa

### 2.1. Struktura endpointów API

Umiejscowienie: `src/pages/api/v1/auth/`

- `sign-in.ts` — `POST`
  - Wejście (JSON): `{ email: string, password: string }`.
  - Walidacja: Zod (email format, password min 8). Rate limit: max 5/10 min per IP i per email.
  - Akcja: `supabase.auth.signInWithPassword` przez klienta SSR (`context.locals.supabase`).
  - Sesja/cookies: ustawiane automatycznie przez `@supabase/ssr` via `Astro.cookies.set()`; flagi: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
  - Wyjście: `200 OK` z `{ status: "ok" }` lub `401 UNAUTHORIZED` neutralny błąd. Przy błędach walidacji `400` z `ValidationErrorResponse`.

- `sign-up.ts` — `POST`
  - Wejście: `{ email: string, password: string }`.
  - Walidacja: Zod.
  - Akcja: `supabase.auth.signUp` (MVP: automatyczne logowanie). Jeśli włączy się weryfikację e-mail w przyszłości — zwrot komunikatu "Sprawdź skrzynkę" i brak sesji.
  - Wyjście: `201 CREATED` lub `409 CONFLICT` (kolizja), `400` przy walidacji.

- `sign-out.ts` — `POST` (lub `GET` uproszczony)
  - Akcja: `supabase.auth.signOut()` i/lub wyczyszczenie cookies (`Astro.cookies.delete`/`set` z `maxAge: 0`).
  - Wyjście: `204 NO_CONTENT`.

- `password/request-reset.ts` — `POST`
  - Wejście: `{ email: string }`.
  - Akcja: `supabase.auth.resetPasswordForEmail(email, { redirectTo: <BASE_URL>/auth/reset })`.
  - Wyjście: zawsze `200 OK` z neutralnym komunikatem.

- `password/reset.ts` — `POST`
  - Wejście: `{ newPassword: string }` — zakładamy, że sesja została ustawiona poprzez wymianę `code` (patrz 3.3) i endpoint działa w kontekście zalogowanego (tymczasowo) usera.
  - Akcja: `supabase.auth.updateUser({ password: newPassword })`.
  - Wyjście: `200 OK` lub `400/401` z neutralnym błędem.

- (opcjonalnie) `callback.ts` — `GET`
  - Wejście: query `code` (z linku Supabase), walidacja obecności.
  - Akcja: `supabase.auth.exchangeCodeForSession(code)`; ustawia cookies; redirect `302` do `/auth/reset` (lub do `next`).
  - Uwaga: Alternatywnie obsłużyć wymianę kodu bezpośrednio na stronie `auth/reset.astro` (SSR) używając `Astro.locals.supabase` i query param.

Nowe endpointy (ustawienia konta):

- `password/change.ts` — `POST`
  - Wejście: `{ currentPassword: string, newPassword: string, confirmNewPassword: string }`.
  - Walidacja: Zod (format i zgodność haseł, min 8 znaków).
  - Akcja: re-auth poprzednim hasłem, następnie `supabase.auth.updateUser({ password: newPassword })`.
  - Wyjście: `200 OK` lub `400/401/429`.

- `account/delete.ts` — `DELETE` (lub `POST`)
  - Wejście: `{ confirm: string }`.
  - Walidacja: Zod (potwierdzenie wymagane).
  - Akcja: Admin API (service_role) `auth.admin.deleteUser(user.id)`; następnie `signOut()` i usunięcie cookies.
  - Wyjście: `204 NO_CONTENT` lub `400/401/429/500`.

Konwencje odpowiedzi i błędów zgodne z `src/types.ts` (`ErrorResponse`, `ValidationErrorResponse`, `HttpStatus`). Do walidacji wykorzystać helper `formatZodErrors`.


### 2.2. Modele danych (DTO/Command)

Dodać do `src/types.ts` (bez zmian istniejących typów):

- `SignInCommand { email: string; password: string }`
- `SignUpCommand { email: string; password: string }`
- `PasswordResetRequestCommand { email: string }`
- `PasswordResetCommand { newPassword: string }`
- (opcjonalnie) `AuthSuccessDTO { status: "ok" }`

Schematy Zod (nowy plik): `src/lib/validation/auth.schemas.ts`
- `signInSchema`
- `signUpSchema`
- `passwordResetRequestSchema`
- `passwordResetSchema`
 - `passwordChangeSchema`
 - `deleteAccountSchema`

Nowe typy:
- `ChangePasswordCommand { currentPassword: string; newPassword: string; confirmNewPassword: string }`
- `DeleteAccountCommand { confirm: string }`


### 2.3. Walidacja danych wejściowych

- Biblioteka: Zod
- Zasady (MVP zgodne z PRD):
  - email: format email
  - password: min 8 znaków (bez dodatkowych reguł)
  - newPassword: min 8 znaków
  - confirmNewPassword: zgodność z `newPassword`
  - confirm (delete): potwierdzenie wymagane (np. wpisanie e-maila lub stałego słowa „DELETE”)
- Błędy walidacji: `400 BAD_REQUEST` i `ValidationErrorResponse` zgodnie z istniejącym helperem `formatZodErrors`.


### 2.4. Obsługa wyjątków i kody statusu

- `401 UNAUTHORIZED` — błędne dane logowania (neutralny komunikat).
- `409 CONFLICT` — rejestracja z istniejącym e-mailem.
- `429 TOO_MANY_REQUESTS` — przekroczono limit prób (logowanie/rejestracja/reset).
- `500 INTERNAL_SERVER_ERROR` — błędy nieoczekiwane (logi bez wrażliwych danych).

Struktura błędu: `ErrorResponse` lub `ValidationErrorResponse` z `ErrorCode` już zdefiniowanymi w `src/types.ts`.


### 2.5. SSR i renderowanie stron w kontekście auth

- Konfiguracja: `astro.config.mjs` — `output: "server"`, adapter node (SSR węzłowy). Cookies dostępne przez `Astro.cookies`, sesja przez `Astro.locals.supabase`.
- Strony Astro mogą odczytać użytkownika:
  - `const { data: { user } } = await Astro.locals.supabase.auth.getUser();`
  - Gdy `!user` i strona chroniona: redirect do `/auth/login?next=<pathname>`.
- API endpoints: używać typów `APIRoute` i `Astro.cookies` (ustawianie/odczyt zgodnie z dokumentacją Astro 5). Prerender wyłączony dla endpointów auth (SSR): `export const prerender = false`.
 
Uwagi konfiguracyjne (PRD):
- Czas życia sesji: 7 dni — ustawienie w panelu Supabase (poza kodem aplikacji).
- Link resetu hasła: ważny 60 min — ustawienie w Supabase dla Password Recovery.


## 3) System autentykacji

### 3.1. Integracja z Supabase Auth (email + hasło)

- Klient SSR: już przygotowany w `src/db/supabase.client.ts` (używa `@supabase/ssr` i integruje cookies przez `Astro.cookies.set`).
- Middleware: `src/middleware/index.ts` — tworzy `context.locals.supabase` na bazie ciasteczek lub Bearer token (API). Zgodnie z Astro 5, rozszerzamy `locals`, nie nadpisujemy całego obiektu.
- Flow logowania: `signInWithPassword` -> sesja w cookies (`sb-access-token`, `sb-refresh-token`) z flagami `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- Flow rejestracji: `signUp` -> (MVP) sesja automatyczna jak w PRD. Dalsze etapy (weryfikacja e-mail) jako rozszerzenie post-MVP.


### 3.2. Wylogowanie i unieważnienie sesji

- Endpoint `POST /api/v1/auth/sign-out`: `supabase.auth.signOut()` i/lub nadpisanie cookies (`maxAge: 0`).
- Redirect po wylogowaniu do `/` lub `/auth/login`.


### 3.3. Reset hasła

- Żądanie resetu: `supabase.auth.resetPasswordForEmail(email, { redirectTo: <BASE_URL>/auth/reset })`.
- Po kliknięciu linku:
  - Supabase przekieruje na `/auth/reset?code=...`.
  - Na stronie/endpointcie wykonujemy `exchangeCodeForSession` (ustawia sesję, aby umożliwić `updateUser`).
  - Formularz przyjmuje nowe hasło, a backend wywołuje `supabase.auth.updateUser({ password })`.
  - Po sukcesie: potwierdzenie + redirect do logowania (lub auto-login w aktualnej sesji).
  - Link ważny 60 min (zgodnie z konfiguracją Supabase).


### 3.4. Ochrona tras (middleware)

- Middleware `onRequest` rozszerzamy o rozpoznanie tras chronionych:
  - `const isProtected = match(["/decks(.*)", "/generate(.*)", "/study(.*)", "/account(.*)"]);`
  - Gdy `isProtected` i brak sesji: `return context.redirect("/auth/login?next=" + encodeURIComponent(context.url.pathname))`.
  - Opcjonalnie: `context.rewrite` z nagłówkiem `x-redirect-to` (wg dokumentacji Astro) jako alternatywa.
- Dla API: endpointy w `src/pages/api/v1/*` wymagające auth weryfikują sesję przez `context.locals.supabase.auth.getUser()` i zwracają `401` gdy brak.


### 3.5. Limity i bezpieczeństwo

- Rate limiting (rozszerzenie obecnego serwisu):
  - Rozszerzyć `RateLimitService` o kategorie: `authSignIn`, `authSignUp`, `authReset` z progami np. 5 prób/10 min per IP i per email.
  - Klucze limitów: `ip:<ip>` oraz `email:<email>` (równolegle), finalna decyzja = MIN(remaining).
  - Zwrócić `429` z neutralnym komunikatem.
  - Dodatkowe kategorie: `authPasswordChange` (5/10 min), `authAccountDelete` (3/60 min). Liczniki per IP i per user/email.

- Cookies i sesje:
  - Pozostawiamy zarządzanie cookies `@supabase/ssr` + `Astro.cookies` (ustawienia domyślne: `Path=/`, `HttpOnly`, `Secure`; `SameSite=Lax` lub `Strict` dla ochrony CSRF wg PRD).
  - Tokenów nie zapisujemy w `localStorage/sessionStorage` (zgodne z PRD).

- CSRF (MVP):
  - Mutujące endpointy korzystają z `SameSite=Lax/Strict` + standardowe nagłówki. Dodatkowy token double-submit można dodać w iteracji po MVP.

- CORS/CSP: pozostawić w globalnej konfiguracji (zgodnie z PRD); API tylko dla zaufanego originu prod.

### 3.6. Usunięcie konta — Admin API (service_role)

- Do trwałego usunięcia użytkownika wymagany jest klucz `SUPABASE_SERVICE_ROLE_KEY` wykorzystywany wyłącznie na serwerze.
- Zalecenie: wydzielić osobny klient admin w `src/db/supabase.admin.client.ts` i importować go tylko w endpointach SSR.
- Operacja: `admin.auth.admin.deleteUser(userId)`; po sukcesie wykonać `signOut()` i usunąć cookies.
- Bezpieczeństwo: nie eksportować ani nie używać klucza service_role po stronie przeglądarki. Dodaj guardy środowiskowe i logowanie zdarzeń.


## 4) Komponenty, moduły, serwisy i kontrakty

### 4.1. Nowe pliki (propozycja)

- UI (React): `src/components/auth/`
  - `LoginForm.tsx`, `RegisterForm.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`
  - `ChangePasswordForm.tsx`, `DeleteAccountSection.tsx`
- Strony (Astro): `src/pages/auth/`
  - `login.astro`, `register.astro`, `forgot-password.astro`, `reset.astro`
 - Strony (Astro): `src/pages/account/`
  - `settings.astro`
- API (Astro endpoints): `src/pages/api/v1/auth/`
  - `sign-in.ts`, `sign-up.ts`, `sign-out.ts`, `password/request-reset.ts`, `password/reset.ts`, `callback.ts` (opcjonalnie)
  - `password/change.ts`, `account/delete.ts`
- Walidacja: `src/lib/validation/auth.schemas.ts`
- (Opcjonalnie) Serwis domenowy: `src/lib/services/auth.service.ts`
  - Enkapsuluje wywołania `supabase.auth.*`, mapowanie błędów, logikę retry/telemetrii; kontrolery API pozostają cienkie.
- Typy: uzupełnienia w `src/types.ts` (komendy/DTO auth, patrz 2.2).
 - Admin client: `src/db/supabase.admin.client.ts` (service_role; tylko po stronie serwera)


### 4.2. Kontrakty API (szczegół)

- `POST /api/v1/auth/sign-in`
  - Body: `{ email: string; password: string }`
  - 200 `{ status: "ok" }`
  - 400 `ValidationErrorResponse`
  - 401 `ErrorResponse { code: UNAUTHORIZED }`
  - 429 `ErrorResponse { code: TOO_MANY_REQUESTS }`

- `POST /api/v1/auth/sign-up`
  - Body: `{ email: string; password: string }`
  - 201 `{ status: "ok" }`
  - 400/409/429 jak wyżej

- `POST /api/v1/auth/sign-out`
  - Body: `null`
  - 204 (brak treści)

- `POST /api/v1/auth/password/request-reset`
  - Body: `{ email: string }`
  - 200 `{ status: "ok" }` (neutralny zawsze)
  - 400/429 możliwe

- `POST /api/v1/auth/password/reset`
  - Body: `{ newPassword: string }`
  - 200 `{ status: "ok" }`
  - 400/401/429 możliwe

- `GET /api/v1/auth/callback` (opcjonalnie)
  - Query: `code`
  - 302 redirect do `/auth/reset` lub `next`

- `POST /api/v1/auth/password/change`
  - Body: `{ currentPassword: string; newPassword: string; confirmNewPassword: string }`
  - 200 `{ status: "ok" }`
  - 400/401/429 `ErrorResponse | ValidationErrorResponse`

- `DELETE /api/v1/auth/account/delete` (lub `POST`)
  - Body: `{ confirm: string }`
  - 204 (brak treści)
  - 400/401/429/500 `ErrorResponse | ValidationErrorResponse`

Uwagi implementacyjne:
- Wszystkie endpointy `export const prerender = false`.
- Typy `APIRoute`, `APIContext`, odpowiedzi `Response` z nagłówkiem `Content-Type: application/json`.
- Zwracać spójne struktury błędów zgodne z `src/types.ts`.


### 4.3. Middleware i typowanie `locals`

- Middleware już tworzy `locals.supabase`. Dla TS ergonomii rozważyć dodanie deklaracji augmentującej:
  - `declare global { namespace App { interface Locals { supabase: SupabaseClient<Database>; } } }`
  - Plik: `src/env.d.ts` (już istnieje) lub nowy `src/types/env.d.ts`.
- Rozszerzenie middleware o ochronę tras (pkt 3.4) i ewentualne dołączanie `locals.user` (cache wyniku `getUser()` na potrzeby stron SSR).


## 5) UX/A11y/Observability

- A11y: etykiety `aria-label`, `aria-describedby` dla błędów, `aria-live="polite"` dla komunikatów po submit.
- Loading/progress: wskaźniki busy na przyciskach, `useTransition`/`disabled` w trakcie żądania.
- Telemetria (MVP): logowanie zdarzeń klienta (np. `card_*` z PRD) pozostaje bez zmian. Dodatkowo można zliczać próby logowania (bez PII treści) po stronie serwera w logach technicznych.


## 6) Zgodność z istniejącą aplikacją i bezpieczeństwo

- Nie zmieniamy istniejących endpointów AI/decks/reviews — dokładamy nowe w dedykowanym namespace `auth`.
- Wykorzystujemy istniejący mechanizm Supabase w SSR (pliki `src/db/supabase.client.ts`, `src/middleware/index.ts`).
- Tokeny pozostają wyłącznie w cookies HttpOnly, brak localStorage.
- RLS w produkcji egzekwuje dostęp per `user_id`; endpointy API weryfikują sesję przed dostępem do zasobów użytkownika.
- CSP/CORS zgodnie z PRD.
 - Czas życia sesji: 7 dni (PRD) — skonfigurować w Supabase Auth; cookies `HttpOnly`, `Secure`, `SameSite=Lax/Strict`, `Path=/`.


## 7) Edge cases i błędy (przykłady)

- Brak połączenia z Supabase podczas logowania — `500` ogólny, neutralny komunikat.
- Link resetu przeterminowany — wymiana `code` zwróci błąd; komunikat na stronie resetu: "Link wygasł, poproś o nowy" + link do `forgot-password`.
- Wielokrotne kliki "Zaloguj" — blokada UI `disabled`, idempotencja po stronie serwera (rate limit i brak efektu ubocznego przy nieudanych próbach).
- Próba wejścia na trasę chronioną bez sesji — redirect do loginu z `next`.
 - Brak `SUPABASE_SERVICE_ROLE_KEY` — usunięcie konta niedostępne; zwróć neutralny błąd i zaloguj zdarzenie.
 - Zmiana hasła ze złym starym hasłem — neutralny komunikat (bez zdradzania szczegółów), brak zmian.


## 8) Minimalny plan implementacji (dla kontekstu)

1) Dodanie schematów Zod (`src/lib/validation/auth.schemas.ts`).
2) Endpointy API (sign-in, sign-up, sign-out, request-reset, reset, opcjonalnie callback) + `password/change`, `account/delete` (z klientem admin).
3) Strony Astro i formularze React w `src/components/auth` oraz `src/pages/account/settings.astro`.
4) Rozszerzenie middleware o ochronę tras (w tym `/account/*`).
5) Rozszerzenie `RateLimitService` o kategorie auth (IP/email) + ustawienia konta.
6) Konfiguracja Supabase: TTL sesji 7 dni, TTL resetu 60 min, dodanie `SUPABASE_SERVICE_ROLE_KEY` (prod), RLS włączone.
7) Testy ręczne: logowanie/rejestracja, reset hasła, zmiana hasła, usunięcie konta, ochrona tras, limity.


---
Wytyczne projektowe zastosowane na podstawie dokumentacji:
- Astro 5: API routes, `Astro.cookies`, middleware `onRequest` (SSR), `context.locals` rozszerzany (nie nadpisywany).
- Supabase: `signInWithPassword`, `signUp`, `signOut`, `resetPasswordForEmail`, `exchangeCodeForSession`, `updateUser`.
- Zod: `safeParse`, `refine`, własne komunikaty błędów.
- Zgodność z PRD: neutralne komunikaty, cookies HttpOnly, rate limiting, brak tokenów w storage, ścieżki UX opisane w historyjkach US-001..US-014.
