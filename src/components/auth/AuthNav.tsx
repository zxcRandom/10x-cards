/**
 * AuthNav Component
 * 
 * Navigation component for authenticated users.
 * Shows user email and logout button.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AuthNavProps {
  userEmail?: string;
  currentPath?: string;
}

export default function AuthNav({ userEmail, currentPath = '/' }: AuthNavProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      const response = await fetch('/api/v1/auth/sign-out', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      // Redirect to login page
      window.location.href = '/auth/login';
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Nie udało się wylogować. Spróbuj ponownie.');
      setIsLoggingOut(false);
    }
  };

  // Helper to determine if link is active
  const isActive = (path: string) => {
    if (path === '/') {
      return currentPath === '/';
    }
    return currentPath?.startsWith(path);
  };

  const linkClass = (path: string) =>
    `text-sm font-medium transition-colors ${
      isActive(path)
        ? 'text-foreground font-semibold'
        : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <nav className="border-b border-border bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo/Brand - Links to Dashboard (/) */}
          <a 
            href="/" 
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            aria-label="Strona główna - Dashboard"
          >
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              10x Cards
            </span>
          </a>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <a
              href="/"
              className={`${linkClass('/')} hidden sm:inline`}
              aria-current={isActive('/') ? 'page' : undefined}
            >
              Dashboard
            </a>
            <a
              href="/decks"
              className={linkClass('/decks')}
              aria-current={isActive('/decks') ? 'page' : undefined}
            >
              Moje talie
            </a>
            <a
              href="/account/settings"
              className={`${linkClass('/account/settings')} hidden md:inline`}
              aria-current={isActive('/account/settings') ? 'page' : undefined}
            >
              Ustawienia
            </a>

            {/* User Menu */}
            <div className="flex items-center gap-3 pl-3 border-l border-border">
              {userEmail && (
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {userEmail}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Wylogowywanie...' : 'Wyloguj'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
