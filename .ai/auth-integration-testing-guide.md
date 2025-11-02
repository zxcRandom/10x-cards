# Przewodnik Testowania Integracji Auth

## Przegląd zmian

Implementacja została zakończona z następującymi funkcjonalnościami:

### ✅ Zaimplementowane Funkcjonalności

1. **Rate Limiting** (RateLimitService)
   - Sign-in: 5 req/min
   - Sign-up: 3 req/min
   - Password reset: 3 req/min

2. **Middleware z pełną autoryzacją**
   - Sprawdzanie sesji dla wszystkich stron
   - Redirect niezalogowanych do `/auth/login?next=...`
   - Redirect zalogowanych użytkowników z `/auth/*` do `/decks`
   - PUBLIC_PATHS obejmuje strony auth i API endpoints

3. **API Endpoints**
   - `POST /api/v1/auth/sign-in` - logowanie
   - `POST /api/v1/auth/sign-up` - rejestracja z auto-login
   - `POST /api/v1/auth/sign-out` - wylogowanie

4. **UI Components**
   - LoginForm - zintegrowany z backendem
   - RegisterForm - zaktualizowany z neutralnymi komunikatami
   - AuthNav - nawigacja dla zalogowanych użytkowników

5. **Strony**
   - `/` - landing page dla niezalogowanych, redirect dla zalogowanych
   - `/auth/login` - logowanie
   - `/auth/register` - rejestracja
   - `/decks/*` - chronione, z nawigacją AuthNav

---

## Manual Testing Checklist

### 1. Rejestracja (Sign-Up)

**Test 1.1: Pomyślna rejestracja**

1. Przejdź do http://localhost:3000/auth/register
2. Wprowadź:
   - Email: `test@example.com`
   - Hasło: `SecurePass123`
   - Potwierdzenie: `SecurePass123`
3. Kliknij "Utwórz konto"
4. ✅ Oczekiwany rezultat:
   - Toast sukcesu: "Konto utworzone pomyślnie"
   - Redirect do `/decks`
   - Użytkownik zalogowany

**Test 1.2: Walidacja - hasła się nie zgadzają**

1. Przejdź do `/auth/register`
2. Wprowadź różne hasła
3. ✅ Błąd: "Hasła nie są identyczne"

**Test 1.3: Walidacja - za krótkie hasło**

1. Wprowadź hasło < 8 znaków
2. ✅ Błąd: "Hasło musi mieć co najmniej 8 znaków"

**Test 1.4: Duplikat email (409 Conflict)**

1. Spróbuj zarejestrować się ponownie tym samym emailem
2. ✅ Toast: "Nie można utworzyć konta. Spróbuj użyć innego adresu..."

**Test 1.5: Rate Limiting (3 req/min)**

1. Wykonaj 4 próby rejestracji szybko po sobie
2. ✅ 4-ta próba: 429 Too Many Requests

---

### 2. Logowanie (Sign-In)

**Test 2.1: Pomyślne logowanie**

1. Przejdź do `/auth/login`
2. Wprowadź poprawne dane
3. ✅ Toast sukcesu, redirect do `/decks`

**Test 2.2: Błędne hasło (401)**

1. Wprowadź błędne hasło
2. ✅ Neutralny komunikat: "Nieprawidłowy e-mail lub hasło"

**Test 2.3: Nieistniejący email (401)**

1. Wprowadź nieistniejący email
2. ✅ Ten sam neutralny komunikat (security best practice)

**Test 2.4: Rate Limiting (5 req/min)**

1. Wykonaj 6 prób logowania szybko
2. ✅ 6-ta próba: 429 Too Many Requests

**Test 2.5: Redirect z `next` parametrem**

1. Spróbuj wejść na `/decks/some-id` będąc wylogowanym
2. ✅ Redirect do `/auth/login?next=/decks/some-id`
3. Zaloguj się
4. ✅ Redirect do `/decks/some-id`

---

### 3. Wylogowanie (Sign-Out)

**Test 3.1: Pomyślne wylogowanie**

1. Będąc zalogowanym, kliknij "Wyloguj" w AuthNav
2. ✅ Redirect do `/auth/login`
3. Spróbuj wejść na `/decks`
4. ✅ Redirect z powrotem do `/auth/login`

---

### 4. Middleware i Ochrona Stron

**Test 4.1: Dostęp do chronionych stron bez logowania**

1. Wyloguj się
2. Spróbuj wejść na:
   - `/decks`
   - `/decks/123`
   - `/generate/review?deckId=123`
3. ✅ Wszystkie przekierowują do `/auth/login?next=...`

**Test 4.2: Dostęp do stron auth będąc zalogowanym**

1. Będąc zalogowanym, spróbuj wejść na:
   - `/auth/login`
   - `/auth/register`
2. ✅ Redirect do `/decks`

**Test 4.3: Strona główna**

1. Wylogowany: widzisz landing page z przyciskami "Rozpocznij za darmo" i "Zaloguj się"
2. Zalogowany: redirect do `/decks`

---

### 5. Nawigacja (AuthNav)

**Test 5.1: Wyświetlanie emaila**

1. Zaloguj się
2. ✅ W prawym górnym rogu widzisz email użytkownika

**Test 5.2: Linki nawigacyjne**

1. Kliknij "Moje talie" → `/decks`
2. Kliknij "Generator AI" → `/generate`
3. Kliknij "10x Cards" (logo) → `/decks`

---

## Testing z użyciem curl (test-auth-endpoints.sh)

```bash
# Daj uprawnienia do wykonania
chmod +x test-auth-endpoints.sh

# Uruchom testy
./test-auth-endpoints.sh
```

---

## Znane Ograniczenia MVP

1. **In-Memory Rate Limiting** - resetuje się po restarcie serwera. W produkcji: Redis.
2. **Brak weryfikacji email** - auto-login po rejestracji (zgodnie z spec MVP).
3. **Brak "Zapomniałem hasła"** - endpointy przygotowane, ale UI nie zaimplementowane w tym PR.
4. **Brak MFA** - feature post-MVP.

---

## Następne Kroki (Post-MVP)

1. Implementacja password reset flow (forgot/reset)
2. Zmiana hasła w ustawieniach konta
3. Usunięcie konta
4. Email verification
5. Redis dla rate limiting (distributed)
6. Testy jednostkowe i E2E

---

## Troubleshooting

### Problem: 401 Unauthorized po zalogowaniu

- Sprawdź czy cookies są ustawiane (DevTools → Application → Cookies)
- Sprawdź czy Supabase URL i KEY są poprawne w `.env`

### Problem: Middleware nie przekierowuje

- Sprawdź czy middleware jest włączony w `astro.config.mjs`
- Sprawdź logi konsoli czy `auth.getUser()` zwraca użytkownika

### Problem: Rate limiting nie działa

- In-memory storage - sprawdź czy serwer nie był restartowany
- W produkcji: użyj Redis

---

## Stack Trace dla Debugging

1. Request → Middleware (`src/middleware/index.ts`)
2. Middleware → Supabase `auth.getUser()`
3. Middleware → Set `locals.user`
4. Middleware → Check PUBLIC_PATHS
5. Middleware → Redirect lub next()
6. Page/API Route → Access `Astro.locals.user`
