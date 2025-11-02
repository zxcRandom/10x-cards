/**
 * PaginationControls Component
 *
 * Navigation controls for paginated results.
 */

import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (next: { limit: number; offset: number }) => void;
}

export default function PaginationControls({ total, limit, offset, onChange }: PaginationControlsProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasNext = offset + limit < total;
  const hasPrev = offset > 0;

  const handlePrev = () => {
    if (hasPrev) {
      onChange({ limit, offset: Math.max(0, offset - limit) });
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onChange({ limit, offset: offset + limit });
    }
  };

  if (total === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Strona {currentPage} z {totalPages} ({total} {total === 1 ? "talia" : "talie"})
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handlePrev} disabled={!hasPrev}>
          Wstecz
        </Button>
        <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasNext}>
          Dalej
        </Button>
      </div>
    </div>
  );
}
