/**
 * RegisterForm Component
 * 
 * Handles user registration with email and password.
 * Includes password confirmation and validation.
 */

import { useState, useTransition, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { signUpSchema, type SignUpInput } from '@/lib/validation/auth.schemas';

export default function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof SignUpInput, string>>>({});
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const confirmPasswordErrorId = useId();

  const loading = isPending || isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const result = signUpSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof SignUpInput, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof SignUpInput;
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/sign-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin', // Important: include cookies in request and save from response
        body: JSON.stringify({ email, password, confirmPassword }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          // Neutral message - don't reveal if email exists
          toast.error('Nie można utworzyć konta. Spróbuj użyć innego adresu e-mail lub skontaktuj się z pomocą techniczną.');
          return;
        }
        if (response.status === 429) {
          toast.error('Zbyt wiele prób rejestracji. Spróbuj ponownie później.');
          return;
        }
        if (response.status === 400) {
          const errorData = await response.json();
          if (errorData.error?.errors) {
            const fieldErrors: Partial<Record<keyof SignUpInput, string>> = {};
            errorData.error.errors.forEach((err: { field: string; message: string }) => {
              fieldErrors[err.field as keyof SignUpInput] = err.message;
            });
            setErrors(fieldErrors);
            return;
          }
        }
        throw new Error('Wystąpił błąd podczas rejestracji');
      }

      // Success - auto-login and redirect
      // Server returns 303 with Location header
      toast.success('Konto utworzone pomyślnie');
      
      // Get redirect location from response headers or default to /decks
      const redirectUrl = response.headers.get('Location') || '/decks';
      
      // Important: Wait a bit to ensure browser saves cookies before reload
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Full page reload to load with fresh cookies
      window.location.href = redirectUrl;
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
          <Label htmlFor={passwordId}>Hasło</Label>
          <Input
            id={passwordId}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            required
            autoComplete="new-password"
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? passwordErrorId : undefined}
          />
          {errors.password && (
            <p id={passwordErrorId} className="text-sm text-destructive" role="alert">
              {errors.password}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Hasło musi mieć co najmniej 8 znaków
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={confirmPasswordId}>Potwierdź hasło</Label>
          <Input
            id={confirmPasswordId}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            required
            autoComplete="new-password"
            aria-invalid={errors.confirmPassword ? 'true' : 'false'}
            aria-describedby={errors.confirmPassword ? confirmPasswordErrorId : undefined}
          />
          {errors.confirmPassword && (
            <p id={confirmPasswordErrorId} className="text-sm text-destructive" role="alert">
              {errors.confirmPassword}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loading || !email.trim() || !password || !confirmPassword}
      >
        {loading ? 'Tworzenie konta...' : 'Utwórz konto'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Masz już konto?{' '}
        <a
          href="/auth/login"
          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          Zaloguj się
        </a>
      </p>
    </form>
  );
}
