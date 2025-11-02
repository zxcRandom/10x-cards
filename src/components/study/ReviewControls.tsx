/**
 * ReviewControls Component
 *
 * Displays 6 grade buttons (0-5) with labels for SM-2 algorithm
 * Buttons are disabled until answer is revealed
 */

import { Button } from "@/components/ui/button";
import type { ReviewGrade } from "@/types";

interface ReviewControlsProps {
  disabled: boolean;
  onGrade: (grade: ReviewGrade) => void;
}

const GRADE_LABELS = [
  { grade: 0 as ReviewGrade, label: "Nic nie wiem", variant: "destructive" as const },
  { grade: 1 as ReviewGrade, label: "Źle", variant: "destructive" as const },
  { grade: 2 as ReviewGrade, label: "Trudno", variant: "outline" as const },
  { grade: 3 as ReviewGrade, label: "Dobrze", variant: "outline" as const },
  { grade: 4 as ReviewGrade, label: "Łatwo", variant: "default" as const },
  { grade: 5 as ReviewGrade, label: "Bardzo łatwo", variant: "default" as const },
];

export default function ReviewControls({ disabled, onGrade }: ReviewControlsProps) {
  return (
    <div className="border-t pt-6">
      <h3 className="font-semibold mb-4">Oceń swoją odpowiedź</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {GRADE_LABELS.map(({ grade, label, variant }) => (
          <Button
            key={grade}
            onClick={() => onGrade(grade)}
            disabled={disabled}
            variant={variant}
            className={`flex flex-col h-auto py-3 ${grade === 1 ? "opacity-90" : ""}`}
          >
            <span className="text-lg font-bold">{grade}</span>
            <span className="text-xs">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
