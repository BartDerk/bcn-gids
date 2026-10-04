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

- `BCN.csv` → "Te zien" (bezienswaardigheden; ook de lijst voor gast)
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

## Kiespagina voor gast (`kiezen.html`)

Lichte losse pagina (geen service worker, niet offline, wel `noindex`) voor gast. Ze opent de link in Safari, ziet alleen de BCN-lijst (`list="bcn"`) met foto (tik = groter), naam, wijk en uitleg, en een kaart om te zien wat bij elkaar ligt. Per plaats is er één knop: **Wil ik langs fietsen**. Ze kan zoeken (zonder accenten) en filteren op soort en wijk. Haar keuzes staan alleen in haar browser (`localStorage`, sleutel `gastKies`).

- **Stuur naar Bart** opent WhatsApp (`wa.me/?text=`) met een leesbaar bericht plus een code (`BCN1-...`); **Kopieer** doet hetzelfde naar het klembord.
- De code (`js/gastcode.js`) bestaat uit per plaats 4 tekens (hash van het `id`), dus hij klopt ook als `places.json` later verandert. Onbekende plaatsen worden bij het importeren geteld en overgeslagen.
- In de hoofdapp, tab *Te bezoeken*: **Importeer van gast** (plak bericht of code). Haar keuzes staan apart in `bcnGast`, met paarse rand en "G" op de kaart, een paarse streep in de lijst en een filter **gast**. Ze komen niet automatisch op je fietslijstje (`bcnCand`): bekijk ze samen en zet per plaats zelf 🚲 *Voor fietsroute*. Een nieuwe import vervangt haar vorige keuzes; jouw ★, fietslijstje en route blijven staan. **✕ Wis gast** (zichtbaar zodra er gast-keuzes zijn) wist alleen haar keuzes.
- **Deel met gast** opent het deelmenu van de gsm met de link naar `kiezen.html` (of kopieert hem).
- De kaart op `kiezen.html` heeft internet nodig voor de kaarttegels.

## Fietsroute

Tab *Fietsen*: tik op een plaats (kleine stip) en kies **+ Stop n**. De stops krijgen nummers en een stippellijn in vogelvlucht; de afstand is een schatting (vogelvlucht × 1,3).
Met **Ongedaan** haal je de laatste stop weg, met **Wissen** de hele route, met **Stops** pas je de volgorde aan, met **Rondrit** keer je terug naar de start.
**Open in Google Maps** opent de route met `travelmode=bicycling`. Google staat maximaal 9 tussenpunten per route toe: bij meer stops komen er knoppen "Deel 1, Deel 2, …".
Je route wordt alleen op je eigen toestel bewaard. Ook de knop 🚲 *Fietsroute* in het kaartje van "Te bezoeken" voegt een stop toe.

**Lijstje en route zijn gescheiden:** met 🚲 *Voor fietsroute* in het kaartje van *Te bezoeken* (of **Markeren** op de fietskaart) zet je een plaats op je fietslijstje. Op de fietskaart zijn dat blauwe bollen. Daaruit kies je de stops van de route. **Wissen** wist alleen de route, je blauwe bollen blijven.

## Onderweg

- **📍 Nu in de buurt** (Te bezoeken): vraagt je locatie en toont alleen plaatsen binnen 1 km, dichtstbij eerst (`NEAR_KM` in `js/places.js`).
- **🔊 Catalaans / 🔊 Español** in het groot-scherm van zinnen en tapas: de stem van de gsm leest voor (offline). Heeft het toestel geen Catalaanse stem, dan leest de Spaanse stem het.
- **📷 Menu scannen (proef)** bij Tapas: foto van de kaart, tekst wordt herkend met Tesseract.js (wordt van internet geladen, werkt dus niet offline) en de tapa-lijst filtert op de herkende gerechten. Regels die niet in de lijst staan komen onder "Niet in de lijst" met *Toon* en *Vertaal* (Google Vertalen).
