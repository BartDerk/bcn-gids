# Barcelona reisgids (PWA)

Offline reisapp voor een gsm: **Zinnen** (Catalaans/Spaans), **Tapas**, **Te bezoeken** (kaart + lijst) en straks **Fietsroutes**.
Statische site zonder build-stap. Leaflet staat lokaal in `lib/`.

## Lokaal testen

```powershell
.\serve.ps1
```

Open daarna <http://localhost:8080>. (`localhost` mag een service worker gebruiken; een los bestand openen werkt niet.)

## Wat staat waar

| Pad | Inhoud |
|---|---|
| `index.html`, `css/`, `js/` | de app (`js/app.js` = start, tapas, zinnen; `js/places.js` = kaart en lijst) |
| `data/tapas.json`, `data/phrases.json` | tapas en zinnen |
| `data/places.json` | **gegenereerd**, de plaatsen voor de kaart (niet met de hand bewerken) |
| `data/coords.json` | coördinaten + adres + wijk per plaats |
| `data/curated.json` | categorie, uitleg en Wikipedia-titel (voor de foto) per plaats |
| `data/photos.json`, `photos/` | foto's van Wikimedia Commons met bronvermelding |
| `ToVisit/*.csv` | je Google Maps-lijsten (zie hieronder) |
| `sw.js` | service worker (offline) |
| `tools/` | scripts voor de gegevens |

## De lijsten in `ToVisit` aanpassen

De app leest de drie exports uit Google Maps:

- `BCN.csv` → "Te zien" (bezienswaardigheden; ook de lijst voor md)
- `BCN Bar.csv` → bars
- `BCN shop.csv` → shops

Een export heeft geen coördinaten. Daarom staan die apart in `data/coords.json`.

1. Vervang de CSV's in `ToVisit` door de nieuwe exports (zelfde formaat).
2. Draai:

   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\build-places.ps1
   ```

   Het script toont:
   - **ZONDER COORDINATEN**: nieuwe plaatsen. Zet `lat`/`lng`/`address`/`district` voor die plaats in `data\coords.json`
     (kopieer `!3d<lat>!4d<lng>` uit de Google Maps-URL nadat je de plaats geopend hebt), of laat het aan Claude over.
   - **Zonder uitleg/categorie**: voeg een regel toe in `data\curated.json`:
     `"Naam": {"cat": "gebouw", "desc": "korte uitleg", "wiki": "en:Artikel_op_Wikipedia"}`.
     Wil je een bepaalde gevelfoto? Zet dan `"file": "Naam van het bestand.jpg"` (uit Wikimedia Commons) in dat veld.
     Categorieën: `gebouw`, `museum`, `park`, `markt`, `uitzicht`, `straat`, `fiets`, `overig`.
3. Foto's ophalen voor nieuwe plaatsen met een `wiki`-veld:

   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\fetch-photos.ps1
   ```

   Voer daarna `tools\shrink-photos.ps1` uit (maakt de foto's klein) en draai nog eens `build-places.ps1`. Heeft een plaats geen vrije foto, dan blijft het bij het icoon.
4. Zet in `sw.js` het getal bij `VERSION` hoger (bijvoorbeeld `v3` → `v4`), anders merkt de gsm de update niet.

## Online zetten (GitHub Pages)

```powershell
git add -A
git commit -m "Update"
git push
```

Pages staat aan op de `main`-branch, map `/ (root)`. Na een minuut staat de nieuwe versie online. Op de gsm verschijnt bij de volgende start "Nieuwe versie beschikbaar – herladen".

## Installeren

- **Android (Chrome):** open de link, menu ⋮ → *App installeren* of *Toevoegen aan startscherm*.
- **iPhone (Safari):** deelknop → *Zet op beginscherm*.

Open de app vóór vertrek één keer met internet, bekijk de kaart (zodat de kaarttegels in de cache komen) en test het daarna met vliegtuigmodus.

## Opslag en privacy

- ★ en "bezocht" staan alleen in de browser van je eigen toestel (`localStorage`).
- De repo is publiek maar bevat geen adres van de logeerplek en geen persoonlijke gegevens. De pagina heeft `noindex`.
- Foto's: Wikimedia Commons, met bronvermelding in de app.
