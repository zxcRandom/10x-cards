# Plan implementacji: Navigation & Layout

## Status
✅ **Zaimplementowane (MVP - Uproszczone)** - Top bar navigation zamiast Sidebar

## Decyzja MVP
**Wybrano OPCJĘ 2: Top bar (AuthNav) zamiast Sidebar**

**Uzasadnienie:**
- ✅ Prostszy w implementacji i utrzymaniu
- ✅ Mniej miejsca zajętego przez nawigację (więcej na content)
- ✅ Wystarczający dla MVP (4-5 głównych linków)
- ✅ Łatwiejszy responsive design
- ⚠️ Sidebar może być dodany w przyszłości po walidacji MVP

## Kontekst
Obecny `Layout.astro` + `AuthNav.tsx`:
- ✅ Podstawowy layout z Toaster
- ✅ Footer z linkiem do Privacy Policy
- ✅ **Top bar navigation (AuthNav)** z linkami
- ✅ **Linki**: Dashboard, Moje talie, Ustawienia, Wyloguj
- ✅ **User email** i przycisk wylogowania
- ⚠️ Brak sidebara (decyzja MVP)
- ⚠️ Brak breadcrumbs (nie wymagane dla MVP)

## Zaimplementowane rozwiązanie

### 1. AuthNav Component (`src/components/auth/AuthNav.tsx`)

**Typ**: Top bar navigation (horizontal)

**Funkcjonalność**:
- ✅ Horizontal navigation bar na górze strony
- ✅ Responsive design (ukrywa niektóre linki na mobile)
- ✅ Linki nawigacyjne:
  - Logo "10x Cards" (link do /decks)
  - Dashboard (`/`)
  - Moje talie (`/decks`)
  - Ustawienia (`/account/settings`) - ukryte na mobile (md:inline)
- ✅ User menu:
  - Email użytkownika (ukryty na mobile)
  - Przycisk "Wyloguj"
- ✅ Prosty, czysty design

**Aktualna implementacja**:
```typescript
// src/components/auth/AuthNav.tsx
export default function AuthNav({ userEmail }: AuthNavProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    // Logout logic...
  };

  return (
    <nav className="border-b border-border bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <a href="/decks">10x Cards</a>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <a href="/">Dashboard</a>
            <a href="/decks">Moje talie</a>
            <a href="/account/settings" className="hidden md:inline">Ustawienia</a>

            {/* User Menu */}
            <div className="flex items-center gap-3 pl-3 border-l">
              {userEmail && <span className="hidden sm:inline">{userEmail}</span>}
              <Button onClick={handleLogout}>Wyloguj</Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

### 2. Layout.astro (Uproszczony)

**Zmiany**:
- ❌ Usunięto Navigation (Sidebar) component
- ❌ Usunięto prop `hideNavigation`
- ✅ Prosty layout bez sidebara
- ✅ AuthNav renderowany bezpośrednio w stronach

```astro
---
// src/layouts/Layout.astro
import "../styles/global.css";
import { Toaster } from "@/components/ui/sonner";

interface Props {
  title?: string;
}

const { title = "10x Cards" } = Astro.props;
---

<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <title>{title}</title>
  </head>
  <body>
    <main class="min-h-screen">
      <slot />
    </main>
    
    <Toaster client:load />
    
    <footer class="border-t border-border bg-background">
      <!-- Footer content -->
    </footer>
  </body>
</html>
```

### 3. Użycie na stronach

**Strony z AuthNav**:
```astro
---
// src/pages/decks/index.astro
import Layout from '@/layouts/Layout.astro';
import AuthNav from '@/components/auth/AuthNav';

const user = Astro.locals.user;
---

<Layout title="Moje talie - 10x Cards">
  <AuthNav userEmail={user?.email} client:load />
  
  <!-- Page content -->
</Layout>
```

**Strony używające AuthNav**:
- ✅ `/decks` - Lista talii
- ✅ `/decks/[deckId]` - Szczegóły talii
- ✅ `/generate/review` - Recenzja AI cards
- ✅ `/account/settings` - Ustawienia konta

**Strony BEZ AuthNav**:
- ❌ `/auth/login` - Logowanie
- ❌ `/auth/register` - Rejestracja  
- ❌ `/auth/forgot-password` - Reset hasła
- ❌ `/auth/reset` - Nowe hasło
- ❌ `/privacy-policy` - Polityka prywatności

## Testy akceptacyjne

### Test 1: Nawigacja Top bar
- [ ] Logo "10x Cards" widoczne po lewej
- [ ] Linki: Dashboard, Moje talie widoczne
- [ ] Link "Ustawienia" widoczny tylko na desktop (>768px)
- [ ] Email użytkownika widoczny (desktop)
- [ ] Przycisk "Wyloguj" zawsze widoczny

### Test 2: Responsywność
- [ ] Desktop (>1024px): wszystkie linki widoczne
- [ ] Tablet (768-1024px): "Ustawienia" ukryte
- [ ] Mobile (<768px): tylko logo, Dashboard, Moje talie, Wyloguj

### Test 3: Funkcjonalność
- [ ] Kliknięcie każdego linka przenosi do właściwej strony
- [ ] "Wyloguj" wylogowuje użytkownika
- [ ] Email nie jest klikalny (tylko display)

## Przyszłe rozbudowy (Post-MVP)

### Opcjonalne ulepszenia:
1. **Sidebar dla desktop**
   - Więcej miejsca na navigation items
   - Możliwość grupowania linków
   - Ikony + tekst dla lepszego UX
   
2. **Hamburger menu dla mobile**
   - Slide-in menu z boku
   - Pełna lista linków (włącznie z Ustawienia)
   - Animacje otwarcia/zamknięcia
   
3. **Breadcrumbs**
   - W zagnieżdżonych widokach (deck details, study)
   - Nawigacja hierarchiczna
   
4. **Active link highlighting**
   - Podświetlenie aktywnej strony
   - Zmiana koloru na podstawie currentPath

## Estymacja rozbudowy
- **Sidebar + Hamburger**: ~3-4 godziny
- **Breadcrumbs**: ~1-2 godziny
- **Active link highlighting**: ~30 minut

## Notatki
- ✅ MVP: AuthNav (Top bar) wystarczający
- ⚠️ Sidebar był zaimplementowany, ale usunięty w favor prostoty
- 📝 Komponenty Sidebar/Breadcrumb nadal istnieją w `src/components/layout/`
- 🔧 Można szybko przywrócić Sidebar jeśli zajdzie potrzeba
