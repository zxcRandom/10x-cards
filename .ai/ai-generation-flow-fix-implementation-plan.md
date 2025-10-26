# Plan implementacji: Poprawka flow generowania AI

## Status
❌ **Błędna implementacja** - Flow generowania AI nie jest zgodny z PRD

## Problem
Obecny flow w `useAIGeneration` hook i `AIFlashcardGenerator`:
1. Użytkownik wkleja tekst i klika "Generuj"
2. API `/api/v1/ai/chat` tworzy deck + cards
3. Przekierowanie bezpośrednio do `/decks/{deckId}`
4. **Brak etapu recenzji fiszek**

## Wymagany flow zgodny z PRD (US-005, US-006, US-017)
1. Użytkownik wkleja tekst i klika "Generuj"
2. API `/api/v1/ai/chat` tworzy tymczasowy deck + cards
3. **Przekierowanie do `/generate/review` (ReviewAICardsView)**
4. Użytkownik recenzuje, edytuje, odrzuca fiszki
5. Użytkownik zapisuje wybrane fiszki do nowej lub istniejącej talii
6. Przekierowanie do `/decks/{deckId}`

## Kontekst istniejący
- ✅ `ReviewAICardsView` już istnieje w `src/components/generate/ReviewAICardsView.tsx`
- ✅ Komponenty pomocnicze: `Toolbar`, `CardsList`, `AICardItem`, `EditCardDialog`, `SaveBar`
- ✅ Strona `/generate/review.astro` już istnieje
- ❌ Flow nie przekierowuje do review view
- ❌ Brak obsługi "Anuluj" podczas generowania (US-017)

## Cel
Zmienić flow generowania AI tak, aby przechodził przez etap recenzji zgodnie z PRD.

## Zakres implementacji

### 1. Zmiana API response dla `/api/v1/ai/chat`

#### 1.1 Obecna odpowiedź:
```typescript
// src/types.ts
export interface AIDeckResponseDTO {
  deck: DeckDTO;
  cards: CardDTO[];
  log: AIGenerationLogDTO;
}
```

**Nie wymaga zmian** - deck i cards są już zwracane.

### 2. Zmiana flow w AIFlashcardGenerator

#### 2.1 Aktualizacja `src/components/dashboard/AIFlashcardGenerator.tsx`

**Zmiana w `handleSubmit`**:
```typescript
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  const command = {
    inputText: form.inputText.trim(),
    ...(form.deckName?.trim() && { deckName: form.deckName.trim() }),
    ...(form.maxCards && { maxCards: form.maxCards }),
  };

  const result = await generate(command);

  if (result) {
    // ZMIANA: Przekieruj do review zamiast deck details
    toast.success(
      `Wygenerowano ${result.cards.length} ${result.cards.length === 1 ? 'fiszkę' : 'fiszek'}. Przejdź do recenzji.`
    );

    // Przekieruj do review view
    window.location.href = `/generate/review?deckId=${result.deck.id}`;
    
    // NIE resetuj formularza - użytkownik może wrócić
    // setForm({ ... }); - USUŃ TO
  }
};
```

### 3. Aktualizacja ReviewAICardsView

#### 3.1 Zmiana w `src/pages/generate/review.astro`

**Upewnij się, że deckId jest przekazywany z URL**:
```astro
---
const url = new URL(Astro.request.url);
const deckId = url.searchParams.get('deckId');

if (!deckId) {
  return Astro.redirect('/');
}
---

<Layout title="Recenzja fiszek AI - 10x Cards">
  <ReviewAICardsView client:only="react" deckId={deckId} />
</Layout>
```

#### 3.2 Weryfikacja `ReviewAICardsView.tsx`

Komponent już istnieje i obsługuje:
- ✅ Ładowanie deck i cards
- ✅ Wybór/odznaczanie fiszek (checkboxy)
- ✅ Edycja fiszek (EditCardDialog)
- ✅ Odrzucanie fiszek
- ✅ "Zachowaj wszystkie" / "Odznacz wszystkie"
- ✅ Zapis do nowej talii (zmiana nazwy deck)
- ✅ Zapis do istniejącej talii (kopiowanie + usunięcie source deck)

**Potencjalne poprawki**:
```typescript
// Upewnij się, że state loading/error są poprawnie obsłużone
// Sprawdź czy wszystkie handlery są podpięte
```

### 4. Dodanie funkcji "Anuluj" podczas generowania (US-017)

#### 4.1 Aktualizacja `useAIGeneration` hook

Hook już obsługuje `cancel()` i `AbortController` - sprawdź czy działa:

```typescript
// src/components/hooks/useAIGeneration.ts
// JUŻ ISTNIEJE - zweryfikuj czy działa poprawnie

const cancel = useCallback(() => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    setState('idle');
    setError(null);
  }
}, []);
```

#### 4.2 UI dla anulowania w AIFlashcardGenerator

**Już zaimplementowane** - zweryfikuj:
```typescript
{isLoading ? (
  <Button
    type="button"
    onClick={handleCancel}
    variant="outline"
    className="w-full"
  >
    <X className="w-4 h-4 mr-2" />
    Anuluj
  </Button>
) : (
  <Button type="submit" className="w-full">
    <Sparkles className="w-4 h-4 mr-2" />
    Generuj
  </Button>
)}
```

**US-017 Dodatkowe wymagania**:
- [ ] Stan postępu podczas generowania - **obecnie: "Generowanie fiszek..."**
- [ ] Po anulowaniu: komunikat + akcje "Edytuj tekst" / "Spróbuj ponownie"

**Dodaj po anulowaniu**:
```typescript
const handleCancel = () => {
  cancel();
  // Zamiast toast.info:
  toast('Generowanie anulowane', {
    description: 'Możesz edytować tekst i spróbować ponownie.',
    action: {
      label: 'Spróbuj ponownie',
      onClick: handleSubmit,
    },
  });
};
```

### 5. Poprawki w ReviewAICardsView

#### 5.1 Dodać przycisk "Powrót do generatora"

W `ReviewAICardsView.tsx`:
```typescript
// Na górze widoku, obok tytułu
<div className="mb-6 flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold">Recenzja fiszek AI</h1>
    <p className="text-muted-foreground">
      Przejrzyj i edytuj wygenerowane fiszki przed zapisaniem
    </p>
  </div>
  <Button
    variant="outline"
    onClick={() => window.history.back()}
  >
    ← Wróć do generatora
  </Button>
</div>
```

#### 5.2 Poprawka działania "Zapisz do istniejącej talii"

Sprawdź w `handleSave`:
```typescript
if (destination.mode === 'existing') {
  if (!destination.existingDeckId) {
    toast.error('Wybierz talię docelową');
    setState('idle');
    return;
  }

  // Kopiuj karty do wybranej talii
  for (const card of selectedCards) {
    await fetch(`/api/v1/decks/${destination.existingDeckId}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: card.question,
        answer: card.answer,
      }),
    });
  }

  // Usuń tymczasowy deck (source)
  await fetch(`/api/v1/decks/${deckId}`, {
    method: 'DELETE',
  });

  toast.success(`Skopiowano ${selectedCards.length} fiszek do wybranej talii`);
  window.location.href = `/decks/${destination.existingDeckId}`;
}
```

### 6. Testy akceptacyjne

**US-005: Generowanie fiszek z tekstu**
- [ ] Po wklejeniu tekstu i kliknięciu "Generuj" proces się rozpoczyna
- [ ] Wyświetla się stan "Generowanie fiszek..."
- [ ] Po zakończeniu pojawia się toast z liczbą wygenerowanych fiszek
- [ ] **Użytkownik jest przekierowywany do `/generate/review`**
- [ ] Na stronie review widoczna jest lista proponowanych fiszek
- [ ] Każda fiszka ma opcje: checkbox (zaznacz/odznacz), "Edytuj", "Odrzuć"

**US-006: Recenzja i zapisywanie fiszek**
- [ ] Kliknięcie "Odrzuć" usuwa fiszkę z listy
- [ ] Kliknięcie "Edytuj" otwiera dialog z możliwością edycji pytania i odpowiedzi
- [ ] Po edycji fiszka jest oznaczona jako zmieniona
- [ ] Dostępny przycisk "Zachowaj wszystkie"
- [ ] Dostępny przycisk "Odznacz wszystkie"
- [ ] Mogę odznaczać pojedyncze fiszki przed zapisem
- [ ] Wybór: zapisz do nowej talii (zmień nazwę) lub do istniejącej
- [ ] Po zapisie następuje przekierowanie do widoku talii
- [ ] Toast pokazuje liczbę zapisanych fiszek

**US-017: Anulowanie generowania**
- [ ] W trakcie generowania widoczny jest przycisk "Anuluj"
- [ ] Kliknięcie "Anuluj" przerywa proces
- [ ] Nie zapisuje żadnych wyników częściowych
- [ ] Wyświetla się komunikat "Generowanie anulowane"
- [ ] Dostępne akcje: możliwość powrotu do formularza

### 7. Kolejność implementacji

1. **Krok 1**: Zmień przekierowanie w `AIFlashcardGenerator.tsx`
   - Zmień `window.location.href` z `/decks/{deckId}` na `/generate/review?deckId={deckId}`
   - Usuń reset formularza

2. **Krok 2**: Zweryfikuj `/generate/review.astro`
   - Upewnij się, że deckId jest poprawnie pobierany z query params
   - Sprawdź czy komponent ReviewAICardsView jest poprawnie podpięty

3. **Krok 3**: Testuj flow end-to-end
   - Wygeneruj fiszki
   - Sprawdź czy przekierowanie działa
   - Przetestuj recenzję (odznacz, edytuj, odrzuć)
   - Przetestuj zapis do nowej talii
   - Przetestuj zapis do istniejącej talii

4. **Krok 4**: Dodaj przycisk "Wróć do generatora" w ReviewAICardsView
   - Dodaj w headerze widoku

5. **Krok 5**: Popraw UI dla anulowania
   - Dodaj akcje w toast po anulowaniu

6. **Krok 6**: Testowanie manualne
   - Pełny flow: generuj → recenzuj → zapisz
   - Anulowanie podczas generowania
   - Powrót do generatora
   - Edge cases (brak kart, wszystkie odrzucone, etc.)

### 8. Diagram flow (przed i po)

#### Przed (błędny):
```
Dashboard → Generuj → API → Przekierowanie do /decks/{deckId}
```

#### Po (poprawny):
```
Dashboard → Generuj → API → Przekierowanie do /generate/review
         ↑                           ↓
         └─────── Wróć ──────────────┘
                                     ↓
                            Recenzja fiszek
                            (edytuj, odrzuć, zaznacz)
                                     ↓
                    Wybór: nowa talia / istniejąca
                                     ↓
                            Zapis do talii
                                     ↓
                        Przekierowanie do /decks/{deckId}
```

## Zależności
- API `/api/v1/ai/chat` - **już istnieje**
- `ReviewAICardsView` - **już istnieje**
- `/generate/review.astro` - **już istnieje**
- Card CRUD endpoints - **już istnieją**

## Estymacja
- **Czas implementacji**: 2-3 godziny
- **Priorytet**: KRYTYCZNY (niezgodność z PRD)
- **Złożoność**: NISKA (głównie zmiana przekierowania)

## Uwagi
- To jest **poprawka błędnej implementacji**, nie nowa funkcjonalność
- ReviewAICardsView już istnieje i działa - tylko flow jest błędny
- Zmiana minimalna w kodzie, duża w UX
- Po tej zmianie flow będzie zgodny z US-005, US-006, US-017

