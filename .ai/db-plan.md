# Schemat bazy danych dla aplikacji 10x-cards

## 1. Lista tabel z kolumnami, typami danych i ograniczeniami
    tabela “users” będzie obsługiwana przez Supabase Auth
### Tabela: Users
| Kolumna | Typ danych | Ograniczenia | Opis |
|---------|------------|--------------|------|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | Unikalny identyfikator użytkownika |
| email | VARCHAR(255) | UNIQUE NOT NULL | Adres e-mail użytkownika (używany do logowania) |
| password_hash | VARCHAR(255) | NOT NULL | Zahashowane hasło użytkownika |
| deleted_at | TIMESTAMPTZ | NULL | Data soft delete (NULL jeśli konto aktywne) |
| privacy_consent | BOOLEAN | NOT NULL DEFAULT FALSE | Zgoda na przetwarzanie danych przez AI |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Data utworzenia konta |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Data ostatniej aktualizacji |

### Tabela: Decks
| Kolumna | Typ danych | Ograniczenia | Opis |
|---------|------------|--------------|------|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | Unikalny identyfikator talii |
| user_id | UUID | NOT NULL REFERENCES Users(id) ON DELETE CASCADE | ID użytkownika właściciela talii |
| name | VARCHAR(255) | NOT NULL | Nazwa talii fiszek |
| created_by_ai | BOOLEAN | NOT NULL DEFAULT FALSE | Czy talia została utworzona przez AI |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Data utworzenia talii |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Data ostatniej aktualizacji |

### Tabela: Cards
| Kolumna | Typ danych | Ograniczenia | Opis |
|---------|------------|--------------|------|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | Unikalny identyfikator fiszki |
| deck_id | UUID | NOT NULL REFERENCES Decks(id) ON DELETE CASCADE | ID talii, do której należy fiszka |
| question | VARCHAR(10000) | NOT NULL | Treść pytania fiszki |
| answer | VARCHAR(10000) | NOT NULL | Treść odpowiedzi fiszki |
| ease_factor | DECIMAL(3,2) | NOT NULL DEFAULT 2.50 CHECK (ease_factor BETWEEN 1.30 AND 2.50) | Współczynnik łatwości dla algorytmu SM-2 |
| interval_days | INTEGER | NOT NULL DEFAULT 1 CHECK (interval_days >= 1) | Liczba dni do następnej powtórki (SM-2) |
| repetitions | INTEGER | NOT NULL DEFAULT 0 CHECK (repetitions >= 0) | Liczba powtórzeń (SM-2) |
| next_review_date | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Data następnej powtórki |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Data utworzenia fiszki |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Data ostatniej aktualizacji |

### Tabela: Reviews
| Kolumna | Typ danych | Ograniczenia | Opis |
|---------|------------|--------------|------|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | Unikalny identyfikator oceny |
| card_id | UUID | NOT NULL REFERENCES Cards(id) ON DELETE CASCADE | ID fiszki, której dotyczy ocena |
| user_id | UUID | NOT NULL REFERENCES Users(id) ON DELETE CASCADE | ID użytkownika, który dokonał oceny |
| grade | INTEGER | NOT NULL CHECK (grade BETWEEN 0 AND 5) | Ocena użytkownika (0-5 dla SM-2) |
| review_date | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Data dokonania oceny |

### Tabela: AI_Generation_Logs
| Kolumna | Typ danych | Ograniczenia | Opis |
|---------|------------|--------------|------|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | Unikalny identyfikator logu |
| user_id | UUID | NOT NULL REFERENCES Users(id) ON DELETE CASCADE | ID użytkownika, który zainicjował generowanie |
| deck_id | UUID | NULL REFERENCES Decks(id) ON DELETE SET NULL | ID talii docelowej (NULL jeśli nowa talia) |
| input_text_length | INTEGER | NOT NULL | Długość tekstu wejściowego |
| generated_cards_count | INTEGER | NOT NULL DEFAULT 0 | Liczba wygenerowanych fiszek |
| error_message | TEXT | NULL | Komunikat błędu (NULL jeśli sukces) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Data logu |

## 2. Relacje między tabelami
- **Users** (1) → **Decks** (N): Jeden użytkownik może mieć wiele talii (relacja jeden-do-wielu).
- **Decks** (1) → **Cards** (N): Jedna talia może zawierać wiele fiszek (relacja jeden-do-wielu).
- **Cards** (1) → **Reviews** (N): Jedna fiszka może mieć wiele ocen w historii (relacja jeden-do-wielu).
- **Users** (1) → **Reviews** (N): Jeden użytkownik może dokonywać wiele ocen (relacja jeden-do-wielu, dodatkowa dla bezpieczeństwa).
- **Users** (1) → **AI_Generation_Logs** (N): Jeden użytkownik może mieć wiele logów generowania AI (relacja jeden-do-wielu).
- **Decks** (1) → **AI_Generation_Logs** (N): Jedna talia może być powiązana z wieloma logami (relacja jeden-do-wielu, opcjonalna).

Nie ma relacji wiele-do-wielu wymagających tabel łączących w tym schemacie MVP.

## 3. Indeksy
- **Users**: Indeks na `email` (dla szybkiego logowania).
- **Decks**: Indeks na `user_id` (dla szybkiego filtrowania talii użytkownika).
- **Cards**: 
  - Indeks na `deck_id` (dla szybkiego dostępu do fiszek w talii).
  - Indeks na `next_review_date` (dla efektywnego pobierania fiszek do powtórki).
  - Złożony indeks na (`user_id`, `next_review_date`) dla zapytań o powtórki użytkownika.
- **Reviews**: Indeks na `card_id` i `user_id` (dla historii ocen).
- **AI_Generation_Logs**: Indeks na `user_id` (dla logów użytkownika).

Wszystkie indeksy są typu B-tree dla standardowych zapytań równości i zakresu.

## 4. Zasady PostgreSQL (RLS)
Zasady RLS są włączone dla tabel `Decks`, `Cards`, `Reviews` i `AI_Generation_Logs`, aby zapewnić, że użytkownicy widzą tylko swoje dane. Polityki oparte są na `user_id` i zakładają, że `auth.uid()` zawiera ID zalogowanego użytkownika.

- **Decks**:
  - SELECT: `user_id = auth.uid()`
  - INSERT: `user_id = auth.uid()`
  - UPDATE: `user_id = auth.uid()`
  - DELETE: `user_id = auth.uid()`

- **Cards**:
  - SELECT: `deck_id IN (SELECT id FROM Decks WHERE user_id = auth.uid())`
  - INSERT: `deck_id IN (SELECT id FROM Decks WHERE user_id = auth.uid())`
  - UPDATE: `deck_id IN (SELECT id FROM Decks WHERE user_id = auth.uid())`
  - DELETE: `deck_id IN (SELECT id FROM Decks WHERE user_id = auth.uid())`

- **Reviews**:
  - SELECT: `user_id = auth.uid()`
  - INSERT: `user_id = auth.uid()`
  - UPDATE: `user_id = auth.uid()` (ograniczone do własnej historii)
  - DELETE: `user_id = auth.uid()`

- **AI_Generation_Logs**:
  - SELECT: `user_id = auth.uid()`
  - INSERT: `user_id = auth.uid()`
  - UPDATE: Brak (logi są tylko do odczytu)
  - DELETE: Brak (logi są archiwalne)

Dla tabeli `Users` RLS nie jest wymagane, ale można dodać politykę dla użytkowników do aktualizacji własnych danych.

## 5. Wszelkie dodatkowe uwagi lub wyjaśnienia dotyczące decyzji projektowych
- **Normalizacja**: Schemat jest w 3NF, aby uniknąć redundancji (np. dane użytkownika nie są duplikowane w innych tabelach).
- **UUID**: Użyte jako klucze podstawowe dla bezpieczeństwa i uniknięcia konfliktów w rozproszonym środowisku Supabase.
- **Soft Delete**: W tabeli `Users` zamiast fizycznego usunięcia, co pozwala na zachowanie integralności referencyjnej i potencjalne przywrócenie.
- **SM-2 Constraints**: Ograniczenia CHECK na `ease_factor`, `interval_days` i `repetitions` zapobiegają nieprawidłowym wartościom algorytmu.
- **Trigger dla updated_at**: Automatyczny trigger w każdej tabeli (oprócz `AI_Generation_Logs`, gdzie nie jest potrzebny) do aktualizacji `updated_at` przy każdej modyfikacji.
- **Skalowalność**: Indeksy i proste struktury zapewniają wydajność dla MVP; brak partycjonowania, jak postanowiono.
- **Bezpieczeństwo**: RLS zapewnia prywatność danych; `privacy_consent` śledzi zgodę na AI.
- **Supabase Compatibility**: Wszystkie typy danych i funkcje są zgodne z PostgreSQL w Supabase; zakładamy użycie wbudowanych mechanizmów dla hashowania haseł i autoryzacji.
- **Brakujące elementy**: Nie uwzględniono tabel dla sesji użytkowników czy preferencji, jak postanowiono w sesji. Usunięcie konta obsługiwane przez aplikację (np. ustawienie `deleted_at` i ukrycie danych).
