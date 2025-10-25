/**
 * CardsToolbar Component
 * 
 * Toolbar with search, page size selector, and add card button.
 * TO BE IMPLEMENTED
 */

import { Button } from '@/components/ui/button';

interface CardsToolbarProps {
  q: string;
  limit: number;
  onSearchChange: (q: string) => void;
  onLimitChange: (limit: number) => void;
  onCreate: () => void;
}

export default function CardsToolbar({
  q,
  limit,
  onSearchChange,
  onLimitChange,
  onCreate,
}: CardsToolbarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Toolbar - To be implemented
      </div>
      <Button onClick={onCreate}>Dodaj fiszkę</Button>
    </div>
  );
}
