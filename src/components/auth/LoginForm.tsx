/**
 * LoginForm Component
 * 
 * Handles user login with email and password.
 * Displays validation errors and provides redirect functionality.
 */

import { useState, useTransition, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { signInSchema, type SignInInput } from '@/lib/validation/auth.schemas';

/**
 * Delay before redirect to allow cookies to be set by the browser
 * and toast message to be displayed to the user
 */
const REDIRECT_DELAY_MS = 500;

interface LoginFormProps {
  nextUrl?: string;
}

export default function LoginForm({ nextUrl }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof SignInInput, string>>>({});
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();

  const loading = isPending || isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof SignInInput, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof SignInInput;
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/sign-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin', // Important: include cookies
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setErrors({ email: 'Nieprawidłowy e-mail lub hasło' });
          return;
        }
        if (response.status === 429) {
          toast.error('Zbyt wiele prób logowania. Spróbuj ponownie później.');
          return;
        }
        if (response.status === 400) {
          const errorData = await response.json();
          if (errorData.error?.errors) {
            const fieldErrors: Partial<Record<keyof SignInInput, string>> = {};
            errorData.error.errors.forEach((err: { field: string; message: string }) => {
              fieldErrors[err.field as keyof SignInInput] = err.message;
            });
            setErrors(fieldErrors);
            return;
          }
        }
        throw new Error('Wystąpił błąd podczas logowania');
      }

      // Success (303 redirect) - show optimistic message and redirect
      startTransition(() => {
        toast.success('Zalogowano pomyślnie');
        
        // Get redirect URL from response Location header or use default
        const redirectUrl = response.headers.get('Location') || nextUrl || '/decks';
        
        // Delay to allow cookies to be set and toast to show
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, REDIRECT_DELAY_MS);
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Nieznany błąd';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={emailId}>Adres e-mail</Label>
          <Input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="twoj@email.pl"
            disabled={loading}
            required
            autoComplete="email"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? emailErrorId : undefined}
          />
          {errors.email && (
            <p id={emailErrorId} className="text-sm text-destructive" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={passwordId}>Hasło</Label>
            <a
              href="/auth/forgot-password"
              className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              tabIndex={loading ? -1 : 0}
            >
              Zapomniałeś hasła?
            </a>
          </div>
          <Input
            id={passwordId}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            required
            autoComplete="current-password"
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? passwordErrorId : undefined}
          />
          {errors.password && (
            <p id={passwordErrorId} className="text-sm text-destructive" role="alert">
              {errors.password}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loading || !email.trim() || !password}
      >
        {loading ? 'Logowanie...' : 'Zaloguj się'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Nie masz konta?{' '}
        <a
          href="/auth/register"
          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          Zarejestruj się
        </a>
      </p>
    </form>
  );
}
