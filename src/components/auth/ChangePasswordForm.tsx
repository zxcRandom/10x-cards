/**
 * ChangePasswordForm Component
 * 
 * Allows authenticated users to change their password.
 * Requires current password for verification.
 */

import { useState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { passwordChangeSchema, type PasswordChangeInput } from '@/lib/validation/auth.schemas';

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof PasswordChangeInput, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmNewPasswordId = useId();
  const currentPasswordErrorId = useId();
  const newPasswordErrorId = useId();
  const confirmNewPasswordErrorId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const result = passwordChangeSchema.safeParse({
      currentPassword,
      newPassword,
      confirmNewPassword,
    });
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof PasswordChangeInput, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof PasswordChangeInput;
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/password/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setErrors({ currentPassword: 'Nieprawidłowe obecne hasło' });
          return;
        }
        if (response.status === 429) {
          toast.error('Zbyt wiele prób. Spróbuj ponownie później.');
          return;
        }
        if (response.status === 400) {
          const errorData = await response.json();
          if (errorData.error?.errors) {
            const fieldErrors: Partial<Record<keyof PasswordChangeInput, string>> = {};
            errorData.error.errors.forEach((err: { field: string; message: string }) => {
              fieldErrors[err.field as keyof PasswordChangeInput] = err.message;
            });
            setErrors(fieldErrors);
            return;
          }
        }
        throw new Error('Wystąpił błąd podczas zmiany hasła');
      }

      // Success
      toast.success('Hasło zostało zmienione');
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
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
          <Label htmlFor={currentPasswordId}>Obecne hasło</Label>
          <Input
            id={currentPasswordId}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isSubmitting}
            required
            autoComplete="current-password"
            aria-invalid={errors.currentPassword ? 'true' : 'false'}
            aria-describedby={errors.currentPassword ? currentPasswordErrorId : undefined}
          />
          {errors.currentPassword && (
            <p id={currentPasswordErrorId} className="text-sm text-destructive" role="alert">
              {errors.currentPassword}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={newPasswordId}>Nowe hasło</Label>
          <Input
            id={newPasswordId}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isSubmitting}
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
            disabled={isSubmitting}
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
        disabled={isSubmitting || !currentPassword || !newPassword || !confirmNewPassword}
      >
        {isSubmitting ? 'Zmiana hasła...' : 'Zmień hasło'}
      </Button>
    </form>
  );
}
