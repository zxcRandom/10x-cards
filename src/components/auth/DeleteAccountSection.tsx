/**
 * DeleteAccountSection Component
 * 
 * Allows authenticated users to permanently delete their account.
 * Requires explicit confirmation for safety.
 */

import { useState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { deleteAccountSchema, type DeleteAccountInput } from '@/lib/validation/auth.schemas';

export default function DeleteAccountSection() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof DeleteAccountInput, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirmId = useId();
  const confirmErrorId = useId();

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const result = deleteAccountSchema.safeParse({ confirm });
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof DeleteAccountInput, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof DeleteAccountInput;
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Twoja sesja wygasła. Zaloguj się ponownie.');
          setTimeout(() => {
            window.location.href = '/auth/login';
          }, 1000);
          return;
        }
        if (response.status === 429) {
          toast.error('Zbyt wiele prób. Spróbuj ponownie później.');
          return;
        }
        if (response.status === 400) {
          const errorData = await response.json();
          if (errorData.error?.errors) {
            const fieldErrors: Partial<Record<keyof DeleteAccountInput, string>> = {};
            errorData.error.errors.forEach((err: { field: string; message: string }) => {
              fieldErrors[err.field as keyof DeleteAccountInput] = err.message;
            });
            setErrors(fieldErrors);
            return;
          }
        }
        throw new Error('Wystąpił błąd podczas usuwania konta');
      }

      // Success - redirect to home
      toast.success('Konto zostało usunięte');
      
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Nieznany błąd';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDialog = () => {
    setConfirm('');
    setErrors({});
    setIsDialogOpen(true);
  };

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-destructive">Strefa niebezpieczna</h3>
        <p className="text-sm text-muted-foreground">
          Usunięcie konta jest nieodwracalne. Wszystkie Twoje talie, fiszki i dane
          nauki zostaną trwale usunięte.
        </p>
      </div>

      <Button
        type="button"
        variant="destructive"
        onClick={handleOpenDialog}
        disabled={isSubmitting}
      >
        Usuń konto
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Czy na pewno chcesz usunąć konto?</DialogTitle>
            <DialogDescription>
              Ta akcja jest nieodwracalna. Wszystkie Twoje dane zostaną trwale usunięte
              i nie będzie możliwości ich odzyskania.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDelete}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor={confirmId}>
                  Wpisz <strong>DELETE</strong> aby potwierdzić
                </Label>
                <Input
                  id={confirmId}
                  type="text"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="DELETE"
                  disabled={isSubmitting}
                  required
                  autoComplete="off"
                  aria-invalid={errors.confirm ? 'true' : 'false'}
                  aria-describedby={errors.confirm ? confirmErrorId : undefined}
                />
                {errors.confirm && (
                  <p id={confirmErrorId} className="text-sm text-destructive" role="alert">
                    {errors.confirm}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive font-medium">
                  Ostrzeżenie:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>Wszystkie talie zostaną usunięte</li>
                  <li>Wszystkie fiszki zostaną usunięte</li>
                  <li>Historia nauki zostanie utracona</li>
                  <li>Nie będzie możliwości odzyskania danych</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting || confirm !== 'DELETE'}
              >
                {isSubmitting ? 'Usuwanie konta...' : 'Usuń konto na stałe'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
