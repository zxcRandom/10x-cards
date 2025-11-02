/**
 * StudyCard Component
 *
 * Displays a single flashcard with question and optional answer
 * Manages the reveal/hide answer interaction
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudyCardVM } from "./types";

interface StudyCardProps {
  card: StudyCardVM;
  showAnswer: boolean;
  onShowAnswer: () => void;
  isSubmitting: boolean;
}

export default function StudyCard({ card, showAnswer, onShowAnswer, isSubmitting }: StudyCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pytanie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-lg">{card.question}</div>

        {!showAnswer ? (
          <Button onClick={onShowAnswer} className="w-full" disabled={isSubmitting}>
            Pokaż odpowiedź
          </Button>
        ) : (
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-2">Odpowiedź</h3>
            <div className="text-lg">{card.answer}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
