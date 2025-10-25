import { Button } from '@/components/ui/button';

interface SaveBarProps {
  selectedCount: number;
  disabled: boolean;
  onSave: () => void;
  loading?: boolean;
}

/**
 * SaveBar - Bottom action bar with save button
 *
 * Fixed at bottom of screen, shows selected count and save CTA
 */
export function SaveBar({
  selectedCount,
  disabled,
  onSave,
  loading = false,
}: SaveBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
        <div className="text-sm text-muted-foreground">
          Wybrano: <span className="font-medium text-foreground">{selectedCount}</span>{' '}
          {selectedCount === 1 ? 'fiszka' : 'fiszek'}
        </div>

        <Button
          onClick={onSave}
          disabled={disabled || loading}
          size="lg"
        >
          {loading ? (
            <>
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></span>
              Zapisywanie...
            </>
          ) : (
            `Zapisz wybrane (${selectedCount})`
          )}
        </Button>
      </div>
    </div>
  );
}
