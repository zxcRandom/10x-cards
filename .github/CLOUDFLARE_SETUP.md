# Cloudflare Pages Configuration

## ⚠️ KRYTYCZNA KONFIGURACJA - React 19 SSR

Aby aplikacja działała z React 19 SSR, **MUSISZ** skonfigurować compatibility settings w Cloudflare Dashboard.

**UWAGA**: `wrangler.toml` jest czytany przez build system, ale **compatibility settings NIE SĄ aplikowane** przez Cloudflare Pages automatic GitHub deployments. Dashboard configuration jest **OBOWIĄZKOWA**.

### Metoda 1: Runtime Settings (ZALECANA)

#### 1. Przejdź do Cloudflare Dashboard
https://dash.cloudflare.com/

#### 2. Otwórz swój projekt Pages
Workers & Pages → 10x-cards → Settings

#### 3. Functions → Runtime

Skonfiguruj dla **OBUDWU** środowisk: **Preview** i **Production**

**Preview Environment:**
- Kliknij **Edit** obok "Preview" 
- **Compatibility date**: `2025-11-02` (lub nowsza)
- **Compatibility flags**: `nodejs_compat`
- **Save**

**Production Environment:**
- Kliknij **Edit** obok "Production"
- **Compatibility date**: `2025-11-02` (lub nowsza)
- **Compatibility flags**: `nodejs_compat`
- **Save**

#### 4. Redeploy
```bash
git commit --allow-empty -m "chore: trigger redeploy after compatibility date update"
git push origin feature/github-actions-cicd
```

### Metoda 2: Environment Variables (BACKUP)

W sekcji **Settings → Environment variables** dodaj dla **OBUDWU** środowisk:

**Preview i Production:**
```
COMPATIBILITY_FLAGS=nodejs_compat  (Type: Plaintext)
```

**UWAGA**: Environment variables **NIE** ustawiają `compatibility_date`. Runtime Settings są wymagane.

---

---

## Dlaczego to jest potrzebne?

React 19 SSR używa `MessageChannel` API, które jest Node.js builtin.
Cloudflare Workers domyślnie nie mają dostępu do Node.js APIs.
`nodejs_compat` flag włącza Node.js compatibility layer, **ALE WYMAGA `compatibility_date >= 2024-09-23`**.

### Wymagania według dokumentacji Cloudflare:
- **Minimalna data**: `2024-09-23` (pierwsza wersja z pełnym wsparciem MessageChannel)
- **Zalecana data**: `2025-11-02` lub nowsza (najbardziej aktualna)
- **nodejs_compat flag**: MUSI być aktywny

### Dlaczego wrangler.toml nie wystarcza?

Cloudflare Pages automatic deployments z GitHub **czytają** `wrangler.toml` ale **NIE APLIKUJĄ** compatibility settings z tego pliku. Dashboard configuration ma pierwszeństwo i jest JEDYNYM sposobem na ustawienie runtime compatibility dla automatycznych deploymentów.

---

---

## Weryfikacja

Po poprawnej konfiguracji (Runtime Settings z compatibility_date >= 2024-09-23 + nodejs_compat), deployment powinien się udać:

```
✅ Success! Uploaded X files
✨ Upload complete!
Success: Assets published!
```

Zamiast:
```
❌ Error: Failed to publish your Function. 
Got error: Uncaught ReferenceError: MessageChannel is not defined
at chunks/_@astro-renderers_JFt8ruBS.mjs:6827:16
```

## Troubleshooting

### Deployment nadal failuje po ustawieniu flags

**Problem**: `nodejs_compat` jest ustawiony w Dashboard, ale deployment nadal pokazuje błąd `MessageChannel is not defined`

**Rozwiązanie**: Sprawdź `compatibility_date` w Runtime Settings:
1. Dashboard → Workers & Pages → 10x-cards → Settings → Functions → Runtime
2. **Preview** environment - upewnij się że data to **2025** (NIE 2024!)
3. **Production** environment - upewnij się że data to **2025** (NIE 2024!)
4. Jeśli widzisz `Nov 2, 2024` - zmień na `Nov 2, 2025` lub nowszą datę
5. Save i retriggernąć deployment

**Wyjaśnienie**: 
- `nodejs_compat` dostępny od `2024-09-23`
- Daty wcześniejsze niż `2024-09-23` NIE mają pełnego wsparcia MessageChannel
- `Nov 2, 2024` to OK technicznie (po 23 Sep), ale może mieć bugs
- `Nov 2, 2025` zapewnia najnowszą wersję wszystkich APIs

### Skąd wiem jaką datę ustawić?

Według Cloudflare docs: "When you start your project, you should always set compatibility_date to the current date."

**Dzisiejsza data**: `2025-11-02` ← użyj tej lub nowszej
**Minimalna wymagana**: `2024-09-23` (dla nodejs_compat)

### Deploy z wrangler CLI działa, ale GitHub auto-deploy nie

To jest znany issue - `wrangler.toml` jest używany przez CLI, ale **ignorowany** przez automatic GitHub deployments w Pages. Dashboard settings są wymagane dla auto-deployments.
