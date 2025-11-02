/**
 * DeckDetailsView Component
 *
 * Main component for deck details page.
 * Combines DeckHeader and DeckCardsPanel.
 */

import { Toaster } from "@/components/ui/sonner";
import DeckHeader from "./DeckHeader";
import DeckCardsPanel from "./DeckCardsPanel";
import type { DeckDTO } from "@/types";

interface DeckDetailsViewProps {
  deck: DeckDTO;
}

export default function DeckDetailsView({ deck }: DeckDetailsViewProps) {
  const handleDeckUpdated = (updated: DeckDTO) => {
    // Deck update is handled by DeckHeader internally
    // This could trigger a parent state update if needed
  };

  const handleDeckDeleted = () => {
    // Redirect is handled by DeckHeader
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <DeckHeader deck={deck} onDeckUpdated={handleDeckUpdated} onDeckDeleted={handleDeckDeleted} canStudy={true} />

      <DeckCardsPanel deck={deck} onDeckUpdated={handleDeckUpdated} />

      <Toaster />
    </div>
  );
}
