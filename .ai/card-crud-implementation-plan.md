# Plan implementacji: CRUD kart w Deck Details View

## Status

✅ **ZAIMPLEMENTOWANE** - Pełna funkcjonalność CRUD kart z dialogami i walidacją

## Kontekst

W widoku szczegółów talii (`/decks/[deckId]`) użytkownik powinien móc:

- Dodawać nowe fiszki ręcznie (US-009)
- Edytować istniejące fiszki (US-010)
- Usuwać fiszki z potwierdzeniem (US-010)

Obecnie:

- ✅ `CardsTable` wyświetla listę kart
- ✅ `CardsToolbar` ma przycisk "Dodaj fiszkę"
- ✅ `DeckCardsPanel` obsługuje handlery onClick
- ❌ Brak `CardDialog` do tworzenia/edycji
- ❌ Brak `ConfirmDialog` do usuwania
- ❌ Funkcja usuwania tylko loguje do konsoli

## Cel

Zaimplementować kompletny CRUD pojedynczych kart w widoku Deck Details.

## Zakres implementacji

### 1. Komponenty do stworzenia

#### 1.1 CardDialog (`src/components/deck/CardDialog.tsx`)

**Cel**: Dialog do tworzenia i edytowania pojedynczej karty

**Props**:

```typescript
interface CardDialogProps {
  open: boolean;
  mode: "create" | "edit";
  card: CardDTO | null; // null dla mode='create'
  deckId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: (card: CardDTO) => void;
}
```

**Funkcjonalność**:

- Formularz z polami:
  - Question (Pytanie) - textarea, wymagane, max 10000 znaków
  - Answer (Odpowiedź) - textarea, wymagane, max 10000 znaków
- Walidacja client-side (Zod schema)
- Obsługa stanu loading podczas submit
- Komunikaty błędów inline pod polami
- Przyciski: "Anuluj", "Zapisz" / "Dodaj"

**API Calls**:

- **Create**: `POST /api/v1/decks/{deckId}/cards`
  ```json
  { "question": "string", "answer": "string" }
  ```
- **Edit**: `PATCH /api/v1/cards/{cardId}`
  ```json
  { "question": "string", "answer": "string" }
  ```

**Obsługa błędów**:

- 400/422: walidacja - wyświetl błędy pod polami
- 401: "Twoja sesja wygasła. Zaloguj się ponownie."
- 403: "Nie masz uprawnień do tej talii"
- 404: "Karta nie została znaleziona"
- 500: "Wystąpił błąd podczas zapisywania"

**UX**:

- Toast po sukcesie: "Fiszka została dodana/zaktualizowana"
- Auto-close dialog po sukcesie
- Wywołanie `onSuccess(card)` z odpowiedzią API
- Licznik znaków dla question i answer

#### 1.2 CardConfirmDialog (`src/components/deck/CardConfirmDialog.tsx`)

**Cel**: Dialog potwierdzenia usunięcia karty

**Props**:

```typescript
interface CardConfirmDialogProps {
  open: boolean;
  card: CardDTO | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (cardId: string) => void;
}
```

**Funkcjonalność**:

- Wyświetla pytanie z karty (max 100 pierwszych znaków)
- Ostrzeżenie: "Tej operacji nie można cofnąć"
- Przyciski: "Anuluj", "Usuń fiszkę" (variant="destructive")
- Loading state podczas usuwania

**Nie wywołuje API** - tylko przekazuje potwierdzenie do rodzica

### 2. Aktualizacje istniejących komponentów

#### 2.1 DeckCardsPanel.tsx

**Zmiany**:

```typescript
// Dodać import
import CardDialog from './CardDialog';
import CardConfirmDialog from './CardConfirmDialog';

// Zmienić state
const [cardDialog, setCardDialog] = useState<{
  open: boolean;
  mode: 'create' | 'edit';
  card: CardDTO | null;
}>({ open: false, mode: 'create', card: null });

const [deleteDialog, setDeleteDialog] = useState<{
  open: boolean;
  card: CardDTO | null;
}>({ open: false, card: null });

// Nowe handlery
const handleCreateClick = () => {
  setCardDialog({ open: true, mode: 'create', card: null });
};

const handleEditClick = (card: CardDTO) => {
  setCardDialog({ open: true, mode: 'edit', card });
};

const handleDeleteClick = (card: CardDTO) => {
  setDeleteDialog({ open: true, card });
};

const handleCardSuccess = (card: CardDTO) => {
  setCardDialog({ open: false, mode: 'create', card: null });
  toast.success(
    cardDialog.mode === 'create'
      ? 'Fiszka została dodana'
      : 'Fiszka została zaktualizowana'
  );
  actions.refreshCards();
};

const handleDeleteConfirm = async (cardId: string) => {
  try {
    const response = await fetch(`/api/v1/cards/${cardId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Twoja sesja wygasła. Zaloguj się ponownie.');
      }
      if (response.status === 404) {
        throw new Error('Karta nie została znaleziona. Mogła zostać usunięta.');
      }
      throw new Error('Wystąpił błąd podczas usuwania karty');
    }

    toast.success('Fiszka została usunięta');
    setDeleteDialog({ open: false, card: null });
    actions.refreshCards();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Nieznany błąd';
    toast.error(errorMessage);
  }
};

// W JSX dodać dialogi przed zamykającym </div>
<CardDialog
  open={cardDialog.open}
  mode={cardDialog.mode}
  card={cardDialog.card}
  deckId={deck.id}
  onOpenChange={(open) => !open && setCardDialog({ open: false, mode: 'create', card: null })}
  onSuccess={handleCardSuccess}
/>

<CardConfirmDialog
  open={deleteDialog.open}
  card={deleteDialog.card}
  onOpenChange={(open) => !open && setDeleteDialog({ open: false, card: null })}
  onConfirm={handleDeleteConfirm}
/>
```

### 3. Walidacja (schemas)

#### 3.1 Użyj istniejącego schema z `src/lib/validation/card.schemas.ts`:

```typescript
import { createCardSchema, updateCardSchema } from "@/lib/validation/card.schemas";
```

Jeśli nie istnieje, stwórz:

```typescript
// src/lib/validation/card.schemas.ts
import { z } from "zod";

export const createCardSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Pytanie jest wymagane")
    .max(10000, "Pytanie nie może być dłuższe niż 10000 znaków"),
  answer: z
    .string()
    .trim()
    .min(1, "Odpowiedź jest wymagana")
    .max(10000, "Odpowiedź nie może być dłuższa niż 10000 znaków"),
});

export const updateCardSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Pytanie jest wymagane")
    .max(10000, "Pytanie nie może być dłuższe niż 10000 znaków")
    .optional(),
  answer: z
    .string()
    .trim()
    .min(1, "Odpowiedź jest wymagana")
    .max(10000, "Odpowiedź nie może być dłuższa niż 10000 znaków")
    .optional(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
```

### 4. Typy TypeScript

Dodać do `src/components/deck/types.ts` (jeśli nie istnieją):

```typescript
export interface CardDialogState {
  open: boolean;
  mode: "create" | "edit";
  card: CardDTO | null;
}

export interface CardDeleteState {
  open: boolean;
  card: CardDTO | null;
}
```

### 5. UI Components potrzebne z Shadcn/ui

- ✅ Dialog (już istnieje)
- ✅ Input (już istnieje)
- ✅ Textarea (już istnieje)
- ✅ Button (już istnieje)
- ✅ Label (już istnieje)

### 6. Testy akceptacyjne

**US-009: Manualne dodawanie fiszki**

- [ ] W widoku talii jest przycisk "Dodaj fiszkę"
- [ ] Kliknięcie otwiera dialog z formularzem
- [ ] Formularz ma pola "Pytanie" i "Odpowiedź"
- [ ] Walidacja: puste pola blokują zapis
- [ ] Walidacja: przekroczenie 10000 znaków pokazuje błąd
- [ ] Po zapisaniu dialog się zamyka
- [ ] Toast pokazuje "Fiszka została dodana"
- [ ] Nowa fiszka pojawia się na liście

**US-010: Edycja fiszki**

- [ ] Każda fiszka na liście ma przycisk "Edytuj" (ikona ołówka)
- [ ] Kliknięcie otwiera dialog z wypełnionym formularzem
- [ ] Możliwość modyfikacji pytania i odpowiedzi
- [ ] Po zapisaniu zmiany są widoczne na liście
- [ ] Toast pokazuje "Fiszka została zaktualizowana"

**US-010: Usunięcie fiszki**

- [ ] Każda fiszka na liście ma przycisk "Usuń" (ikona kosza, czerwony)
- [ ] Kliknięcie otwiera dialog potwierdzenia
- [ ] Dialog wyświetla fragment pytania
- [ ] Dialog ma ostrzeżenie o nieodwracalności
- [ ] Po potwierdzeniu fiszka znika z listy
- [ ] Toast pokazuje "Fiszka została usunięta"

### 7. Kolejność implementacji

1. **Krok 1**: Stwórz validation schemas (jeśli nie istnieją)
2. **Krok 2**: Stwórz `CardDialog.tsx`
   - Zaimplementuj formularz
   - Dodaj walidację
   - Obsłuż API calls (create i edit)
   - Dodaj obsługę błędów
3. **Krok 3**: Stwórz `CardConfirmDialog.tsx`
   - Prosty dialog potwierdzenia
4. **Krok 4**: Zaktualizuj `DeckCardsPanel.tsx`
   - Dodaj handlery
   - Zintegruj dialogi
   - Zaimplementuj DELETE API call
5. **Krok 5**: Testowanie manualne
   - Dodawanie nowej karty
   - Edycja istniejącej karty
   - Usuwanie karty
   - Walidacja formularzy
   - Obsługa błędów

### 8. Przykład użycia po implementacji

```typescript
// W DeckCardsPanel.tsx
<CardDialog
  open={cardDialog.open}
  mode={cardDialog.mode}
  card={cardDialog.card}
  deckId={deck.id}
  onOpenChange={(open) => !open && setCardDialog({ open: false, mode: 'create', card: null })}
  onSuccess={(card) => {
    toast.success(cardDialog.mode === 'create' ? 'Fiszka została dodana' : 'Fiszka została zaktualizowana');
    setCardDialog({ open: false, mode: 'create', card: null });
    actions.refreshCards();
  }}
/>

<CardConfirmDialog
  open={deleteDialog.open}
  card={deleteDialog.card}
  onOpenChange={(open) => !open && setDeleteDialog({ open: false, card: null })}
  onConfirm={async (cardId) => {
    await handleDeleteConfirm(cardId);
  }}
/>
```

## Zależności

- API endpoints `/api/v1/decks/{deckId}/cards` (POST) - **już istnieje**
- API endpoints `/api/v1/cards/{cardId}` (PATCH, DELETE) - **już istnieje**
- Shadcn/ui components - **już istnieją**
- `useDeckDetails` hook - **już istnieje**

## Estymacja

- **Czas implementacji**: 4-6 godzin
- **Priorytet**: WYSOKI (basic CRUD functionality)
- **Złożoność**: ŚREDNIA

## Uwagi

- Plain text tylko (bez formatowania) - zgodnie z PRD
- Limity długości zgodne z API (10000 znaków)
- Obsługa błędów zgodna z UI plan (mapowanie statusów HTTP)
- Dostępność (accessibility): aria-labels, keyboard navigation
