/**
 * DeckCard Component
 *
 * Displays a single deck card with basic information and navigation.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Sparkles } from 'lucide-react';
import type { DeckDTO } from '@/types';

interface DeckCardProps {
  deck: DeckDTO;
}

export function DeckCard({ deck }: DeckCardProps) {
  const formattedDate = new Date(deck.updatedAt).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <a href={`/decks/${deck.id}`} className="block group">
      <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
              {deck.name}
            </CardTitle>
            {deck.createdByAi && (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Sparkles className="w-3 h-3" />
                AI
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              <span>Zaktualizowano {formattedDate}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
