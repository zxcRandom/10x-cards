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
import CardDialog from './CardDialog';
import CardConfirmDialog from './CardConfirmDialog';
import PaginationControls from '@/components/decks/PaginationControls';
import { toast } from 'sonner';
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

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    card: CardDTO | null;
  }>({
    open: false,
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

  const handleDeleteClick = (card: CardDTO) => {
    setDeleteDialog({
      open: true,
      card,
    });
  };

  const handleCardSuccess = (card: CardDTO) => {
    const message = dialogState.mode === 'create'
      ? 'Fiszka została dodana'
      : 'Fiszka została zaktualizowana';
    
    toast.success(message);
    setDialogState({ open: false, mode: 'create', card: null });
    actions.refreshCards();
  };

  const handleDeleteConfirm = async (cardId: string) => {
    try {
      const response = await fetch(`/api/v1/cards/${cardId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Twoja sesja wygasła. Zaloguj się ponownie.');
        }
        if (response.status === 404) {
          throw new Error('Karta nie została znaleziona. Mogła zostać już usunięta.');
        }
        if (response.status === 403) {
          throw new Error('Nie masz uprawnień do usunięcia tej karty');
        }
        throw new Error('Wystąpił błąd podczas usuwania karty');
      }

      toast.success('Fiszka została usunięta');
      setDeleteDialog({ open: false, card: null });
      actions.refreshCards();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Nieznany błąd';
      toast.error(errorMessage);
    }
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

      {/* Card Create/Edit Dialog */}
      <CardDialog
        open={dialogState.open}
        mode={dialogState.mode}
        card={dialogState.card}
        deckId={deck.id}
        onOpenChange={(open) => {
          if (!open) {
            setDialogState({ open: false, mode: 'create', card: null });
          }
        }}
        onSuccess={handleCardSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <CardConfirmDialog
        open={deleteDialog.open}
        card={deleteDialog.card}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialog({ open: false, card: null });
          }
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
