```mermaid
stateDiagram-v2
    direction LR
    classDef decision fill:#F9B428,stroke:#000,stroke-width:2px,color:#000

    [*] --> Niezalogowany

    state Niezalogowany {
        [*] --> PrzegladanieStronPublicznych
        PrzegladanieStronPublicznych --> Logowanie: Klika "Zaloguj"
        PrzegladanieStronPublicznych --> Rejestracja: Klika "Zarejestruj"

        note right of PrzegladanieStronPublicznych
            Użytkownik na stronie głównej
            lub innej stronie publicznej.
        end note
    }

    state Logowanie {
        [*] --> FormularzLogowania
        FormularzLogowania --> WalidacjaDanych: Wprowadza dane
        WalidacjaDanych --> if_dane_poprawne <<choice>>
        if_dane_poprawne --> Zalogowany: Dane poprawne
        if_dane_poprawne --> FormularzLogowania: Dane błędne
        FormularzLogowania --> OdzyskiwanieHasla: Klika "Zapomniałem hasła"
    }

    state Rejestracja {
        [*] --> FormularzRejestracji
        FormularzRejestracji --> WalidacjaRejestracji: Wprowadza dane
        WalidacjaRejestracji --> if_email_zajety <<choice>>
        if_email_zajety --> Zalogowany: Email wolny (auto-logowanie)
        if_email_zajety --> FormularzRejestracji: Email zajęty
    }

    state OdzyskiwanieHasla {
        [*] --> FormularzProsbyOReset
        FormularzProsbyOReset --> OczekiwanieNaEmail: Wprowadza email
        OczekiwanieNaEmail --> FormularzNowegoHasla: Klika link w emailu
        FormularzNowegoHasla --> if_token_poprawny <<choice>>
        if_token_poprawny --> Logowanie: Hasło zmienione
        if_token_poprawny --> FormularzProsbyOReset: Link wygasł/błędny
    }

    state Zalogowany {
        [*] --> PanelAplikacji
        PanelAplikacji: Użytkownik korzysta z aplikacji
        PanelAplikacji --> UstawieniaKonta: Klika "Ustawienia"
        PanelAplikacji --> Niezalogowany: Klika "Wyloguj"
    }

    state UstawieniaKonta {
        [*] --> ZmianaHasla
        ZmianaHasla --> PanelAplikacji: Hasło zmienione
        ZmianaHasla --> ZmianaHasla: Błąd (np. stare hasło niepoprawne)
        [*] --> UsuwanieKonta
        UsuwanieKonta --> Niezalogowany: Konto usunięte
    }

```
