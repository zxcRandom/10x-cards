/**
 * CardsTable Component
 * 
 * Table displaying cards with sortable columns and row actions.
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { CardDTO } from '@/types';
import type { CardsSort, SortOrder } from './types';
import { ArrowUpDown, Pencil, Trash2 } from 'lucide-react';

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
  const toggleSort = (column: CardsSort) => {
    if (sort === column) {
      onSortChange(column, order === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(column, 'asc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4">
                <button
                  onClick={() => toggleSort('question')}
                  className="flex items-center gap-2 font-medium hover:text-primary"
                >
                  Pytanie
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </th>
              <th className="text-left p-4">
                <button
                  onClick={() => toggleSort('answer')}
                  className="flex items-center gap-2 font-medium hover:text-primary"
                >
                  Odpowiedź
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </th>
              <th className="text-left p-4">
                <button
                  onClick={() => toggleSort('createdAt')}
                  className="flex items-center gap-2 font-medium hover:text-primary"
                >
                  Utworzono
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </th>
              <th className="text-right p-4 w-32">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {items.map((card) => (
              <tr key={card.id} className="border-t hover:bg-muted/30">
                <td className="p-4">
                  <div className="line-clamp-2">{card.question}</div>
                </td>
                <td className="p-4">
                  <div className="line-clamp-2 text-muted-foreground">
                    {card.answer}
                  </div>
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {new Date(card.createdAt).toLocaleDateString('pl-PL')}
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(card)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(card)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {items.map((card) => (
          <Card key={card.id} className="p-4 space-y-3">
            <div>
              <div className="font-medium mb-1">Pytanie:</div>
              <div className="text-sm">{card.question}</div>
            </div>
            <div>
              <div className="font-medium mb-1">Odpowiedź:</div>
              <div className="text-sm text-muted-foreground">{card.answer}</div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                {new Date(card.createdAt).toLocaleDateString('pl-PL')}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => onEdit(card)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(card)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
