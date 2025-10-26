/**
 * Navigation Component
 * 
 * Main navigation with responsive layout:
 * - Desktop: fixed sidebar
 * - Mobile: hamburger menu (collapsible)
 */

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
    try {
      await fetch('/api/v1/auth/sign-out', { method: 'POST' });
      window.location.href = '/auth/login';
    } catch (error) {
      console.error('Sign out error:', error);
      // Try redirecting anyway
      window.location.href = '/auth/login';
    }
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Zamknij menu' : 'Otwórz menu'}
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
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
        aria-label="Main navigation"
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
                  aria-current={active ? 'page' : undefined}
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
              <div className="px-3 py-2 text-sm text-muted-foreground truncate" title={userEmail}>
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

      {/* Spacer for desktop sidebar - prevents content from being hidden under fixed sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0" aria-hidden="true" />
    </>
  );
}

