# Dyflexis Rooster Fetch v1.2.0

Dit project stelt je in staat om je rooster op te halen van Dyflexis (app.planning.nu) via een eenvoudige API.

## Wat doet dit?

*   **Inloggen:** Logt in via een `PHPSESSID`.
*   **Ophalen:** Haalt je rooster op van `app.planning.nu`.
*   **Parseren:** Verwerkt werkdagen en assignments.
*   **Exporteren:** Geeft shifts terug in meerdere formaten, inclusief een platte string die geoptimaliseerd is voor Apple Shortcuts.

## Installatie

1.  Installeer de afhankelijkheden:
    ```bash
    npm install
    ```
2.  Configureer de omgevingsvariabelen:
    Vul `.env_example` in en hernoem het bestand naar `.env`.
3.  Start de server:
    ```bash
    node server.js
    ```

## Gebruik

### Starten
```bash
node server.js
```

### Belangrijke Endpoints

#### `/rooster`
Geeft alle dagen van de huidige maand terug, inclusief overlappende dagen van aangrenzende maanden. Ondersteunt query parameters voor filtering en verschillende responsformaten.

#### `/shifts`
Geeft alleen de dagen terug waar `hasassignment: true` is. Zonder query parameters geeft dit endpoint alle beschikbare shifts terug.

### Query Parameters
Deze parameters werken op zowel `/rooster` als `/shifts`:

| Parameter | Opties | Beschrijving |
| :--- | :--- | :--- |
| `format` | `object` (default), `array`, `string` |
| `only` | `today`, `assigned`, `shifts` | Filtert de resultaten op specifieke types. |
| `days` | Getal (bijv. `7`) | Aantal komende dagen vanaf vandaag. |
| `from` | `YYYY-MM-DD` | Startdatum voor filtering. |
| `to` | `YYYY-MM-DD` | Einddatum voor filtering. |

**Voorbeeld:** `?from=2025-12-30&days=7` haalt 7 dagen op vanaf de opgegeven datum.

---

## Nieuw: String-formaat (v1.1.0)

Wanneer je `?format=string` gebruikt op `/shifts` of `/rooster`, ontvang je een platte tekststring. Dit is ideaal voor automatiseringstools zoals Apple Shortcuts.

### Regels voor het string-formaat:
*   **Datum en tijd:** Gescheiden door een komma (`,`).
*   **Dagen:** Gescheiden door een pipe (`|`).
*   **Meerdere assignments:** Tijden volgen na de datum, elk gescheiden door een komma.
*   **Opschoning:** Tijden worden ontdaan van spaties en speciale tekens.
*   **Geen tijd:** Als een assignment geen tijd heeft, verschijnt alleen de datum.
*   **Formaat:** Datum is `YYYY-MM-DD`, tijd is zoals op de site (bijv. `08:30-12:45`).

### Voorbeelden:
*   **Eén dag, één shift:** `2025-12-31,08:30-12:45`
*   **Meerdere dagen:** `2025-12-31,08:30-12:45|2026-01-02,16:00-20:00`
*   **Dag met meerdere assignments:** `2026-01-03,08:00-12:00,13:00-17:00`

---

## Gebruik in Apple Shortcuts

1.  Maak een **URL-actie** naar je server: `https://jouwhost.nl/shifts?format=string`
2.  Haal de tekst op en splits deze op de pipe (`|`) om de individuele dagen te krijgen.
3.  Splits elke dag op de komma (`,`); het eerste element is de datum, de rest zijn de tijdsblokken.

> Er wordt binnenkort een voorbeeldshortcut toegevoegd aan dit project.

---

## Voorbeelden van Requests

*   **Alle shifts (object):** `/shifts`
*   **Alle shifts (array):** `/shifts?format=array`
*   **Alle shifts (string):** `/shifts?format=string`
*   **Komende 7 dagen (array):** `/shifts?days=7&format=array`
*   **Alleen vandaag:** `/shifts?only=today`

## Foutafhandeling

Als de sessie is verlopen of er geen data kan worden opgehaald, retourneert de API:
```json
{"error": "SESSID VERLOPEN"}
```

## Technische Details

*   **Timezone:** De server gebruikt `Europe/Amsterdam` voor alle datumvergelijkingen.
*   **Sessie:** Zorg ervoor dat je `PHPSESSID` en `HEADERPATH` in je `.env` bestand up-to-date zijn.
