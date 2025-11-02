/**
 * CardsToolbar Component
 *
 * Toolbar with search, page size selector, and add card button.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { useState, useEffect } from "react";

interface CardsToolbarProps {
  q: string;
  limit: number;
  onSearchChange: (q: string) => void;
  onLimitChange: (limit: number) => void;
  onCreate: () => void;
}

export default function CardsToolbar({ q, limit, onSearchChange, onLimitChange, onCreate }: CardsToolbarProps) {
  const [searchValue, setSearchValue] = useState(q);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== q) {
        onSearchChange(searchValue);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, q, onSearchChange]);

  // Sync with external changes
  useEffect(() => {
    if (q !== searchValue) {
      setSearchValue(q);
    }
  }, [q, searchValue]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Szukaj fiszek..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Pokaż:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="px-3 py-2 border rounded-md bg-background text-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <Button onClick={onCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj fiszkę
        </Button>
      </div>
    </div>
  );
}
