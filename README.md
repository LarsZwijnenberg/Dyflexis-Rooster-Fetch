# Dyflexis Rooster Fetch Release 1.0

Fetch je werkrooster van Planning.nu en geef het terug als JSON API.

## Wat doet dit?
- Logt in via PHPSESSID
- Haalt je rooster op
- Parseert werkdagen
- Geeft shifts terug

Hierdoor kan je met dyflexis bijvoorbeeld automatisch al je werk afspraken in je agenda zetten. 

Er komt nog een voorbeeld shortcut voor Apple.

## Installatie
```bash
npm install
```

## .env
Maak een `.env` met de ingevulde inhoud van `.env_example`.
(Als je dit host op bijvoorbeeld Render, zorg ervoor dat je deze online invoert en niet `.env` mee commit!!)

## Starten
```bash
node server.js
```

## Endpoints

### /rooster
Geeft alle dagen van de huidige maand terug, plus de overlappende dagen van de eerste of laatste week van aangrenzende maanden.

### /shifts
Geeft alleen de dagen terug waar `"hasassignment": true` is.
