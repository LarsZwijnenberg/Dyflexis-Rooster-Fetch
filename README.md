# Dyflexis Rooster Fetch v1.5.0

Dit project stelt je in staat om je rooster op te halen van Dyflexis (app.planning.nu) via een eenvoudige API met automatische login.

**Apple Shortcut URL:**  
https://www.icloud.com/shortcuts/d72d53c003e54924981c1f69653c0d1f

## Wat is er nieuw in v1.5.0?

*   **Automatische login:** Geen handmatige PHPSESSID meer nodig! De API logt automatisch in met je credentials.
*   **CSRF token detectie:** Automatische extractie van authentication tokens.
*   **Uitgebreide logging:** Zie precies wat er gebeurt tijdens het login- en ophaalproces.

## Wat doet dit?

*   **Automatisch inloggen:** Logt in met je email en wachtwoord.
*   **Sessie beheer:** Haalt automatisch de PHPSESSID op na login.
*   **Ophalen:** Haalt je rooster op van Dyflexis (`app.planning.nu`).
*   **Parseren:** Verwerkt werkdagen en assignments.
*   **Exporteren:** Geeft shifts terug in meerdere formaten, inclusief een platte string die geoptimaliseerd is voor Apple Shortcuts.

## Installatie

1.  Installeer de afhankelijkheden:
```bash
    npm install
```
2.  Configureer de omgevingsvariabelen:
    Vul `.env_example` in en hernoem het bestand naar `.env`:
    **Let op:** 
    - Vervang `systeemnaam` door je Dyflexis systeemnaam
    - Vervang `locatie` door je locatienaam
    
3.  Start de server:
```bash
    node server.js
```

## Gebruik

### Starten
```bash
node server.js
```

De API logt automatisch in bij elke request en haalt de benodigde sessie op.

### Belangrijke Endpoints

#### `/rooster`
Geeft alle dagen van de huidige maand terug, inclusief overlappende dagen van aangrenzende maanden. Ondersteunt query parameters voor filtering en verschillende responsformaten.

#### `/shifts`
Geeft alleen de dagen terug waar `hasassignment: true` is. Zonder query parameters geeft dit endpoint alle beschikbare shifts terug.

### Query Parameters
Deze parameters werken op zowel `/rooster` als `/shifts`:

| Parameter | Opties | Beschrijving |
| :--- | :--- | :--- |
| `format` | `object` (default), `array`, `string` | Hiermee bepaal je in welk formaat je de data krijgt. |
| `only` | `today`, `assigned`, `shifts` | Filtert de resultaten op specifieke types. |
| `days` | Getal (bijv. `7`) | Aantal komende dagen vanaf vandaag. |
| `from` | `YYYY-MM-DD` | Startdatum voor filtering. |
| `to` | `YYYY-MM-DD` | Einddatum voor filtering. |

**Voorbeeld:** `?from=2025-12-30&days=7` haalt 7 dagen op vanaf de opgegeven datum.

---

## String-formaat

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

> Apple Shortcut link direct: https://www.icloud.com/shortcuts/d72d53c003e54924981c1f69653c0d1f

---

## Voorbeelden van Requests

*   **Alle shifts (object):** `/shifts`
*   **Alle shifts (array):** `/shifts?format=array`
*   **Alle shifts (string):** `/shifts?format=string`
*   **Komende 7 dagen (array):** `/shifts?days=7&format=array`
*   **Alleen vandaag:** `/shifts?only=today`

## Foutafhandeling

Mogelijke errors die de API kan teruggeven:

*   **Login mislukt:**
```json
    {"error": "LOGIN_FAILED", "message": "Login page returned. Check credentials or 2FA."}
```
*   **Geen data:**
```json
    {"error": "NO_DATA", "message": "No days parsed from page"}
```
*   **Configuratie fout:**
```json
    {"error": "Missing EMAIL or PASSWORD in .env"}
```

## Technische Details

*   **Timezone:** De server gebruikt `Europe/Amsterdam` voor alle datumvergelijkingen.
*   **Automatische sessie:** De PHPSESSID wordt automatisch opgehaald en gebruikt per request.
*   **CSRF bescherming:** De API haalt automatisch het authentication-csrf-token op en stuurt dit mee.