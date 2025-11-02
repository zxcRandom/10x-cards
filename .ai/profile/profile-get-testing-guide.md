# Instrukcja testowania endpointa GET /api/v1/profile

## Przygotowanie

1. **Uruchom serwer deweloperski:**

   ```bash
   npm run dev
   ```

   Serwer powinien uruchomić się na `http://localhost:4321` (domyślnie Astro v5).

2. **Przygotuj token JWT:**
   - Zaloguj się w aplikacji Supabase lub użyj Supabase CLI
   - Uzyskaj access token użytkownika testowego
   - Token znajdziesz w Supabase Dashboard → Authentication → Users → [wybierz użytkownika]

   Alternatywnie, możesz utworzyć testowego użytkownika:

   ```bash
   # Za pomocą Supabase CLI
   supabase auth signup test@example.com testpassword123
   ```

## Testy manualne

### Test 1: Brak tokenu (401 Unauthorized)

```bash
curl -X GET http://localhost:4321/api/v1/profile \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Oczekiwany wynik:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please provide a valid access token."
  }
}
HTTP Status: 401
```

### Test 2: Nieprawidłowy token (401 Unauthorized)

```bash
curl -X GET http://localhost:4321/api/v1/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token_here" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Oczekiwany wynik:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please provide a valid access token."
  }
}
HTTP Status: 401
```

### Test 3: Prawidłowy token (200 OK)

```bash
# Zamień YOUR_ACCESS_TOKEN na prawdziwy token JWT
curl -X GET http://localhost:4321/api/v1/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Oczekiwany wynik:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "privacyConsent": false,
  "deletedAt": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T14:45:30.000Z"
}
HTTP Status: 200
```

### Test 4: Sprawdzenie nagłówków odpowiedzi

```bash
curl -X GET http://localhost:4321/api/v1/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -v 2>&1 | grep -E "< HTTP|< Content-Type|< Cache-Control"
```

**Oczekiwane nagłówki:**

```
< HTTP/1.1 200 OK
< Content-Type: application/json
< Cache-Control: no-cache, no-store, must-revalidate
```

## Testowanie z Postman/Insomnia

### Konfiguracja żądania:

1. **Method:** GET
2. **URL:** `http://localhost:4321/api/v1/profile`
3. **Headers:**
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_ACCESS_TOKEN`

### Scenariusze testowe:

| Scenariusz          | Authorization Header | Expected Status | Expected Response   |
| ------------------- | -------------------- | --------------- | ------------------- |
| Brak tokenu         | (usuń header)        | 401             | Error: UNAUTHORIZED |
| Nieprawidłowy token | `Bearer invalid123`  | 401             | Error: UNAUTHORIZED |
| Prawidłowy token    | `Bearer <valid_jwt>` | 200             | ProfileDTO object   |

## Testowanie automatyczne (opcjonalnie)

Możesz utworzyć testy integracyjne używając Vitest:

```typescript
// src/tests/api/profile.test.ts
import { describe, it, expect } from "vitest";

describe("GET /api/v1/profile", () => {
  it("should return 401 without token", async () => {
    const response = await fetch("http://localhost:4321/api/v1/profile");
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 200 with valid token", async () => {
    const response = await fetch("http://localhost:4321/api/v1/profile", {
      headers: {
        Authorization: `Bearer ${process.env.TEST_USER_TOKEN}`,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("privacyConsent");
  });
});
```

## Weryfikacja w logach serwera

Po każdym żądaniu sprawdź logi serwera deweloperskiego:

- **401 Unauthorized:** Powinieneś zobaczyć log: `[GET /api/v1/profile] Authentication failed`
- **404 Not Found:** Powinieneś zobaczyć log: `[GET /api/v1/profile] Profile not found for user`
- **500 Internal Server Error:** Powinieneś zobaczyć log: `[GET /api/v1/profile] Unexpected error`

## Troubleshooting

### Problem: "Connection refused" lub timeout

**Rozwiązanie:**

- Sprawdź czy serwer działa: `ps aux | grep "astro dev"`
- Sprawdź port: domyślnie Astro v5 używa portu 4321, nie 3000
- Uruchom ponownie: `npm run dev`

### Problem: 500 Internal Server Error zamiast 401

**Możliwe przyczyny:**

- Brak połączenia z Supabase (sprawdź `.env`)
- Błędne zmienne środowiskowe `SUPABASE_URL` lub `SUPABASE_KEY`

**Rozwiązanie:**

```bash
# Sprawdź zmienne środowiskowe
cat .env | grep SUPABASE

# Przetestuj połączenie z Supabase
curl -X GET "${SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${SUPABASE_KEY}"
```

### Problem: 404 Not Found po prawidłowym logowaniu

**Możliwa przyczyna:**

- Profil użytkownika nie został utworzony przez trigger `handle_new_user()`

**Rozwiązanie:**

```sql
-- Sprawdź czy profil istnieje w bazie
SELECT * FROM public.profiles WHERE id = 'USER_ID_HERE';

-- Jeśli nie istnieje, utwórz manualnie
INSERT INTO public.profiles (id, privacy_consent, created_at, updated_at)
VALUES ('USER_ID_HERE', false, NOW(), NOW());
```

## Następne kroki

Po pomyślnym przetestowaniu endpointu:

1. ✅ Dodaj polityki RLS do bazy danych (migracja SQL)
2. ✅ Przetestuj endpoint z RLS enabled
3. ✅ Zaktualizuj dokumentację API
4. ✅ Przygotuj się do wdrożenia na produkcję

## Uwagi dotyczące produkcji

⚠️ **Przed wdrożeniem na produkcję:**

1. **MUSI być dodane RLS** - obecnie wszystkie zapytania używają anon key, co jest niebezpieczne bez RLS
2. Dodaj rate limiting (np. 100 req/min per user)
3. Skonfiguruj monitoring i alerty dla błędów 500
4. Przetestuj z prawdziwymi tokenami JWT w środowisku staging
