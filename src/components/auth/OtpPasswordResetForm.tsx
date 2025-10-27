/**
 * OtpPasswordResetForm Component
 * 
 * Handles OTP verification and password reset.
 * User enters:
 * - 6-digit OTP code from email
 * - New password
 * - Password confirmation
 */

import { useState, useTransition, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { otpPasswordResetSchema, type OtpPasswordResetInput } from '@/lib/validation/auth.schemas';

interface OtpPasswordResetFormProps {
  email: string;
}

export default function OtpPasswordResetForm({ email }: OtpPasswordResetFormProps) {
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof OtpPasswordResetInput, string>>>({});
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otpId = useId();
  const newPasswordId = useId();
  const confirmNewPasswordId = useId();
  const otpErrorId = useId();
  const newPasswordErrorId = useId();
  const confirmNewPasswordErrorId = useId();

  const loading = isPending || isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const result = otpPasswordResetSchema.safeParse({
      email,
      otp,
      newPassword,
      confirmNewPassword,
    });

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof OtpPasswordResetInput, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof OtpPasswordResetInput;
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/password/verify-and-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp,
          newPassword,
          confirmNewPassword,
        }),
      });

      if (!response.ok) {
        if (response.status === 400) {
          const errorData = await response.json();
          
          // Check for OTP verification error
          if (errorData.error?.message?.includes('kod')) {
            toast.error('Nieprawidłowy lub wygasły kod weryfikacyjny');
            return;
          }
          
          // Handle validation errors
          if (errorData.error?.errors) {
            const fieldErrors: Partial<Record<keyof OtpPasswordResetInput, string>> = {};
            errorData.error.errors.forEach((err: { field: string; message: string }) => {
              fieldErrors[err.field as keyof OtpPasswordResetInput] = err.message;
            });
            setErrors(fieldErrors);
            return;
          }
        }
        
        throw new Error('Wystąpił błąd podczas resetowania hasła');
      }

      // Success - redirect to login
      startTransition(() => {
        toast.success('Hasło zostało zmienione pomyślnie');
        
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* OTP Code Input */}
        <div className="space-y-2">
          <Label htmlFor={otpId}>Kod weryfikacyjny</Label>
          <Input
            id={otpId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              // Only allow digits and enforce max length of 6
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setOtp(value);
            }}
            placeholder="123456"
            disabled={loading}
            required
            autoComplete="one-time-code"
            aria-invalid={errors.otp ? 'true' : 'false'}
            aria-describedby={errors.otp ? otpErrorId : undefined}
            className="text-center text-2xl tracking-widest font-mono"
          />
          {errors.otp && (
            <p id={otpErrorId} className="text-sm text-destructive" role="alert">
              {errors.otp}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Wpisz kod 6-cyfrowy z e-maila (ważny 60 sekund)
          </p>
        </div>

        {/* New Password Input */}
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

        {/* Confirm Password Input */}
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
        disabled={loading || !otp || !newPassword || !confirmNewPassword}
      >
        {loading ? 'Resetowanie hasła...' : 'Ustaw nowe hasło'}
      </Button>
    </form>
  );
}
