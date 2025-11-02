/**
 * ForgotPasswordForm Component
 *
 * Handles password reset requests using OTP (One-Time Password) flow.
 * Step 1: Request OTP code via email
 * Step 2: Enter OTP code + new password (handled by OtpPasswordResetForm)
 * Always shows success message for security (neutral messaging).
 */

import { useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { passwordResetRequestSchema, type PasswordResetRequestInput } from "@/lib/validation/auth.schemas";
import OtpPasswordResetForm from "./OtpPasswordResetForm";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof PasswordResetRequestInput, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);

  const emailId = useId();
  const emailErrorId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const result = passwordResetRequestSchema.safeParse({ email });
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof PasswordResetRequestInput, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof PasswordResetRequestInput;
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/auth/password/request-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Zbyt wiele prób. Spróbuj ponownie później.");
          return;
        }
        if (response.status === 400) {
          const errorData = await response.json();
          if (errorData.error?.errors) {
            const fieldErrors: Partial<Record<keyof PasswordResetRequestInput, string>> = {};
            errorData.error.errors.forEach((err: { field: string; message: string }) => {
              fieldErrors[err.field as keyof PasswordResetRequestInput] = err.message;
            });
            setErrors(fieldErrors);
            return;
          }
        }
        // For other errors, still show success (neutral messaging)
      }

      // Show OTP input form
      setIsOtpSent(true);
      toast.success("Kod weryfikacyjny został wysłany na podany adres e-mail");
    } catch {
      // Even on error, show neutral success message
      setIsOtpSent(true);
      toast.success("Kod weryfikacyjny został wysłany na podany adres e-mail");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show OTP + password form after email submission
  if (isOtpSent) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm space-y-2">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-primary mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <div className="flex-1">
              <p className="font-medium">Sprawdź swoją skrzynkę e-mail</p>
              <p className="text-muted-foreground">
                Wysłaliśmy kod weryfikacyjny (6 cyfr) na adres <strong>{email}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Kod jest ważny przez 60 sekund</p>
            </div>
          </div>
        </div>

        {/* OTP + Password Form */}
        <OtpPasswordResetForm email={email} />

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Nie otrzymałeś kodu?{" "}
            <button
              type="button"
              onClick={() => setIsOtpSent(false)}
              className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            >
              Wyślij ponownie
            </button>
          </p>
          <p className="text-sm text-muted-foreground">
            <a
              href="/auth/login"
              className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            >
              Powrót do logowania
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor={emailId}>Adres e-mail</Label>
        <Input
          id={emailId}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="twoj@email.pl"
          disabled={isSubmitting}
          required
          autoComplete="email"
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? emailErrorId : undefined}
        />
        {errors.email && (
          <p id={emailErrorId} className="text-sm text-destructive" role="alert">
            {errors.email}
          </p>
        )}
        <p className="text-sm text-muted-foreground">Otrzymasz kod weryfikacyjny (6 cyfr) na podany adres e-mail</p>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting || !email.trim()}>
        {isSubmitting ? "Wysyłanie..." : "Wyślij kod weryfikacyjny"}
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
