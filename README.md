# Dyflexis Rooster Fetch v1.0.2

Fetch je werkrooster van Dyflexis en geef het terug als JSON.

## Wat doet dit?

* Logt in via PHPSESSID
* Haalt je rooster op
* Parseert werkdagen
* Geeft shifts terug

Hierdoor kan je met Dyflexis bijvoorbeeld automatisch al je werkafspraken in je agenda zetten.

Er komt nog een voorbeeld Shortcut voor Apple.

## Installatie

npm install

Maak een `.env` met de ingevulde inhoud van `.env_example`.
(Als je dit host op bijvoorbeeld Render, zorg ervoor dat je deze online invoert en niet `.env` mee commit!)

### Starten

node server.js

## Endpoints

### `/rooster`

Geeft alle dagen van de huidige maand terug, plus de overlappende dagen van de eerste of laatste week van aangrenzende maanden.
Query parameters (zie onder) kunnen het resultaat filteren of van formaat laten wisselen.

### `/shifts`

Geeft alleen de dagen terug waar "hasassignment": true.
Let op: als je `/shifts` zonder query-parameters aanroept, geeft het endpoint alle shifts terug (alle dagen met een assignment).

## Query parameters

Alle parameters werken zowel op `/rooster` als `/shifts` (waar relevant).
Datumformaten zijn YYYY-MM-DD. De server gebruikt Europe/Amsterdam voor datumvergelijkingen.
Als je geen format query gebruikt wordt alles by default teruggeven als een groot object met daarin objecten.

### `format`


**object**:
{
"2025-12-31": { "date": "2025-12-31", "...": "..." },
"2026-01-02": { "date": "2026-01-02", "...": "..." }
}

**array**:
[
{ "date": "2025-12-31", "...": "..." },
{ "date": "2026-01-02", "...": "..." }
]

### `only`

Voorfilters:

* today → alleen vandaag
* assigned of shifts → alleen dagen met hasassignment: true

### `days`

Aantal komende dagen (inclusief vandaag).
Voorbeeld:
?days=7

### `from` en `to`

Filter tussen twee datums (inclusief).
?from=2025-12-30&to=2026-01-05

### `from + days`

Geeft je het aantal gespecificeerde dagen vanaf een specifieke datum.
?from=2025-12-30&days=7

## Voorbeelden

Alle shifts:
/shifts

Komende 7 dagen als array:
/shifts?days=7&format=array

Alleen shifts van vandaag:
/shifts?only=today

Rooster tussen twee datums:
/rooster?from=2025-12-30&to=2026-01-05

## Wat als de SESSID is verlopen?

Als er geen data wordt teruggegeven, zullen beide endpoints het volgende terugsturen:
{"error":"SESSID VERLOPEN"}

Er wordt nog een oplossing bedacht, omdat de SESSID een van de snelst verlopen, maar ook de enige zichtbare identifier is in de requests van app.planning.nu.
