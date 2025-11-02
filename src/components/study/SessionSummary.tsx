/**
 * SessionSummary Component
 *
 * Displays session completion summary with statistics
 * Shows total reviewed cards, average grade, and return CTA
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudySessionStats } from "./types";

interface SessionSummaryProps {
  deckId: string;
  stats: StudySessionStats;
}

export default function SessionSummary({ deckId, stats }: SessionSummaryProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Gratulacje!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Ukończyłeś sesję nauki. Świetna robota!</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Ocenione karty:</span>
              <span className="font-semibold">{stats.reviewedCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Średnia ocena:</span>
              <span className="font-semibold">{stats.averageGrade.toFixed(2)}</span>
            </div>
          </div>
          <Button className="w-full mt-4" asChild>
            <a href={`/decks/${deckId}`}>Powrót do talii</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
