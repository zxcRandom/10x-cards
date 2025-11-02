# Konfiguracja Email Template dla OTP Password Reset

## Problem

Email z kodem OTP zawiera dziwny link "Log In" który przekierowuje na stronę główną i może mylić użytkowników.

## Rozwiązanie

Usuń link i zostaw tylko kod OTP w czytelnym formacie.

## Instrukcja konfiguracji (Supabase Studio)

### Krok 1: Otwórz Supabase Studio

URL: http://127.0.0.1:54323

### Krok 2: Nawiguj do Email Templates

1. Kliknij **Authentication** w lewym menu
2. Kliknij **Email Templates**
3. Wybierz **Magic Link** (używany dla OTP)

### Krok 3: Edytuj template

**USUŃ stary template** i wklej nowy:

```html
<h2>Kod resetowania hasła</h2>

<p>Twój kod weryfikacyjny:</p>

<h1
  style="font-size: 32px; letter-spacing: 8px; font-family: monospace; text-align: center; padding: 20px; background-color: #f5f5f5; border-radius: 8px; color: #000;"
>
  {{ .Token }}
</h1>

<p style="color: #666; font-size: 14px;">Kod jest ważny przez <strong>60 sekund</strong>.</p>

<p style="color: #999; font-size: 12px; margin-top: 30px;">Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
```

### Krok 4: (Opcjonalnie) Zmień Subject

W polu **Subject**:

```
Kod resetowania hasła - 10x Cards
```

### Krok 5: Zapisz

Kliknij przycisk **Save** na dole strony.

## Weryfikacja

1. Wyślij request na `/api/v1/auth/password/request-reset` z testem emailem
2. Sprawdź email w Mailpit: http://127.0.0.1:54324
3. Email powinien zawierać **TYLKO kod 6-cyfrowy** bez linków

## Template z polskimi znakami (wersja rozszerzona)

Jeśli chcesz bardziej profesjonalny wygląd:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
  </head>
  <body
    style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"
  >
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #4F46E5; margin: 0;">10x Cards</h1>
      <p style="color: #666; margin: 5px 0;">Fiszki do nauki z powtórkami</p>
    </div>

    <div style="background-color: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
      <h2 style="color: #111827; margin-top: 0;">Kod resetowania hasła</h2>

      <p style="color: #4b5563; font-size: 16px;">
        Otrzymujesz tę wiadomość, ponieważ poprosiłeś o reset hasła do swojego konta.
      </p>

      <p style="color: #4b5563; font-size: 16px; margin-bottom: 10px;">Twój kod weryfikacyjny:</p>

      <div
        style="background-color: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;"
      >
        <div
          style="font-size: 42px; font-weight: 700; letter-spacing: 12px; font-family: 'Courier New', monospace; color: #4F46E5;"
        >
          {{ .Token }}
        </div>
      </div>

      <div
        style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px;"
      >
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          ⏱️ <strong>Kod wygasa za 60 sekund</strong> od wysłania tej wiadomości.
        </p>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
        Wpisz ten kod w formularzu resetowania hasła, aby ustawić nowe hasło.
      </p>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość. Twoje konto jest bezpieczne.
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 10px;">© 2025 10x Cards. Wszystkie prawa zastrzeżone.</p>
    </div>
  </body>
</html>
```

## Uwagi

- **{{ .Token }}** - placeholder dla kodu OTP (6 cyfr)
- **{{ .TokenExpiryDuration }}** - czas wygaśnięcia (opcjonalny)
- **NIE używaj {{ .ConfirmationURL }}** - to tworzy dziwny link

## Production

W produkcji możesz ustawić ten template przez Supabase Dashboard:

1. Zaloguj się do Supabase Dashboard
2. Project Settings > Auth > Email Templates
3. Wybierz "Magic Link"
4. Wklej powyższy template
5. Zapisz

Template będzie działał zarówno dla OTP jak i dla Magic Link (jeśli używasz).
