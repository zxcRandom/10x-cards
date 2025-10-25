/**
 * DeckCardsPanel Component
 * 
 * Main container for deck cards management.
 * Coordinates CardsToolbar, CardsTable, and Pagination.
 */

import { useState } from 'react';
import { useDeckDetails } from '@/components/hooks/useDeckDetails';
import CardsToolbar from './CardsToolbar';
import CardsTable from './CardsTable';
import PaginationControls from '@/components/decks/PaginationControls';
import type { DeckDTO, CardDTO } from '@/types';
import type { CardDialogState } from './types';

interface DeckCardsPanelProps {
  deck: DeckDTO;
  onDeckUpdated: (updated: DeckDTO) => void;
}

export default function DeckCardsPanel({
  deck,
  onDeckUpdated,
}: DeckCardsPanelProps) {
  const { state, actions } = useDeckDetails({
    deckId: deck.id,
    initialDeck: deck,
  });

  const [dialogState, setDialogState] = useState<CardDialogState>({
    open: false,
    mode: 'create',
    card: null,
  });

  const handleSearchChange = (q: string) => {
    actions.setSearch(q);
  };

  const handleLimitChange = (limit: number) => {
    actions.setLimit(limit);
  };

  const handleCreateClick = () => {
    setDialogState({
      open: true,
      mode: 'create',
      card: null,
    });
  };

  const handleEditClick = (card: CardDTO) => {
    setDialogState({
      open: true,
      mode: 'edit',
      card,
    });
  };

  const handleDeleteClick = async (card: CardDTO) => {
    // Will be implemented with ConfirmDialog
    console.log('Delete card:', card.id);
  };

  const handlePaginationChange = ({ limit, offset }: { limit: number; offset: number }) => {
    if (limit !== state.query.limit) {
      actions.setLimit(limit);
    } else {
      actions.setOffset(offset);
    }
  };

  return (
    <div className="space-y-6">
      <CardsToolbar
        q={state.query.q || ''}
        limit={state.query.limit}
        onSearchChange={handleSearchChange}
        onLimitChange={handleLimitChange}
        onCreate={handleCreateClick}
      />

      {state.loading && state.cards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Ładowanie kart...
        </div>
      ) : state.error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{state.error}</p>
          <button
            onClick={() => actions.refreshCards()}
            className="text-primary hover:underline"
          >
            Spróbuj ponownie
          </button>
        </div>
      ) : state.cards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {state.query.q ? (
            <>
              <p className="mb-2">Nie znaleziono kart pasujących do wyszukiwania</p>
              <button
                onClick={() => actions.setSearch('')}
                className="text-primary hover:underline"
              >
                Wyczyść wyszukiwanie
              </button>
            </>
          ) : (
            <p>Brak kart w tej talii. Dodaj pierwszą fiszkę!</p>
          )}
        </div>
      ) : (
        <>
          <CardsTable
            items={state.cards}
            sort={state.query.sort}
            order={state.query.order}
            onSortChange={actions.setSort}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
          />

          <PaginationControls
            total={state.total}
            limit={state.query.limit}
            offset={state.query.offset}
            onChange={handlePaginationChange}
          />
        </>
      )}
    </div>
  );
}
