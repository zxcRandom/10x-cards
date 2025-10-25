import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DeckDestinationVM } from './types';
import type { DeckDTO } from '@/types';

interface ToolbarProps {
  destination: DeckDestinationVM;
  onChange: (destination: DeckDestinationVM) => void;
  onKeepAll: () => void;
  onUncheckAll: () => void;
  decks: DeckDTO[];
  decksLoading: boolean;
}

/**
 * Toolbar - Action bar above the cards list
 *
 * Contains:
 * - Deck destination selector (new vs existing)
 * - Mass actions (Keep all, Uncheck all)
 */
export function Toolbar({
  destination,
  onChange,
  onKeepAll,
  onUncheckAll,
  decks,
  decksLoading,
}: ToolbarProps) {
  return (
    <Card className="mb-6 p-4">
      <div className="space-y-4">
        {/* Destination selector */}
        <div>
          <Label className="mb-2 block text-sm font-medium">
            Gdzie zapisać fiszki?
          </Label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="destination"
                checked={destination.mode === 'new'}
                onChange={() =>
                  onChange({ ...destination, mode: 'new' })
                }
                className="h-4 w-4"
              />
              <span>Nowa talia</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="destination"
                checked={destination.mode === 'existing'}
                onChange={() =>
                  onChange({ ...destination, mode: 'existing' })
                }
                className="h-4 w-4"
              />
              <span>Istniejąca talia</span>
            </label>
          </div>
        </div>

        {/* New deck name input */}
        {destination.mode === 'new' && (
          <div>
            <Label htmlFor="deck-name" className="mb-1 block text-sm">
              Nazwa talii
            </Label>
            <Input
              id="deck-name"
              type="text"
              value={destination.newName}
              onChange={(e) =>
                onChange({ ...destination, newName: e.target.value })
              }
              placeholder="Wprowadź nazwę talii"
              className="max-w-md"
            />
          </div>
        )}

        {/* Existing deck selector */}
        {destination.mode === 'existing' && (
          <div>
            <Label htmlFor="existing-deck" className="mb-1 block text-sm">
              Wybierz talię
            </Label>
            {decksLoading ? (
              <p className="text-sm text-muted-foreground">Ładowanie talii...</p>
            ) : decks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Brak dostępnych talii. Utwórz nową talię.
              </p>
            ) : (
              <select
                id="existing-deck"
                value={destination.existingDeckId || ''}
                onChange={(e) =>
                  onChange({
                    ...destination,
                    existingDeckId: e.target.value || null,
                  })
                }
                className="max-w-md rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Wybierz talię...</option>
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Mass actions */}
        <div className="flex gap-2 border-t pt-4">
          <Button onClick={onKeepAll} variant="outline" size="sm">
            Zachowaj wszystkie
          </Button>
          <Button onClick={onUncheckAll} variant="outline" size="sm">
            Odznacz wszystkie
          </Button>
        </div>
      </div>
    </Card>
  );
}
