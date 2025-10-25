/**
 * DecksToolbar Component
 * 
 * Controls for search, sort, filter and create action.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { DeckListQuery, SortField, SortOrder } from './types';

interface DecksToolbarProps {
  query: DeckListQuery;
  onChange: (next: DeckListQuery) => void;
  onCreateClick: () => void;
}

export default function DecksToolbar({
  query,
  onChange,
  onCreateClick,
}: DecksToolbarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, q: e.target.value || undefined, offset: 0 });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...query, sort: e.target.value as SortField, offset: 0 });
  };

  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...query, order: e.target.value as SortOrder, offset: 0 });
  };

  const handleCreatedByAiToggle = (checked: boolean) => {
    onChange({
      ...query,
      createdByAi: checked ? true : undefined,
      offset: 0,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:max-w-md">
          <Input
            type="search"
            placeholder="Szukaj talii..."
            value={query.q || ''}
            onChange={handleSearchChange}
          />
        </div>
        <Button onClick={onCreateClick}>Stwórz nową talię</Button>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 items-center">
          <Label htmlFor="sort" className="text-sm">
            Sortuj:
          </Label>
          <select
            id="sort"
            value={query.sort}
            onChange={handleSortChange}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="updatedAt">Data aktualizacji</option>
            <option value="createdAt">Data utworzenia</option>
            <option value="name">Nazwa</option>
          </select>
        </div>

        <div className="flex gap-2 items-center">
          <Label htmlFor="order" className="text-sm">
            Kolejność:
          </Label>
          <select
            id="order"
            value={query.order}
            onChange={handleOrderChange}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="desc">Malejąco</option>
            <option value="asc">Rosnąco</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="createdByAi"
            checked={query.createdByAi === true}
            onCheckedChange={handleCreatedByAiToggle}
          />
          <Label htmlFor="createdByAi" className="text-sm cursor-pointer">
            Tylko talie AI
          </Label>
        </div>
      </div>
    </div>
  );
}
