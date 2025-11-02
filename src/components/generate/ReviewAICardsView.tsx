import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { ReviewCardVM, DeckDestinationVM, ReviewState } from "./types";
import type { DeckDTO } from "@/types";
import { Toolbar } from "./Toolbar";
import { CardsList } from "./CardsList";
import { SaveBar } from "./SaveBar";

interface ReviewAICardsViewProps {
  deckId: string;
}

/**
 * ReviewAICardsView - Main component for reviewing AI-generated flashcards
 *
 * Orchestrates the review process:
 * - Loads deck and cards data
 * - Manages selection, editing, and discarding of cards
 * - Handles save to new or existing deck
 */
export default function ReviewAICardsView({ deckId }: ReviewAICardsViewProps) {
  // State
  const [state, setState] = useState<ReviewState>("loading");
  const [cards, setCards] = useState<ReviewCardVM[]>([]);
  const [sourceDeckName, setSourceDeckName] = useState<string>("");
  const [destination, setDestination] = useState<DeckDestinationVM>({
    mode: "new",
    newName: "",
    existingDeckId: null,
  });
  const [availableDecks, setAvailableDecks] = useState<DeckDTO[]>([]);
  const [availableDecksLoading, setAvailableDecksLoading] = useState(false);

  // Initialize data on mount
  useEffect(() => {
    loadDeckData();
    loadAvailableDecks();
  }, [deckId]);

  /**
   * Load deck and cards from API
   */
  const loadDeckData = async () => {
    try {
      setState("loading");

      // Fetch deck details
      const deckResponse = await fetch(`/api/v1/decks/${deckId}`);
      if (!deckResponse.ok) {
        if (deckResponse.status === 404) {
          toast.error("Talia nie została znaleziona");
          window.location.href = "/";
          return;
        }
        throw new Error("Failed to load deck");
      }

      const deck: DeckDTO = await deckResponse.json();
      setSourceDeckName(deck.name);
      setDestination((prev) => ({ ...prev, newName: deck.name }));

      // Fetch cards
      const cardsResponse = await fetch(`/api/v1/decks/${deckId}/cards?limit=100`);
      if (!cardsResponse.ok) {
        throw new Error("Failed to load cards");
      }

      const cardsData = await cardsResponse.json();
      const loadedCards: ReviewCardVM[] = cardsData.items.map(
        (card: { id: string; question: string; answer: string }) => ({
          id: card.id,
          question: card.question,
          answer: card.answer,
          selected: true, // All selected by default
          edited: false,
          discarded: false,
          originalQuestion: card.question,
          originalAnswer: card.answer,
        })
      );

      setCards(loadedCards);
      setState("idle");
    } catch (error) {
      console.error("Error loading deck data:", error);
      setState("error");
      toast.error("Wystąpił błąd podczas ładowania danych");
    }
  };

  /**
   * Load list of available decks for "existing deck" option
   */
  const loadAvailableDecks = async () => {
    try {
      setAvailableDecksLoading(true);

      const response = await fetch("/api/v1/decks?limit=50");
      if (!response.ok) {
        throw new Error("Failed to load decks");
      }

      const data = await response.json();
      // Filter out the current deck from available options
      const decks = data.items.filter((d: DeckDTO) => d.id !== deckId);
      setAvailableDecks(decks);
    } catch (error) {
      console.error("Error loading available decks:", error);
      toast.error("Nie udało się załadować listy talii");
    } finally {
      setAvailableDecksLoading(false);
    }
  };

  /**
   * Toggle card selection
   */
  const handleToggleSelect = (cardId: string) => {
    setCards((prev) => prev.map((card) => (card.id === cardId ? { ...card, selected: !card.selected } : card)));
  };

  /**
   * Edit card - update question/answer
   */
  const handleEdit = (cardId: string, question: string, answer: string) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? {
              ...card,
              question,
              answer,
              edited: question !== card.originalQuestion || answer !== card.originalAnswer,
            }
          : card
      )
    );
    toast.success("Zmiany zostały zapisane");
  };

  /**
   * Discard card - soft delete in UI
   */
  const handleDiscard = (cardId: string) => {
    setCards((prev) => prev.map((card) => (card.id === cardId ? { ...card, discarded: true, selected: false } : card)));
    toast.success("Fiszka została odrzucona");
  };

  /**
   * Keep all cards - select all non-discarded
   */
  const handleKeepAll = () => {
    setCards((prev) => prev.map((card) => (card.discarded ? card : { ...card, selected: true })));
    toast.success("Wszystkie fiszki zostały zaznaczone");
  };

  /**
   * Uncheck all cards
   */
  const handleUncheckAll = () => {
    setCards((prev) => prev.map((card) => ({ ...card, selected: false })));
    toast.success("Wszystkie fiszki zostały odznaczone");
  };

  /**
   * Save selected cards
   */
  const handleSave = async () => {
    try {
      setState("saving");

      const selectedCards = cards.filter((c) => c.selected && !c.discarded);
      const discardedCards = cards.filter((c) => c.discarded || !c.selected);

      if (destination.mode === "new") {
        // Update deck name if changed
        if (destination.newName.trim() !== sourceDeckName) {
          await fetch(`/api/v1/decks/${deckId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: destination.newName.trim() }),
          });
        }

        // Update edited cards
        for (const card of selectedCards.filter((c) => c.edited)) {
          await fetch(`/api/v1/cards/${card.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: card.question,
              answer: card.answer,
            }),
          });
        }

        // Delete unselected cards
        for (const card of discardedCards) {
          await fetch(`/api/v1/cards/${card.id}`, {
            method: "DELETE",
          });
        }

        toast.success(`Zapisano ${selectedCards.length} fiszek w talii "${destination.newName}"`);
        window.location.href = `/decks/${deckId}`;
      } else {
        // mode === 'existing'
        if (!destination.existingDeckId) {
          toast.error("Wybierz talię docelową");
          setState("idle");
          return;
        }

        // Create cards in existing deck
        for (const card of selectedCards) {
          await fetch(`/api/v1/decks/${destination.existingDeckId}/cards`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: card.question,
              answer: card.answer,
            }),
          });
        }

        // Delete source deck if it's emptied
        await fetch(`/api/v1/decks/${deckId}`, {
          method: "DELETE",
        });

        toast.success(`Skopiowano ${selectedCards.length} fiszek do wybranej talii`);
        window.location.href = `/decks/${destination.existingDeckId}`;
      }
    } catch (error) {
      console.error("Error saving cards:", error);
      setState("error");
      toast.error("Wystąpił błąd podczas zapisywania");
    }
  };

  // Calculate selected count (non-discarded)
  const selectedCount = cards.filter((c) => c.selected && !c.discarded).length;
  const visibleCards = cards.filter((c) => !c.discarded);

  // Validate save button state
  const canSave =
    selectedCount > 0 &&
    state !== "saving" &&
    (destination.mode === "new" ? destination.newName.trim().length > 0 : destination.existingDeckId !== null);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="text-muted-foreground">Ładowanie fiszek...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-destructive">Wystąpił błąd podczas ładowania</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Recenzja fiszek AI</h1>
            <p className="text-muted-foreground">Przejrzyj i edytuj wygenerowane fiszki przed zapisaniem</p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Wróć
          </button>
        </div>

        <Toolbar
          destination={destination}
          onChange={setDestination}
          onKeepAll={handleKeepAll}
          onUncheckAll={handleUncheckAll}
          decks={availableDecks}
          decksLoading={availableDecksLoading}
        />

        <CardsList
          items={visibleCards}
          onEdit={handleEdit}
          onDiscard={handleDiscard}
          onToggleSelect={handleToggleSelect}
        />

        <SaveBar selectedCount={selectedCount} disabled={!canSave} onSave={handleSave} loading={state === "saving"} />
      </div>
    </div>
  );
}
