# TIL GITHUB - Version v24

## 📁 Filer til upload til GitHub

Denne mappe indeholder alle de opdaterede filer der skal uploades til GitHub Pages.

### ✅ Filer i denne mappe:

1. **index.html** - Hoved HTML fil (Version v24)
2. **app.js** - JavaScript funktionalitet (Version v24)
3. **styles.css** - CSS styling (Version v18)
4. **config.js** - Konfiguration fil

### 📋 Nye features i v24:

- ✅ Dansk prisformatering (138.840,00 kr.)
- ✅ Klikbare statistikker på Dashboard (Antal vine / Lavt lager)
- ✅ Modal popup med vine oversigt
- ✅ Autocomplete dropdown til søgning
- ✅ Rettet rapportfiltrering (Denne måned / Sidste måned)
- ✅ "Lav status rapport" knap (genererer rapport uden at vise)
- ✅ Rettet dato parsing for månedfilter
- ✅ Editable pris og minimum antal i lager tabellen
- ✅ Billede upload/visning i lager tabel
- ✅ QR-kode scanning med autocomplete

### 🚀 Upload instruktioner:

1. Upload alle 4 filer til dit GitHub repository
2. Sørg for at filerne er i root mappen eller i samme mappe struktur
3. `config.js` skal være i samme mappe som `index.html`
4. Efter upload, tjek at GitHub Pages er aktiveret og peger på `index.html`

### ⚠️ Vigtigt:

- Backend skal køre på `http://localhost:3000` (eller ændr i `config.js`)
- Alle filer skal være i samme mappe for at links virker
- Test lokalt først ved at åbne `index.html` i browser

### 📝 Noter:

- Version v24 indeholder alle seneste opdateringer
- Alle cache-busting mekanismer er inkluderet
- Autocomplete fungerer med VIN-ID, varenummer og navn
