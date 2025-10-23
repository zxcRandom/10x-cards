# Plan implementacji widoku Polityka prywatności

## 1. Przegląd
Widok „Polityka prywatności" to statyczna strona informacyjna prezentująca użytkownikom informacje o przetwarzaniu ich danych osobowych, w szczególności o przesyłaniu tekstów wprowadzanych do generatora fiszek AI do zewnętrznego dostawcy (OpenRouter/Gemini). Jest to wymóg MVP określony w PRD 3.6. Widok dostępny jest publicznie (bez wymogu logowania) i linkowany z generatora AI oraz stopki aplikacji.

## 2. Routing widoku
- Ścieżka: `/privacy-policy`
- Plik strony: `src/pages/privacy-policy.astro`
- Architektura: strona statyczna Astro (brak komponentów React), prosty layout z czystym tekstem i podstawowym formatowaniem.

## 3. Struktura komponentów
- `src/pages/privacy-policy.astro`
  - używa `Layout.astro` (główny layout aplikacji)
  - zawiera statyczną treść HTML z sekcjami polityki
  - opcjonalnie: komponent `Card` z Shadcn/ui dla czytelniejszego layoutu
  - przycisk/link „Powrót" do poprzedniej strony lub Dashboard

## 4. Szczegóły komponentów
### Privacy Policy page (`privacy-policy.astro`)
- Opis: Statyczna strona z treścią polityki prywatności, sformatowana w czytelny sposób z użyciem nagłówków, list i akapitów.
- Główne elementy:
  - Nagłówek strony: „Polityka prywatności"
  - Sekcje treści (szczegóły w sekcji 8):
    - Wprowadzenie
    - Dane zbierane przez aplikację
    - Przetwarzanie przez AI
    - Przechowywanie danych
    - Prawa użytkownika (RODO)
    - Dane kontaktowe
  - Stopka z datą ostatniej aktualizacji
  - Link/przycisk nawigacyjny „Powrót"
- Interakcje: brak (statyczna treść), jedynie nawigacja „Powrót"
- Walidacja: brak
- Typy: brak (statyczna strona)
- Propsy: brak

### Opcjonalny komponent `BackButton`
- Opis: Komponent nawigacyjny umożliwiający powrót do poprzedniej strony lub Dashboard.
- Główne elementy: `Button` (Shadcn/ui) lub prosty link `<a>`
- Interakcje: kliknięcie przenosi do Dashboard (`/`) lub poprzedniej strony (`history.back()`)
- Walidacja: brak
- Typy: brak
- Propsy: `{ label?: string; href?: string }`

## 5. Typy
Brak dedykowanych typów – strona jest statyczna i nie wymaga DTOs ani ViewModels.

## 6. Zarządzanie stanem
Brak zarządzania stanem – strona jest w pełni statyczna, renderowana po stronie serwera (SSR/SSG przez Astro).

## 7. Integracja API
Brak integracji z API – treść jest zakodowana na stałe w pliku `.astro`.

## 8. Treść widoku
Zgodnie z PRD 3.6, polityka prywatności musi zawierać informację o przesyłaniu danych tekstowych do dostawcy AI. Minimalna treść dla MVP:

### Struktura treści:
1. **Wprowadzenie**
   - Krótki opis, jakie dane zbiera i przetwarza aplikacja 10x-cards
   - Zobowiązanie do ochrony prywatności użytkowników

2. **Dane zbierane przez aplikację**
   - Dane konta: adres e-mail, hasło (zaszyfrowane)
   - Dane użytkowe: talie fiszek, fiszki, postępy w nauce
   - Dane sesyjne: tokeny uwierzytelniania

3. **Przetwarzanie przez AI (kluczowa sekcja)**
   - Jasna informacja: „Teksty wklejane do generatora fiszek AI są przesyłane do zewnętrznego dostawcy AI (OpenRouter/modele Gemini) w celu wygenerowania fiszek."
   - Zastrzeżenie: „Nie przesyłamy Twoich danych osobowych (e-mail, hasło) do dostawcy AI."
   - Informacja o przetwarzaniu: „Dostawca AI może tymczasowo przetwarzać tekst w celu wygenerowania odpowiedzi. Szczegóły przetwarzania określa polityka prywatności dostawcy AI."
   - Link do polityki OpenRouter/Gemini (opcjonalnie)

4. **Przechowywanie danych**
   - Baza danych (Supabase): fiszki, talie, dane konta
   - Okres przechowywania: do czasu usunięcia konta przez użytkownika
   - Bezpieczeństwo: szyfrowanie haseł, bezpieczne połączenia HTTPS

5. **Prawa użytkownika (RODO)**
   - Prawo dostępu do danych
   - Prawo do usunięcia danych (opcja w ustawieniach konta)
   - Prawo do przenoszenia danych (opcjonalnie w przyszłości)

6. **Dane kontaktowe**
   - Adres e-mail do kontaktu w sprawach prywatności (np. privacy@10x-cards.app)

7. **Data ostatniej aktualizacji**
   - Wyświetlana na dole strony (np. „Ostatnia aktualizacja: 23 października 2025")

### Ton komunikacji:
- Prosty, zrozumiały język (unikanie żargonu prawniczego)
- Skupienie na najważniejszych informacjach dla użytkownika
- Transparentność w kwestii AI

## 9. Dostępność i UX
- Semantyczny HTML: użycie `<h1>`, `<h2>`, `<h3>` dla nagłówków, `<p>` dla akapitów, `<ul>`/`<ol>` dla list
- Kontrast tekstu: wysoki kontrast dla czytelności
- Responsywność: tekst musi być czytelny na urządzeniach mobilnych
- Szerokość kolumny: max 65–75 znaków na linię dla lepszej czytelności (użycie `max-w-prose` z Tailwind)
- Padding/margin: odpowiednie odstępy między sekcjami
- Link „Powrót": wyraźnie widoczny na początku i/lub końcu strony
- Fokus: dostępny dla użytkowników klawiatury

## 10. Linkowanie do polityki prywatności
Zgodnie z sekcją 7 w `ui-plan.md`, link do polityki prywatności musi być dostępny:
- **W generatorze AI (Dashboard)**: informacja obok pola tekstowego: „Treść jest wysyłana do dostawcy AI w celu przetworzenia. [Polityka prywatności](/privacy-policy)"
- **W stopce aplikacji**: stały link „Polityka prywatności" w głównym layoutzie
- Opcjonalnie: w procesie rejestracji (checkbox „Akceptuję politykę prywatności")

## 11. Kroki implementacji
1. Utwórz plik `src/pages/privacy-policy.astro`
2. Dodaj podstawową strukturę strony z użyciem `Layout.astro`:
   - Tytuł strony: `<title>Polityka prywatności - 10x-cards</title>`
   - Meta description dla SEO
3. Dodaj treść polityki prywatności według struktury z sekcji 8:
   - Nagłówek `<h1>Polityka prywatności</h1>`
   - Sekcje z nagłówkami `<h2>` i treścią w `<p>`, `<ul>`, `<ol>`
4. Zastosuj stylowanie Tailwind:
   - Kontener: `max-w-prose mx-auto px-4 py-8`
   - Nagłówki: odpowiednie wielkości i marginesy
   - Akapity: `mb-4` dla odstępów
   - Listy: `list-disc ml-6 mb-4`
5. Dodaj komponent/link „Powrót":
   - Na początku strony: breadcrumb lub prosty link
   - Na końcu strony: przycisk `Button` z Shadcn/ui
6. (Opcjonalnie) Opakuj treść w `Card` dla lepszej wizualnej separacji
7. Dodaj link do polityki prywatności w stopce aplikacji (`Layout.astro`):
   - `<footer>` z linkiem `<a href="/privacy-policy">Polityka prywatności</a>`
8. Dodaj informację i link w widoku Dashboard (generator AI):
   - Pod polem tekstowym: mały tekst z linkiem do `/privacy-policy`
9. Testowanie:
   - Sprawdź czytelność na różnych rozmiarach ekranu (mobile, tablet, desktop)
   - Weryfikuj dostępność (semantyczny HTML, nawigacja klawiaturą)
   - Sprawdź poprawność linków
10. (Opcjonalnie) Dodaj checkbox akceptacji polityki w formularzu rejestracji:
    - Wymaga rozszerzenia `register.astro` i walidacji po stronie backendu

Uwagi implementacyjne zgodnie z projektem:
- Używaj Astro do renderowania statycznej treści (brak React).
- Stylowanie Tailwind 4 (klasy narzędziowe), spójne z resztą aplikacji.
- Treść prosta i zrozumiała, zgodna z wymaganiami RODO w minimalnym zakresie dla MVP.
- Brak skomplikowanej logiki – to czysta strona informacyjna.
