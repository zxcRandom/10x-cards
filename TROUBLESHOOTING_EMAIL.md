# Troubleshooting Email Links i OTP Codes

## Problem

✅ Maile się wysyłają  
❌ Linki nie działają  
❌ Kod OTP nie działa

---

## Checklist Diagnostyczny

### 1. ✅ Szablony Email (DONE)

Szablony mają zmienną `{{ .Token }}` i `{{ .ConfirmationURL }}`

### 2. ⚠️ Konfiguracja Supabase Cloud Dashboard

#### A. Site URL

1. Idź do Supabase Dashboard → Settings → Auth → URL Configuration
2. Sprawdź **Site URL**:
   - Dla production: `https://twoja-domena.pages.dev` (lub własna domena)
   - Dla local dev: `http://localhost:4321` (port Astro)

**UWAGA**: Site URL określa gdzie użytkownik zostanie przekierowany po kliknięciu linku!

#### B. Redirect URLs

1. Idź do Settings → Auth → URL Configuration
2. Sprawdź **Redirect URLs**:
   - `https://twoja-domena.pages.dev/**` (wildcard dla production)
   - `http://localhost:4321/**` (wildcard dla local dev)

**UWAGA**: To lista dozwolonych URLi do przekierowania. Bez tego linki będą odrzucane!

#### C. Email Templates (Supabase Cloud)

1. Idź do Settings → Auth → Email Templates
2. Sprawdź każdy template (Magic Link, Confirmation, Recovery):
   - Czy zawiera `{{ .Token }}`?
   - Czy zawiera `{{ .ConfirmationURL }}`?

Jeśli nie - użyj skryptu:

```bash
# Najpierw ustaw zmienne środowiskowe
export SUPABASE_ACCESS_TOKEN="twój_token_z_dashboard"
export PROJECT_REF="twój_project_ref"

# Uruchom skrypt
bash scripts/update-email-templates.sh
```

### 3. ⚠️ Test Flow - Magic Link

#### Krok 1: Wyślij email

```bash
# W przeglądarce idź do:
http://localhost:4321/auth/forgot-password

# Wpisz email i wyślij
```

#### Krok 2: Sprawdź email

- Czy email przyszedł?
- Czy jest kod 6-cyfrowy?
- Czy jest link?

#### Krok 3: Sprawdź link

Przykładowy link powinien wyglądać tak:

```
http://localhost:4321/auth/callback?token=ABC123&type=recovery&redirect_to=http://localhost:4321/auth/reset-password
```

Elementy:

- `token=ABC123` - kod weryfikacyjny
- `type=recovery` - typ operacji
- `redirect_to=...` - dokąd przekierować po weryfikacji

**UWAGA**: Jeśli link wygląda na nieprawidłowy (np. ma złą domenę), to problem jest w Site URL!

#### Krok 4: Kliknij link

Co powinno się stać:

1. Przekierowanie na `/auth/callback`
2. Callback weryfikuje token
3. Przekierowanie na `/auth/reset-password?email=user@example.com`
4. Użytkownik widzi formularz OTP

#### Krok 5: Wprowadź kod OTP

- Wpisz 6-cyfrowy kod z emaila
- Wprowadź nowe hasło
- Wyślij formularz

### 4. ⚠️ Test Flow - Kod OTP (bez klikania linku)

#### Krok 1-2: Jak wyżej (wyślij email, sprawdź)

#### Krok 3: Idź bezpośrednio na stronę OTP

```
http://localhost:4321/auth/reset-password?email=user@example.com
```

#### Krok 4: Wprowadź kod OTP

- Wpisz 6-cyfrowy kod z emaila
- Nowe hasło
- Potwierdź hasło
- Wyślij

**Endpoint**: `/api/v1/auth/password/verify-and-reset`
**Metoda**: `verifyOtp({ email, token, type: "email" })`

---

## Sprawdzenie Konfiguracji Supabase

### Metoda 1: Przez Dashboard

1. Supabase Dashboard → Settings → Auth
2. **URL Configuration**:
   - Site URL: `https://10x-cards.pages.dev` (lub localhost dla dev)
   - Redirect URLs: dodaj `https://10x-cards.pages.dev/**`
3. **Email Templates**:
   - Sprawdź czy są zaktualizowane z `{{ .Token }}`

### Metoda 2: Przez API (automatycznie)

```bash
# 1. Zdobądź Access Token
# Idź do: https://supabase.com/dashboard/account/tokens
# Stwórz nowy Personal Access Token

export SUPABASE_ACCESS_TOKEN="sbp_xxx"
export PROJECT_REF="twój_ref"  # znajdziesz w Settings → General

# 2. Sprawdź aktualne ustawienia
curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth

# 3. Zaktualizuj email templates
bash scripts/update-email-templates.sh
```

---

## Debugging

### Logi Supabase

1. Dashboard → Logs → Auth
2. Sprawdź czy są błędy weryfikacji OTP

### Test w Production

1. Deploy na Cloudflare Pages
2. Upewnij się że Site URL = production URL
3. Test reset hasła

### Test Lokalnie

1. `npm run dev`
2. Site URL = `http://localhost:4321`
3. Sprawdź Inbucket: http://localhost:54324

---

## Quick Fixes

### Problem: Link przekierowuje na złą domenę

**Fix**: Zmień Site URL w Dashboard → Settings → Auth

### Problem: "Invalid redirect URL"

**Fix**: Dodaj URL do Redirect URLs (z wildcard `/**`)

### Problem: OTP nie weryfikuje

**Fix**:

1. Sprawdź czy kod jest 6-cyfrowy
2. Sprawdź czy nie wygasł (60 sekund)
3. Sprawdź logi w Dashboard

### Problem: Email nie ma kodu

**Fix**: Zaktualizuj templates w Dashboard lub użyj skryptu `update-email-templates.sh`

---

## Następne Kroki

1. [ ] Sprawdź Site URL w Supabase Dashboard
2. [ ] Sprawdź Redirect URLs w Supabase Dashboard
3. [ ] Sprawdź Email Templates w Supabase Dashboard
4. [ ] Test lokalny: wyślij email, sprawdź kod
5. [ ] Test lokalny: kliknij link
6. [ ] Test lokalny: wprowadź OTP
7. [ ] Deploy i test production
