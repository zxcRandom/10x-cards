/**
 * DecksPage Component
 *
 * Main container for decks list view.
 * Manages state, data fetching, and dialog orchestration.
 */

import { useState } from "react";
import { toast } from "sonner";
import DecksToolbar from "./DecksToolbar";
import DecksGrid from "./DecksGrid";
import EmptyState from "./EmptyState";
import PaginationControls from "./PaginationControls";
import CreateDeckDialog from "./CreateDeckDialog";
import EditDeckDialog from "./EditDeckDialog";
import DeleteDeckDialog from "./DeleteDeckDialog";
import { useDecksList } from "@/components/hooks/useDecksList";
import type { DeckListQuery } from "./types";
import type { DeckDTO } from "@/types";

const DEFAULT_LIMIT = 12;

export default function DecksPage() {
  const [query, setQuery] = useState<DeckListQuery>({
    limit: DEFAULT_LIMIT,
    offset: 0,
    sort: "updatedAt",
    order: "desc",
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editDeck, setEditDeck] = useState<DeckDTO | null>(null);
  const [deleteDeck, setDeleteDeck] = useState<DeckDTO | null>(null);

  const { data, loading, error, state, refetch } = useDecksList(query);

  const handleQueryChange = (next: DeckListQuery) => {
    setQuery(next);
  };

  const handlePaginationChange = (next: { limit: number; offset: number }) => {
    setQuery({ ...query, ...next });
  };

  const handleCreateSuccess = (created: DeckDTO) => {
    setIsCreateOpen(false);
    toast.success("Talia została utworzona");
    refetch();
  };

  const handleEditSuccess = (updated: DeckDTO) => {
    setEditDeck(null);
    toast.success("Talia została zaktualizowana");
    refetch();
  };

  const handleDeleteSuccess = (deletedId: string) => {
    setDeleteDeck(null);
    toast.success("Talia została usunięta");

    // If we deleted the last item on a page > 1, go back one page
    if (data && data.items.length === 1 && query.offset > 0) {
      setQuery({ ...query, offset: Math.max(0, query.offset - query.limit) });
    } else {
      refetch();
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Moje talie</h1>
        <p className="text-muted-foreground mt-1">Zarządzaj swoimi taliami fiszek</p>
      </div>

      <DecksToolbar query={query} onChange={handleQueryChange} onCreateClick={() => setIsCreateOpen(true)} />

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
          <p className="font-medium">Wystąpił błąd</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.total === 0 ? (
            <EmptyState onCreateClick={() => setIsCreateOpen(true)} />
          ) : (
            <>
              <DecksGrid items={data.items} onEdit={setEditDeck} onDelete={setDeleteDeck} />
              <PaginationControls
                total={data.total}
                limit={query.limit}
                offset={query.offset}
                onChange={handlePaginationChange}
              />
            </>
          )}
        </>
      )}

      <CreateDeckDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={handleCreateSuccess} />

      <EditDeckDialog
        open={editDeck !== null}
        deck={editDeck}
        onOpenChange={(open) => !open && setEditDeck(null)}
        onSuccess={handleEditSuccess}
      />

      <DeleteDeckDialog
        open={deleteDeck !== null}
        deck={deleteDeck}
        onOpenChange={(open) => !open && setDeleteDeck(null)}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
