/**
 * ResetPasswordForm Component
 * 
 * Handles password reset with new password entry.
 * Used after clicking the reset link from email.
 */

import { useState, useTransition, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { passwordResetSchema, type PasswordResetInput } from '@/lib/validation/auth.schemas';

interface ResetPasswordFormProps {
  hasValidCode?: boolean;
}

export default function ResetPasswordForm({ hasValidCode = true }: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof PasswordResetInput, string>>>({});
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const newPasswordId = useId();
  const confirmNewPasswordId = useId();
  const newPasswordErrorId = useId();
  const confirmNewPasswordErrorId = useId();

  const loading = isPending || isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const result = passwordResetSchema.safeParse({ newPassword, confirmNewPassword });
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof PasswordResetInput, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof PasswordResetInput;
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/password/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Link do resetowania hasła wygasł lub jest nieprawidłowy');
          setTimeout(() => {
            window.location.href = '/auth/forgot-password';
          }, 2000);
          return;
        }
        if (response.status === 429) {
          toast.error('Zbyt wiele prób. Spróbuj ponownie później.');
          return;
        }
        if (response.status === 400) {
          const errorData = await response.json();
          if (errorData.error?.errors) {
            const fieldErrors: Partial<Record<keyof PasswordResetInput, string>> = {};
            errorData.error.errors.forEach((err: { field: string; message: string }) => {
              fieldErrors[err.field as keyof PasswordResetInput] = err.message;
            });
            setErrors(fieldErrors);
            return;
          }
        }
        throw new Error('Wystąpił błąd podczas resetowania hasła');
      }

      // Success - redirect to login
      startTransition(() => {
        toast.success('Hasło zostało zmienione');
        
        setTimeout(() => {
          window.location.href = '/auth/login';
        }, 200);
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Nieznany błąd';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasValidCode) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/20 text-destructive mb-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-lg">Link wygasł</h3>
          <p className="text-sm text-muted-foreground">
            Link do resetowania hasła wygasł lub jest nieprawidłowy.
            Linki są ważne przez 60 minut.
          </p>
        </div>

        <div className="text-center">
          <a
            href="/auth/forgot-password"
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          >
            Poproś o nowy link
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={newPasswordId}>Nowe hasło</Label>
          <Input
            id={newPasswordId}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            required
            autoComplete="new-password"
            aria-invalid={errors.newPassword ? 'true' : 'false'}
            aria-describedby={errors.newPassword ? newPasswordErrorId : undefined}
          />
          {errors.newPassword && (
            <p id={newPasswordErrorId} className="text-sm text-destructive" role="alert">
              {errors.newPassword}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Hasło musi mieć co najmniej 8 znaków
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={confirmNewPasswordId}>Potwierdź nowe hasło</Label>
          <Input
            id={confirmNewPasswordId}
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            required
            autoComplete="new-password"
            aria-invalid={errors.confirmNewPassword ? 'true' : 'false'}
            aria-describedby={errors.confirmNewPassword ? confirmNewPasswordErrorId : undefined}
          />
          {errors.confirmNewPassword && (
            <p id={confirmNewPasswordErrorId} className="text-sm text-destructive" role="alert">
              {errors.confirmNewPassword}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loading || !newPassword || !confirmNewPassword}
      >
        {loading ? 'Resetowanie hasła...' : 'Ustaw nowe hasło'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <a
          href="/auth/login"
          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          Powrót do logowania
        </a>
      </p>
    </form>
  );
}
