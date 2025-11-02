# Refaktoryzacja CardService - Repository Pattern

## Podsumowanie

Przeprowadzona została kompleksowa refaktoryzacja `card.service.ts` zgodnie z wzorcem **Repository Pattern**, która znacząco poprawiła jakość kodu poprzez separację odpowiedzialności.

---

## Wprowadzone zmiany

### 1. **Result<T, E> Type Pattern** (`src/lib/utils/result.ts`)

Zastąpienie niebezpiecznych union types (`T | { error: ErrorCode }`) typem Result dla lepszego type-safety.

**Korzyści:**
- Type-safe obsługa błędów bez wyjątków
- Jawne rozróżnienie między sukcesem a błędem
- Możliwość map/mapErr dla transformacji
- Metoda `toUnion()` dla kompatybilności wstecznej

**Przykład:**
```typescript
// Stary sposób (niebezpieczny)
const result = await service.createCard(...);
if ("error" in result) { // type guard podatny na błędy
  // handle error
}

// Nowy sposób (type-safe)
const result = await service.createCard(...);
if (result.isErr()) {
  console.error(result.error); // ErrorCode type
} else {
  console.log(result.value); // CardDTO type
}
```

---

### 2. **SM2Parameters Value Object** (`src/lib/domain/sm2-parameters.ts`)

Enkapsulacja parametrów algorytmu SM-2 w Value Object z wbudowaną walidacją.

**Korzyści:**
- Eliminacja magicznych liczb (2.5, 1, 0)
- Walidacja parametrów w konstruktorze
- Immutability poprzez readonly fields
- Metody pomocnicze (withEaseFactor, incrementRepetitions)
- Konwersja do/z formatu bazy danych

**Przykład:**
```typescript
// Stary sposób
const SM2_DEFAULTS = {
  easeFactor: 2.5,
  intervalDays: 1,
  repetitions: 0,
};

// Nowy sposób
const params = SM2Parameters.createDefaults();
// Automatyczna walidacja
const custom = new SM2Parameters(1.8, 3, 2);
const updated = params.withInterval(7);
```

---

### 3. **CardRepository** (`src/lib/repositories/card.repository.ts`)

Warstwa dostępu do danych (Data Access Layer) odpowiedzialna wyłącznie za operacje na bazie danych.

**Odpowiedzialności:**
- CRUD operations na tabeli cards
- Zapytania SELECT/INSERT/UPDATE/DELETE
- Zwraca surowe dane z bazy (DbCard)
- Rzuca wyjątki w przypadku błędów bazy

**Metody:**
- `findById(cardId, userId)` - pobiera kartę z weryfikacją ownership
- `create(deckId, command, sm2Params, reviewDate)` - tworzy kartę
- `createBatch(...)` - tworzy wiele kart naraz
- `update(cardId, updates)` - aktualizuje pytanie/odpowiedź
- `list(deckId, options)` - listuje karty z paginacją i sortowaniem
- `verifyCardOwnership(cardId, userId)` - weryfikuje dostęp
- `verifyDeckOwnership(deckId, userId)` - weryfikuje własność decka
- `delete(cardId)` - usuwa kartę

**Przykład:**
```typescript
const repository = new CardRepository(supabase);
const dbCard = await repository.create(
  deckId,
  { question: "Q?", answer: "A" },
  SM2Parameters.createDefaults(),
  new Date().toISOString()
);
```

---

### 4. **CardService (Refactored)** (`src/lib/services/card.service.ts`)

Warstwa logiki biznesowej (Business Logic Layer) orkiestrująca operacje na kartach.

**Odpowiedzialności:**
- Logika biznesowa (np. nowe karty dostają domyślne parametry SM-2)
- Autoryzacja (weryfikacja ownership przed operacjami)
- Mapowanie błędów bazy na błędy domenowe
- Transformacja DbCard → CardDTO
- Zwraca Result<T, ErrorCode> dla type-safety

**Zmiana architektury:**
- Ze statycznego obiektu → na klasę z dependency injection
- Deleguje operacje do CardRepository
- Skupia się wyłącznie na logice biznesowej

**Przed:**
```typescript
export const CardService = {
  async createCard(
    supabase: SupabaseClient,
    deckId: string,
    command: CreateCardCommand
  ): Promise<CardDTO | { error: ErrorCode }> {
    // Mieszanka logiki biznesowej i zapytań SQL
    const { data, error } = await supabase
      .from("cards")
      .insert({
        deck_id: deckId,
        question: command.question.trim(),
        answer: command.answer.trim(),
        ease_factor: SM2_DEFAULTS.easeFactor, // magiczne liczby
        // ...
      })
      .select()
      .single();
    // ...
  },
};
```

**Po:**
```typescript
export class CardService {
  private repository: CardRepository;

  constructor(supabase: SupabaseClient) {
    this.repository = new CardRepository(supabase);
  }

  async createCard(
    deckId: string,
    command: CreateCardCommand
  ): Promise<Result<CardDTO, ErrorCode>> {
    try {
      // Business Rule: nowe karty dostają domyślne SM-2
      const sm2Params = SM2Parameters.createDefaults();
      const now = new Date().toISOString();

      const dbCard = await this.repository.create(
        deckId,
        command,
        sm2Params,
        now
      );

      return Result.ok(mapCardToDTO(dbCard));
    } catch (error: any) {
      // Mapowanie błędów bazy na błędy domenowe
      if (error.code === "23503") {
        return Result.err("DECK_NOT_FOUND" as ErrorCode);
      }
      return Result.err("DATABASE_ERROR" as ErrorCode);
    }
  }
}
```

---

### 5. **Legacy Adapter** (`src/lib/services/card.service.legacy.ts`)

Adapter zapewniający kompatybilność wsteczną ze starym API.

**Cel:**
- Umożliwia stopniową migrację
- Zachowuje stary interfejs (static methods z supabase jako pierwszym parametrem)
- Wewnętrznie używa nowego CardService

**Przykład:**
```typescript
// Stare API (nadal działa dzięki adapterowi)
const result = await CardService.createCard(
  supabase,
  deckId,
  command
);

// Nowe API (preferowane)
const service = new CardService(supabase);
const result = await service.createCard(deckId, command);
```

---

## Struktura katalogów

```
src/
├── lib/
│   ├── domain/                    # Domain models
│   │   └── sm2-parameters.ts      # SM-2 Value Object
│   ├── repositories/              # Data Access Layer
│   │   └── card.repository.ts     # CardRepository
│   ├── services/                  # Business Logic Layer
│   │   ├── card.service.ts        # CardService (refactored)
│   │   └── card.service.legacy.ts # Legacy adapter
│   └── utils/
│       └── result.ts              # Result type pattern
└── pages/api/v1/                  # API endpoints (używają legacy adapter)
```

---

## Korzyści refaktoryzacji

### 1. **Separation of Concerns**
- **Repository**: tylko dostęp do danych
- **Service**: tylko logika biznesowa
- **DTO Mapping**: centralna transformacja danych

### 2. **Lepsze testowanie**
```typescript
// Teraz można łatwo mockować repository
const mockRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  // ...
};

const service = new CardService(supabase);
service['repository'] = mockRepository; // inject mock
```

### 3. **Type Safety**
- Result<T, E> eliminuje błędy z type guards
- SM2Parameters waliduje parametry w runtime
- Jawne typy dla wszystkich operacji

### 4. **Reużywalność**
- Repository może być użyty przez inne serwisy
- SM2Parameters może być użyty w ReviewService
- Result type globalnie dostępny

### 5. **Maintainability**
- Jasne granice odpowiedzialności
- Łatwiejsze dodawanie nowych funkcji
- Centralna logika mapowania błędów

---

## Kompatybilność wsteczna

Wszystkie istniejące endpointy API działają bez zmian dzięki legacy adapterowi:

**Zaktualizowane pliki:**
- ✅ `src/pages/api/v1/cards/[cardId].ts` - użycie nowego API z Result type
- ✅ `src/pages/api/v1/decks/[deckId]/cards.ts` - legacy adapter
- ✅ `src/pages/api/v1/ai/chat.ts` - legacy adapter
- ✅ `src/pages/api/v1/ai/decks/from-text.ts` - legacy adapter

---

## Plan dalszej migracji

### Krótkoterminowy (następne PR):
1. Migracja endpointów z legacy adapter na nowe API
2. Dodanie testów jednostkowych dla CardRepository
3. Dodanie testów jednostkowych dla CardService

### Średnioterminowy:
4. Zastosowanie tego samego wzorca dla DeckService
5. Zastosowanie dla ReviewService
6. Usunięcie legacy adaptera

### Długoterminowy:
7. Wprowadzenie DI Container (np. tsyringe)
8. Command/Query Separation (CQRS)
9. Domain Events dla skomplikowanych operacji

---

## Metryki

**Przed refaktoryzacją:**
- `card.service.ts`: 567 linii
- Mieszanka logiki biznesowej i SQL
- Brak walidacji SM-2 parameters
- Union types podatne na błędy

**Po refaktoryzacji:**
- `card.service.ts`: ~350 linii (tylko logika biznesowa)
- `card.repository.ts`: ~280 linii (tylko SQL)
- `sm2-parameters.ts`: ~145 linii (Value Object)
- `result.ts`: ~130 linii (Type-safe error handling)
- `card.service.legacy.ts`: ~100 linii (compatibility)

**Redukcja złożoności:**
- Separated Concerns ✅
- Single Responsibility ✅
- Dependency Injection ✅
- Type Safety ✅

---

## Wnioski

Refaktoryzacja według Repository Pattern znacząco poprawiła:
1. **Czytelność** - jasne granice odpowiedzialności
2. **Testowalność** - łatwe mockowanie zależności
3. **Bezpieczeństwo typów** - Result<T, E> eliminuje błędy
4. **Maintainability** - łatwiejsze dodawanie funkcji
5. **Reużywalność** - komponenty mogą być używane niezależnie

Wzorzec może być zastosowany do pozostałych serwisów (DeckService, ReviewService, ProfileService).
