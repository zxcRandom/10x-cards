/**
 * StudySession Component
 *
 * Main component for managing the study session flow.
 * Fetches due cards, displays current card, handles answer reveal,
 * submits reviews, and transitions to next card.
 */

import { useState, useEffect } from "react";
import type { StudyState, StudySessionStats } from "./types";
import type { ReviewGrade } from "@/types";
import LoadingState from "./LoadingState";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import StudyCard from "./StudyCard";
import ReviewControls from "./ReviewControls";
import SessionSummary from "./SessionSummary";
import { useDueCards } from "@/components/hooks/useDueCards";
import { useReviewSubmit } from "@/components/hooks/useReviewSubmit";

interface StudySessionProps {
  deckId: string;
}

export default function StudySession({ deckId }: StudySessionProps) {
  // Use custom hooks
  const { cards, loading, error, fetchCards } = useDueCards(deckId);
  const { isSubmitting, submitReview } = useReviewSubmit();

  // Local state management
  const [state, setState] = useState<StudyState>("loading");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState<StudySessionStats>({
    reviewedCount: 0,
    totalGrades: 0,
    averageGrade: 0,
  });

  // Fetch due cards on mount
  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Update state based on loading and cards
  useEffect(() => {
    if (loading) {
      setState("loading");
    } else if (error) {
      setState("error");
    } else {
      setState("ready");
    }
  }, [loading, error, cards]);

  /**
   * Handle showing the answer
   */
  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  /**
   * Handle review grade submission
   */
  const handleGrade = async (grade: ReviewGrade) => {
    if (!cards[currentIndex]) return;

    const cardId = cards[currentIndex].id;
    const reviewResponse = await submitReview(cardId, grade);

    if (!reviewResponse) {
      // Error was already handled by the hook (toast shown)
      return;
    }

    // Update statistics
    const newReviewedCount = stats.reviewedCount + 1;
    const newTotalGrades = stats.totalGrades + grade;
    const newAverageGrade = newTotalGrades / newReviewedCount;

    setStats({
      reviewedCount: newReviewedCount,
      totalGrades: newTotalGrades,
      averageGrade: newAverageGrade,
    });

    // Move to next card or finish
    const nextIndex = currentIndex + 1;
    if (nextIndex < cards.length) {
      setCurrentIndex(nextIndex);
      setShowAnswer(false);
    } else {
      setState("done");
    }
  };

  // Render loading state
  if (state === "loading") {
    return <LoadingState />;
  }

  // Render error state
  if (state === "error" && error) {
    return <ErrorState error={error} onRetry={fetchCards} />;
  }

  // Render empty state (no cards due)
  if (state === "ready" && cards.length === 0) {
    return <EmptyState deckId={deckId} />;
  }

  // Render done state (session completed)
  if (state === "done") {
    return <SessionSummary deckId={deckId} stats={stats} />;
  }

  // Render active study session
  const currentCard = cards[currentIndex];
  if (!currentCard) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex justify-between items-center text-sm text-muted-foreground">
        <span>
          Karta {currentIndex + 1} z {cards.length}
        </span>
        <span>Oceniono: {stats.reviewedCount}</span>
      </div>

      <StudyCard
        card={currentCard}
        showAnswer={showAnswer}
        onShowAnswer={handleShowAnswer}
        isSubmitting={isSubmitting}
      />

      {showAnswer && (
        <div className="mt-6">
          <ReviewControls disabled={isSubmitting} onGrade={handleGrade} />
        </div>
      )}
    </div>
  );
}
