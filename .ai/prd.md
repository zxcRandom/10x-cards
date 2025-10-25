# Dokument wymagań produktu (PRD) - 10x-cards

## 1. Przegląd produktu
10x-cards to aplikacja webowa zaprojektowana w celu rozwiązania problemu czasochłonnego tworzenia fiszek edukacyjnych. Produkt jest skierowany do programistów, którzy chcą efektywnie przyswajać nową wiedzę techniczną. Aplikacja automatyzuje proces tworzenia fiszek, wykorzystując model AI (Gemini 1.5 Flash) do generowania pytań i odpowiedzi na podstawie tekstu dostarczonego przez użytkownika.

Główne funkcjonalności MVP obejmują:
- Generowanie fiszek typu Pytanie-Odpowiedź przez AI.
- Manualne tworzenie i zarządzanie fiszkami.
- Organizację fiszek w tematyczne "talie".
- System powtórek oparty na sprawdzonym algorytmie SM-2.
- Prosty system kont użytkowników do przechowywania danych.

Celem jest dostarczenie narzędzia, które znacząco skraca czas potrzebny na przygotowanie materiałów do nauki metodą powtórek w interwałach (spaced repetition) i zachęca do jej regularnego stosowania.

## 2. Problem użytkownika
Głównym problemem, który rozwiązuje 10x-cards, jest fakt, że manualne tworzenie wysokiej jakości fiszek edukacyjnych jest procesem powolnym i pracochłonnym. Dla programistów, którzy nieustannie uczą się nowych technologii, języków i frameworków, stanowi to znaczącą barierę w efektywnym utrwalaniu wiedzy. Czas poświęcony na przygotowanie materiałów mógłby być wykorzystany na samą naukę. Ten wysoki próg wejścia często zniechęca do korzystania z jednej z najskuteczniejszych metod nauki, jaką jest spaced repetition.

## 3. Wymagania funkcjonalne
### 3.1. System kont użytkowników
- Użytkownik musi mieć możliwość założenia konta za pomocą adresu e-mail i hasła.
- Użytkownik musi mieć możliwość zalogowania się na swoje konto.
- Użytkownik musi mieć możliwość zmiany swojego hasła.
- Użytkownik musi mieć możliwość trwałego usunięcia swojego konta wraz ze wszystkimi danymi.

#### 3.1.1. Rejestracja i logowanie (MVP)
- Dostawca autentykacji: Supabase Auth (e-mail + hasło).
- Rejestracja:
    - Formularz: e-mail (weryfikacja formatu) + hasło.
    - Minimalne wymagania hasła: ≥ 8 znaków (bez dodatkowych reguł złożoności w MVP).
    - Po sukcesie użytkownik jest automatycznie zalogowany i przekierowany do panelu.
    - Weryfikacja e-mail (opcjonalna w MVP) – jeśli włączona, konto wymaga potwierdzenia linkiem.
- Logowanie:
    - Formularz: e-mail + hasło.
    - Komunikaty błędów są neutralne (bez ujawniania, czy e-mail istnieje).
    - Ograniczenie prób (rate limit): np. max 5 nieudanych prób na 10 minut per IP i per e-mail.
- Wylogowanie: unieważnienie sesji i przekierowanie do ekranu logowania/strony głównej.
- Reset hasła: link jednorazowy ważny 60 min (zgodnie z US-014).
- Sesje i tokeny:
    - Przechowywanie w bezpiecznych ciasteczkach HTTP-only, Secure, SameSite=Lax/Strict.
    - Brak przechowywania tokenów w localStorage/sessionStorage.
    - Czas życia sesji w MVP: np. 7 dni; możliwość ręcznego wylogowania.
    - Mutujące endpointy wymagają ochrony przed CSRF (token lub SameSite=Strict + double-submit).

### 3.2. Zarządzanie taliami fiszek
- Użytkownik musi mieć możliwość stworzenia nowej, pustej talii fiszek i nadania jej nazwy.
- Użytkownik musi mieć możliwość zmiany nazwy istniejącej talii.
- Użytkownik musi mieć możliwość usunięcia talii wraz ze wszystkimi zawartymi w niej fiszkami.
- Użytkownik musi widzieć listę wszystkich swoich talii.

### 3.3. Generowanie fiszek przez AI
- Użytkownik musi mieć możliwość wklejenia dowolnego tekstu w dedykowane pole tekstowe.
- System, wykorzystując model AI (Gemini 1.5 Flash) i specjalnie przygotowany prompt systemowy, generuje listę fiszek typu Pytanie-Odpowiedź.
- Użytkownik otrzymuje listę wygenerowanych fiszek do przeglądu przed zapisaniem.
- Na etapie przeglądu użytkownik może:
    - Zaakceptować fiszkę bez zmian ("Zachowaj").
    - Edytować fiszkę, a następnie ją zaakceptować ("Edytuj i zachowaj").
    - Odrzucić fiszkę.
- Użytkownik musi mieć możliwość zapisania zaakceptowanych fiszek do nowej lub istniejącej talii.
- W przypadku błędu podczas generowania, użytkownikowi musi zostać wyświetlony zrozumiały komunikat.

### 3.4. Manualne zarządzanie fiszkami
- Użytkownik musi mieć możliwość manualnego dodania nowej fiszki (Pytanie-Odpowiedź) do wybranej talii.
- Edytor fiszek obsługuje wyłącznie zwykły tekst (plain text).
- Użytkownik musi mieć możliwość edycji istniejących fiszek.
- Użytkownik musi mieć możliwość usunięcia pojedynczej fiszki z talii.
- Użytkownik musi mieć możliwość przeglądania wszystkich fiszek w obrębie jednej talii.

### 3.5. System powtórek (sesja nauki)
- System musi implementować algorytm SM-2 do obliczania interwałów powtórek.
- Podczas sesji nauki użytkownikowi prezentowane jest pytanie z fiszki.
- Po samodzielnym udzieleniu odpowiedzi, użytkownik odsłania odpowiedź zapisaną na fiszce.
- Użytkownik ocenia swoją znajomość odpowiedzi w 6-stopniowej skali (0-5) za pomocą dedykowanych przycisków: "Nic nie wiem", "Źle", "Trudno", "Dobrze", "Łatwo", "Bardzo łatwo".
- Na podstawie oceny algorytm SM-2 wyznacza datę następnej powtórki dla danej fiszki.

### 3.6. Inne
- Aplikacja musi posiadać prostą politykę prywatności, informującą użytkownika, że jego dane tekstowe są przesyłane do zewnętrznego dostawcy AI w celu przetworzenia.

## 4. Granice produktu
Następujące funkcjonalności celowo NIE wchodzą w zakres MVP, aby umożliwić szybkie wdrożenie i weryfikację kluczowych hipotez:
- Własny, zaawansowany algorytm powtórek (inny niż SM-2).
- Import fiszek z plików (np. PDF, DOCX, CSV).
- Współdzielenie talii fiszek między użytkownikami.
- Integracje z zewnętrznymi platformami edukacyjnymi.
- Dedykowane aplikacje mobilne (iOS, Android).
- Formatowanie tekstu w edytorze fiszek (np. pogrubienie, kursywa, listy).
- Specjalne formatowanie dla fragmentów kodu (np. kolorowanie składni, czcionka monospaced).
- Zaawansowane opcje konfiguracji generowania fiszek przez AI.
- Obsługa innych typów fiszek niż Pytanie-Odpowiedź.

## 5. Historyjki użytkowników
### 5.1. Zarządzanie kontem
- ID: US-001
- Tytuł: Rejestracja nowego użytkownika
- Opis: Jako nowy użytkownik, chcę móc założyć konto używając mojego adresu e-mail i hasła, aby móc zapisywać moje fiszki i postępy w nauce.
- Kryteria akceptacji:
    - Formularz rejestracji zawiera pola na adres e-mail i hasło.
    - System waliduje poprawność formatu adresu e-mail.
    - System wymaga hasła o minimalnej długości.
    - Po pomyślnej rejestracji jestem automatycznie zalogowany i przekierowany do głównego panelu aplikacji.
    - W przypadku, gdy e-mail jest już zajęty, otrzymuję stosowny komunikat.

- ID: US-002
- Tytuł: Logowanie użytkownika
- Opis: Jako zarejestrowany użytkownik, chcę móc zalogować się na moje konto, aby uzyskać dostęp do moich talii fiszek.
- Kryteria akceptacji:
    - Formularz logowania zawiera pola na adres e-mail i hasło.
    - Po podaniu poprawnych danych jestem zalogowany i przekierowany do głównego panelu.
    - W przypadku podania błędnych danych otrzymuję stosowny komunikat.

- ID: US-003
- Tytuł: Zmiana hasła
- Opis: Jako zalogowany użytkownik, chcę mieć możliwość zmiany mojego hasła, aby zabezpieczyć swoje konto.
- Kryteria akceptacji:
    - W ustawieniach konta znajduje się opcja zmiany hasła.
    - Formularz wymaga podania starego hasła i dwukrotnego wprowadzenia nowego hasła.
    - Po pomyślnej zmianie hasła otrzymuję potwierdzenie.

- ID: US-004
- Tytuł: Usunięcie konta
- Opis: Jako zalogowany użytkownik, chcę mieć możliwość trwałego usunięcia mojego konta i wszystkich moich danych.
- Kryteria akceptacji:
    - W ustawieniach konta znajduje się opcja usunięcia konta.
    - System wymaga potwierdzenia operacji, informując o jej nieodwracalności.
    - Po potwierdzeniu, moje konto i wszystkie powiązane z nim dane (talie, fiszki) są trwale usuwane.

- ID: US-014
- Tytuł: Reset zapomnianego hasła
- Opis: Jako użytkownik, który zapomniał hasła, chcę móc zresetować hasło za pomocą linku wysłanego na e-mail, aby odzyskać dostęp do konta.
- Kryteria akceptacji:
    - Na ekranie logowania dostępny jest link "Nie pamiętasz hasła?" prowadzący do formularza podania adresu e-mail.
    - Po wysłaniu formularza wyświetlany jest neutralny komunikat o wysłaniu instrukcji resetu (bez potwierdzania, czy e-mail istnieje w systemie).
    - Jeśli e-mail istnieje, wysyłany jest jednorazowy link resetu z ograniczeniem czasowym (np. 60 min) i jednorazowym użyciem.
    - Strona resetu wymaga dwukrotnego wpisania nowego hasła oraz spełnienia minimalnych wymagań hasła.
    - Po pomyślnej zmianie hasła wyświetlane jest potwierdzenie oraz link do ekranu logowania; poprzednie sesje mogą zostać unieważnione.

### 5.2. Generowanie fiszek
- ID: US-005
- Tytuł: Generowanie fiszek z tekstu
- Opis: Jako zalogowany użytkownik, chcę wkleić tekst (np. fragment dokumentacji) i wygenerować z niego fiszki, aby szybko stworzyć materiały do nauki.
- Kryteria akceptacji:
    - Na stronie głównej znajduje się duże pole tekstowe do wklejenia treści.
    - Po wklejeniu tekstu i kliknięciu przycisku "Generuj", system rozpoczyna proces generowania.
    - Po zakończeniu generowania, wyświetla mi się lista proponowanych fiszek (pytanie i odpowiedź).
    - Każda fiszka na liście ma opcje "Zachowaj", "Edytuj" i "Odrzuć".

- ID: US-006
- Tytuł: Recenzja i zapisywanie wygenerowanych fiszek
- Opis: Jako użytkownik, po wygenerowaniu fiszek, chcę je przejrzeć, edytować lub odrzucić, a następnie zapisać wybrane do talii.
- Kryteria akceptacji:
    - Kliknięcie "Odrzuć" usuwa fiszkę z listy propozycji.
    - Kliknięcie "Edytuj" pozwala na modyfikację tekstu pytania i odpowiedzi w miejscu. Po edycji fiszka jest oznaczona jako gotowa do zapisu.
    - Kliknięcie "Zachowaj" oznacza fiszkę jako gotową do zapisu.
    - Dostępna jest akcja masowa "Zachowaj wszystkie" dla wszystkich aktualnie zaakceptowanych/edytowanych fiszek.
    - Mogę granularnie odznaczyć/wykluczyć pojedyncze fiszki przed zapisem (lista zaznaczeń).
    - Po przejrzeniu fiszek, mam możliwość zapisania zaakceptowanych (z edycją lub bez) do nowej lub istniejącej talii.
    - Proces zapisu kończy się przekierowaniem do widoku talii z potwierdzeniem liczby zapisanych fiszek.

- ID: US-007
- Tytuł: Obsługa błędu generowania fiszek
- Opis: Jako użytkownik, w przypadku gdy AI nie jest w stanie wygenerować fiszek z mojego tekstu, chcę otrzymać jasny komunikat o błędzie.
- Kryteria akceptacji:
    - Jeśli proces generowania nie powiedzie się (np. z powodu błędu API), zamiast listy fiszek wyświetlany jest komunikat informujący o problemie.
    - Komunikat sugeruje spróbowanie ponownie lub użycie innego tekstu.

- ID: US-017
- Tytuł: Anulowanie generowania AI
- Opis: Jako użytkownik, podczas generowania fiszek przez AI, chcę móc anulować proces, aby nie czekać, gdy trwa zbyt długo lub zmieniłem zdanie.
- Kryteria akceptacji:
    - W trakcie generowania wyświetlany jest stan postępu oraz przycisk "Anuluj".
    - Kliknięcie "Anuluj" przerywa proces i nie zapisuje żadnych wyników częściowych.
    - Po anulowaniu wyświetlany jest komunikat "Generowanie anulowane" oraz dostępne są akcje: "Edytuj tekst" i "Spróbuj ponownie".
    - Jeśli odpowiedź AI dotrze po anulowaniu, jest ignorowana i nie modyfikuje widoku.

### 5.3. Zarządzanie taliami i fiszkami
- ID: US-008
- Tytuł: Tworzenie nowej talii
- Opis: Jako użytkownik, chcę móc stworzyć nową, pustą talię, aby móc w niej umieszczać fiszki.
- Kryteria akceptacji:
    - W panelu głównym znajduje się przycisk "Stwórz nową talię".
    - Po kliknięciu przycisku pojawia się pole do wpisania nazwy talii.
    - Po zatwierdzeniu nazwy, nowa, pusta talia pojawia się na mojej liście talii.

- ID: US-013
- Tytuł: Wylogowanie
- Opis: Jako zalogowany użytkownik, chcę móc się wylogować, aby zakończyć sesję na obecnym urządzeniu.
- Kryteria akceptacji:
    - Przycisk/akcja "Wyloguj" jest dostępna w nawigacji aplikacji.
    - Po wylogowaniu sesja/token są unieważnione; dostęp do zasobów wymaga ponownego logowania.
    - Użytkownik zostaje przekierowany do ekranu logowania lub strony głównej z informacją o wylogowaniu.

- ID: US-009
- Tytuł: Manualne dodawanie fiszki
- Opis: Jako użytkownik, chcę móc ręcznie dodać nową fiszkę do istniejącej talii.
- Kryteria akceptacji:
    - W widoku talii znajduje się przycisk "Dodaj fiszkę".
    - Po kliknięciu pojawia się formularz z polami na "Pytanie" i "Odpowiedź".
    - Po wypełnieniu i zapisaniu, nowa fiszka jest widoczna na liście fiszek w danej talii.

- ID: US-010
- Tytuł: Przeglądanie i edycja fiszek w talii
- Opis: Jako użytkownik, chcę móc przeglądać i edytować wszystkie fiszki znajdujące się w wybranej talii.
- Kryteria akceptacji:
    - Po wejściu w talię widzę listę wszystkich zawartych w niej fiszek.
    - Każda fiszka na liście ma opcję "Edytuj" i "Usuń".
    - Kliknięcie "Edytuj" pozwala na modyfikację pytania i odpowiedzi.
    - Kliknięcie "Usuń" trwale usuwa fiszkę po potwierdzeniu.

- ID: US-020
- Tytuł: Usunięcie talii z potwierdzeniem
- Opis: Jako użytkownik, chcę móc trwale usunąć całą talię wraz z jej fiszkami po świadomym potwierdzeniu, aby uniknąć przypadkowej utraty danych.
- Kryteria akceptacji:
    - W widoku listy talii i/lub widoku talii dostępna jest akcja "Usuń talię".
    - Po kliknięciu otwiera się modal z ostrzeżeniem o trwałym usunięciu wszystkich fiszek w talii.
    - Usunięcie wymaga wyraźnego potwierdzenia (np. wpisanie nazwy talii lub zaznaczenie pola "Rozumiem konsekwencje").
    - Po potwierdzeniu talia i wszystkie zawarte w niej fiszki są nieodwracalnie usuwane; użytkownik widzi komunikat potwierdzający i zostaje przekierowany do listy talii.

- ID: US-018
- Tytuł: Limity wejścia i walidacja tekstu
- Opis: Jako użytkownik, chcę znać limity długości tekstu wejściowego do generowania i mieć jasną walidację, aby uniknąć błędów.
- Kryteria akceptacji:
    - Pole wklejania tekstu wyświetla licznik znaków.
    - Ustalony jest twardy limit długości (np. 10 000 znaków w MVP); po jego przekroczeniu przycisk "Generuj" jest nieaktywny i wyświetlany jest komunikat.
    - Walidacja uruchamia się natychmiastowo (on input) i po kliknięciu "Generuj".
    - W przypadku skrócenia treści poniżej limitu przycisk ponownie staje się aktywny.

### 5.4. Sesja nauki
- ID: US-011
- Tytuł: Rozpoczęcie sesji nauki
- Opis: Jako użytkownik, chcę móc rozpocząć sesję nauki dla wybranej talii, aby powtórzyć materiał.
- Kryteria akceptacji:
    - W widoku talii znajduje się przycisk "Ucz się".
    - Sesja nauki prezentuje fiszki, dla których nadszedł termin powtórki zgodnie z algorytmem SM-2.
    - Jeśli żadna fiszka nie wymaga powtórki, wyświetlany jest odpowiedni komunikat.

- ID: US-012
- Tytuł: Ocenianie odpowiedzi
- Opis: Podczas sesji nauki, po zobaczeniu odpowiedzi, chcę ocenić swoją wiedzę, aby system mógł zaplanować kolejną powtórkę.
- Kryteria akceptacji:
    - Początkowo widoczne jest tylko pytanie.
    - Po kliknięciu przycisku "Pokaż odpowiedź", odsłaniana jest odpowiedź.
    - Pod odpowiedzią widocznych jest sześć przycisków: "Nic nie wiem" (0), "Źle" (1), "Trudno" (2), "Dobrze" (3), "Łatwo" (4), "Bardzo łatwo" (5).
    - Po kliknięciu jednego z przycisków, system zapisuje ocenę i przechodzi do następnej fiszki lub kończy sesję, jeśli to była ostatnia.

## 6. Metryki sukcesu
Kluczowe wskaźniki efektywności (KPIs) dla MVP będą mierzone w celu oceny przyjęcia produktu i jakości generowania fiszek przez AI.

### 6.1. Jakość generowania fiszek przez AI
- Cel: 75% fiszek wygenerowanych przez AI jest akceptowanych przez użytkownika.
- Pomiar: Stosunek liczby fiszek zaakceptowanych (bezpośrednio lub po edycji) do całkowitej liczby fiszek wygenerowanych przez AI.
- Analityka:
    - Zdarzenie `card_accepted_no_edit`: śledzone, gdy użytkownik klika "Zachowaj".
    - Zdarzenie `card_accepted_edited`: śledzone, gdy użytkownik edytuje, a następnie zapisuje fiszkę.
    - Zdarzenie `card_rejected`: śledzone, gdy użytkownik klika "Odrzuć".
- Formuła: ( `card_accepted_no_edit` + `card_accepted_edited` ) / ( `card_accepted_no_edit` + `card_accepted_edited` + `card_rejected` ) >= 0.75

### 6.2. Adopcja funkcji generowania przez AI
- Cel: 75% wszystkich fiszek w systemie jest tworzonych przy użyciu AI.
- Pomiar: Stosunek liczby fiszek stworzonych przez AI (i zapisanych przez użytkowników) do całkowitej liczby fiszek w systemie.
- Analityka:
    - Zdarzenie `card_created_ai`: śledzone, gdy fiszka pochodząca z AI jest zapisywana w talii.
    - Zdarzenie `card_created_manual`: śledzone, gdy użytkownik manualnie tworzy i zapisuje nową fiszkę.
- Formuła: `card_created_ai` / ( `card_created_ai` + `card_created_manual` ) >= 0.75

## 7. Wymagania bezpieczeństwa (MVP)

### 7.1. Założenia i zakres
- Celem jest minimalny, praktyczny poziom zabezpieczeń adekwatny do MVP, z jasną ścieżką rozszerzeń po walidacji produktu.

### 7.2. Kontrola dostępu i autoryzacja
- Supabase Row-Level Security (RLS) włączone dla wszystkich tabel powiązanych z użytkownikiem (np. `user_id`).
- Polityki RLS egzekwują dostęp wyłącznie do danych właściciela.
- W środowisku developerskim dopuszczalne czasowe wyłączenie RLS, ale produkcja wymaga RLS włączonego.

### 7.3. Sesje i uwierzytelnianie
- Autentykacja przez Supabase Auth (e-mail + hasło).
- Tokeny/sesje przechowywane w HttpOnly Secure cookies, SameSite=Lax/Strict.
- Neutralne komunikaty błędów przy logowaniu i resecie hasła.
- Rate limiting na krytyczne ścieżki (rejestracja, logowanie, reset hasła).

### 7.4. Walidacja i limity
- Walidacja wejścia (Zod) na wszystkich API, w tym limity długości tekstu wejściowego do AI (np. 10 000 znaków w MVP).
- Odrzucanie danych binarnych/HTML – edytory akceptują wyłącznie plaintext.

### 7.5. Komunikacja z dostawcami zewnętrznymi (AI)
- Dane tekstowe użytkownika mogą być przesyłane do OpenRouter/wybranego modelu – wyraźnie opisane w Polityce Prywatności.
- Nie wysyłać danych wrażliwych/PII innych niż treść wklejona przez użytkownika.
- Klucze API tylko po stronie serwera (nigdy w kliencie), poprzez zmienne środowiskowe.

### 7.6. Ochrona API i infrastruktury
- CORS ograniczony do zaufanych originów środowiska produkcyjnego.
- Bazowy Content Security Policy (CSP) dopasowany do Astro/React:
    - `default-src 'self'`;
    - `script-src 'self' 'unsafe-inline'` (MVP – do zaostrzenia po stabilizacji);
    - `connect-src 'self' https://*.supabase.co https://api.openrouter.ai`;
    - `img-src 'self' data:`;
    - `style-src 'self' 'unsafe-inline'`;
    - `frame-ancestors 'none'`.
- HTTPS wszędzie (HSTS na warstwie hostingowej po wdrożeniu prod).
- Rate limiting na endpointach generowania AI i zapisów (ochrona kosztów i stabilności).

### 7.7. Logowanie i błędy
- Logi aplikacyjne bez danych wrażliwych i bez treści haseł/tokenów.
- Przy błędach zwracane ogólne komunikaty; szczegóły techniczne tylko w logach serwera.

### 7.8. Zarządzanie zależnościami i CI/CD
- Automatyczne skany podatności (np. `npm audit`/Dependabot) w pipeline CI.
- Zasada least privilege dla sekretów CI/CD (GitHub Actions, DigitalOcean).

### 7.9. Poza MVP (następne kroki)
- Weryfikacja e-mail jako obowiązkowa, 2FA (TOTP/WebAuthn).
- Dokładniejsza polityka haseł (złożoność, wykluczenia najczęstszych haseł, zliczanie reuse).
- Silniejszy CSP bez `unsafe-inline`, raportowanie CSP.
- Audit logi bezpieczeństwa (logins, password changes, account deletions) i alerty anomalii.
