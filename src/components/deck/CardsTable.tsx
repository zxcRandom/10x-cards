/**
 * CardsTable Component
 * 
 * Table displaying cards with sortable columns and row actions.
 * TO BE IMPLEMENTED
 */

import type { CardDTO } from '@/types';
import type { CardsSort, SortOrder } from './types';

interface CardsTableProps {
  items: CardDTO[];
  sort: CardsSort;
  order: SortOrder;
  onSortChange: (sort: CardsSort, order: SortOrder) => void;
  onEdit: (card: CardDTO) => void;
  onDelete: (card: CardDTO) => void;
}

export default function CardsTable({
  items,
  sort,
  order,
  onSortChange,
  onEdit,
  onDelete,
}: CardsTableProps) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-sm text-muted-foreground">
        Cards Table - To be implemented
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        {items.length} cards loaded
      </p>
    </div>
  );
}
