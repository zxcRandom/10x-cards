# Plan implementacji: Navigation & Layout

## Status
❌ **Niezaimplementowane** - Brak nawigacji zgodnie z UI Plan

## Kontekst
Obecny `Layout.astro`:
- ✅ Podstawowy layout z Toaster
- ✅ Footer z linkiem do Privacy Policy
- ❌ **Brak nawigacji (sidebar/menu)**
- ❌ **Brak breadcrumbs**
- ❌ **Brak linków: Dashboard, Moje talie, Ustawienia, Wyloguj**

Zgodnie z UI Plan (punkt 4):
> - **Główny układ**: Aplikacja wykorzystuje stały, boczny pasek nawigacyjny (sidebar) na urządzeniach desktopowych i ukryte menu (hamburger) na urządzeniach mobilnych.
> - **Pasek nawigacyjny**: Zawiera linki do głównych widoków: Dashboard (`/`), Moje talie (`/decks`), Ustawienia (w przyszłości), Wyloguj

## Cel
Dodać responsywną nawigację z sidebar (desktop) i hamburger menu (mobile) zgodnie z UI Plan.

## Zakres implementacji

### 1. Komponenty do stworzenia

#### 1.1 Navigation (`src/components/layout/Navigation.tsx`)

**Cel**: Główny komponent nawigacji z responsywnym layoutem

**Funkcjonalność**:
- Desktop: stały sidebar (po lewej stronie)
- Mobile: hamburger menu (collapsible)
- Linki nawigacyjne:
  - Dashboard (`/`)
  - Moje talie (`/decks`)
  - Ustawienia (`/account/settings`)
  - Wyloguj
- Aktywny link podświetlony
- Logo aplikacji na górze

**Przykładowa struktura**:
```typescript
// src/components/layout/Navigation.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Home, BookOpen, Settings, LogOut, Menu, X } from 'lucide-react';

interface NavigationProps {
  currentPath: string;
  userEmail?: string;
}

export default function Navigation({ currentPath, userEmail }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/decks', label: 'Moje talie', icon: BookOpen },
    { href: '/account/settings', label: 'Ustawienia', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(href);
  };

  const handleSignOut = async () => {
    await fetch('/api/v1/auth/sign-out', { method: 'POST' });
    window.location.href = '/auth/login';
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen w-64 bg-card border-r border-border
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">10x</span>
              </div>
              <span className="text-xl font-bold">Cards</span>
            </a>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg
                    transition-colors
                    ${active 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </a>
              );
            })}
          </nav>

          {/* User section & Sign out */}
          <div className="p-4 border-t border-border space-y-2">
            {userEmail && (
              <div className="px-3 py-2 text-sm text-muted-foreground truncate">
                {userEmail}
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              <span>Wyloguj</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Spacer for desktop sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0" />
    </>
  );
}
```

#### 1.2 Breadcrumb (`src/components/layout/Breadcrumb.tsx`)

**Cel**: Nawigacja okruszkowa dla widoków zagnieżdżonych

**Funkcjonalność**:
- Wyświetla ścieżkę: `Moje talie > Nazwa talii`
- Link do widoku nadrzędnego
- Aktywny element oznaczony `aria-current="page"`

**Przykładowa struktura**:
```typescript
// src/components/layout/Breadcrumb.tsx
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {isLast ? (
              <span 
                className="text-foreground font-medium" 
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <a
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            )}
          </div>
        );
      })}
    </nav>
  );
}
```

### 2. Aktualizacja Layout.astro

#### 2.1 Dodać Navigation do Layout

```astro
---
// src/layouts/Layout.astro
import "../styles/global.css";
import { Toaster } from "@/components/ui/sonner";
import Navigation from "@/components/layout/Navigation";

interface Props {
  title?: string;
  hideNavigation?: boolean;
}

const { title = "10x Cards", hideNavigation = false } = Astro.props;

// Get current path
const currentPath = Astro.url.pathname;

// Get user (if authenticated)
let userEmail: string | undefined;
if (!hideNavigation) {
  // TODO: Get user from Supabase session
  // const supabase = Astro.locals.supabase;
  // const { data: { user } } = await supabase.auth.getUser();
  // userEmail = user?.email;
}
---

<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <meta name="generator" content={Astro.generator} />
    <title>{title}</title>
  </head>
  <body>
    {!hideNavigation && (
      <Navigation client:load currentPath={currentPath} userEmail={userEmail} />
    )}
    
    <main class={hideNavigation ? "" : "lg:ml-64"}>
      <slot />
    </main>
    
    <Toaster client:load />
    
    <!-- Footer -->
    <footer class={`border-t border-border bg-background ${hideNavigation ? "" : "lg:ml-64"}`}>
      <div class="container max-w-6xl mx-auto px-4 py-6">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2025 10x Cards. Wszystkie prawa zastrzeżone.</p>
          <nav class="flex gap-6">
            <a 
              href="/privacy-policy" 
              class="hover:text-foreground transition-colors"
            >
              Polityka prywatności
            </a>
          </nav>
        </div>
      </div>
    </footer>
  </body>
</html>
```

### 3. Użycie w stronach

#### 3.1 Strony z nawigacją (Dashboard, Decks, etc.)

```astro
---
// src/pages/index.astro
import Layout from '@/layouts/Layout.astro';
import RecentDecksList from '@/components/dashboard/RecentDecksList';
import AIFlashcardGenerator from '@/components/dashboard/AIFlashcardGenerator';
---

<Layout title="Dashboard - 10x Cards">
  <div class="container mx-auto px-4 py-8 space-y-8">
    <div>
      <h1 class="text-3xl font-bold">Dashboard</h1>
      <p class="text-muted-foreground mt-1">
        Witaj ponownie! Wygeneruj nowe fiszki lub kontynuuj naukę.
      </p>
    </div>

    <AIFlashcardGenerator client:load />
    <RecentDecksList client:load />
  </div>
</Layout>
```

#### 3.2 Strony bez nawigacji (Login, Register, etc.)

```astro
---
// src/pages/auth/login.astro
import Layout from '@/layouts/Layout.astro';
import LoginForm from '@/components/auth/LoginForm';
---

<Layout title="Logowanie - 10x Cards" hideNavigation={true}>
  <div class="min-h-screen flex items-center justify-center">
    <LoginForm client:load />
  </div>
</Layout>
```

#### 3.3 Strony z breadcrumbs (Deck Details)

```astro
---
// src/pages/decks/[deckId].astro
import Layout from '@/layouts/Layout.astro';
import Breadcrumb from '@/components/layout/Breadcrumb';
import DeckDetailsView from '@/components/deck/DeckDetailsView';

// Get deck data
const { deckId } = Astro.params;
// ... fetch deck

const breadcrumbItems = [
  { label: 'Moje talie', href: '/decks' },
  { label: deck.name },
];
---

<Layout title={`${deck.name} - 10x Cards`}>
  <div class="container mx-auto px-4 py-8 space-y-6">
    <Breadcrumb items={breadcrumbItems} client:load />
    <DeckDetailsView deck={deck} client:only="react" />
  </div>
</Layout>
```

### 4. Ikony (Lucide React)

**Już zainstalowane**: `lucide-react`

Używane ikony:
- `Home` - Dashboard
- `BookOpen` - Moje talie
- `Settings` - Ustawienia
- `LogOut` - Wyloguj
- `Menu` - Hamburger menu (mobile)
- `X` - Zamknij menu
- `ChevronRight` - Breadcrumb separator

### 5. Responsywność

**Breakpoint**: `lg:` (1024px)

**Desktop (≥1024px)**:
- Sidebar stały, szerokość 256px (w-64)
- Main content z marginesem `ml-64`
- Footer z marginesem `ml-64`

**Mobile (<1024px)**:
- Sidebar ukryty (`-translate-x-full`)
- Hamburger button w prawym górnym rogu
- Kliknięcie pokazuje sidebar (overlay)
- Kliknięcie poza sidebar zamyka menu

### 6. Sign Out Endpoint

Nawigacja używa endpoint `/api/v1/auth/sign-out` - **sprawdź czy istnieje**:

```typescript
// src/pages/api/v1/auth/sign-out.ts
import type { APIRoute } from 'astro';
import { createServerClient } from '@/db/supabase.client';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createServerClient(
    cookies,
    request.headers.get('cookie'),
    request.headers.get('authorization')
  );

  const { error } = await supabase.auth.signOut();

  if (error) {
    return new Response(
      JSON.stringify({ error: { message: error.message } }),
      { status: 500 }
    );
  }

  // Clear cookies
  cookies.delete('sb-access-token', { path: '/' });
  cookies.delete('sb-refresh-token', { path: '/' });

  return new Response(
    JSON.stringify({ status: 'success' }),
    { status: 200 }
  );
};
```

### 7. Testy akceptacyjne

**Desktop**:
- [ ] Sidebar widoczny po lewej stronie (256px)
- [ ] Logo aplikacji na górze sidebar
- [ ] Linki nawigacyjne: Dashboard, Moje talie, Ustawienia
- [ ] Aktywny link podświetlony
- [ ] E-mail użytkownika na dole (jeśli zalogowany)
- [ ] Przycisk "Wyloguj" na dole
- [ ] Main content ma margines 256px z lewej
- [ ] Footer ma margines 256px z lewej

**Mobile**:
- [ ] Sidebar ukryty domyślnie
- [ ] Hamburger button w prawym górnym rogu
- [ ] Kliknięcie hamburgera otwiera sidebar
- [ ] Ciemne tło (overlay) za sidearem
- [ ] Kliknięcie overlay zamyka menu
- [ ] Kliknięcie X w menu zamyka menu
- [ ] Kliknięcie linku zamyka menu i przechodzi do strony

**Breadcrumbs**:
- [ ] Wyświetlane w widokach zagnieżdżonych (Deck Details, Study)
- [ ] Format: `Moje talie > Nazwa talii`
- [ ] Link do widoku nadrzędnego działa
- [ ] Aktywny element bez linku

**Sign Out**:
- [ ] Kliknięcie "Wyloguj" wylogowuje użytkownika
- [ ] Przekierowanie do `/auth/login`
- [ ] Sesja jest unieważniona

### 8. Kolejność implementacji

1. **Krok 1**: Utworzyć komponent Navigation
   - Stwórz `src/components/layout/Navigation.tsx`
   - Zaimplementuj strukturę
   - Dodaj responsywność (desktop + mobile)

2. **Krok 2**: Utworzyć komponent Breadcrumb
   - Stwórz `src/components/layout/Breadcrumb.tsx`
   - Zaimplementuj strukturę

3. **Krok 3**: Zweryfikować endpoint sign-out
   - Sprawdź czy istnieje `/api/v1/auth/sign-out`
   - Jeśli nie, stwórz

4. **Krok 4**: Zaktualizować Layout.astro
   - Dodać Navigation
   - Dodać conditional rendering (hideNavigation)
   - Dodać margines dla main i footer

5. **Krok 5**: Zaktualizować strony
   - Dodać `hideNavigation={true}` dla auth pages
   - Dodać breadcrumbs w Deck Details, Study Session

6. **Krok 6**: Testowanie
   - Desktop: sidebar, linki, aktywny stan
   - Mobile: hamburger menu, overlay
   - Breadcrumbs w widokach zagnieżdżonych
   - Sign out

### 9. Accessibility

- ✅ `aria-label` dla hamburger button
- ✅ `aria-current="page"` dla aktywnego linku i breadcrumb
- ✅ `aria-label="Breadcrumb"` dla breadcrumb nav
- ✅ Keyboard navigation (focus states)
- ✅ Esc key closes mobile menu

## Zależności
- `lucide-react` - **już zainstalowane**
- Shadcn/ui Button - **już istnieje**
- Sign-out endpoint - **do weryfikacji/stworzenia**

## Estymacja
- **Czas implementacji**: 4-5 godzin
- **Priorytet**: WYSOKI (core UX)
- **Złożoność**: ŚREDNIA

## Uwagi
- Navigation komponent jest client-side (React) dla interaktywności
- Breadcrumb może być server-side lub client-side (prefer client dla flexibility)
- Mobile menu używa Tailwind transitions dla smooth animations
- Active link detection based on URL pathname
- Sign-out wymaga POST endpoint (już może istnieć w `src/pages/api/v1/auth/sign-out.ts`)

