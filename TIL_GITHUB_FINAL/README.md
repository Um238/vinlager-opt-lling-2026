# CellarCount 2026 - Vinlager Optælling

Et professionelt vinlager optællingssystem med QR-kode scanning, import, labels og rapporter.

## Funktioner

- ✅ 100% dansk UI og felter
- ✅ QR-kode scanning og optælling (+1/-1)
- ✅ CSV/Excel import med 3 modes (overskriv/tilføj/opdater)
- ✅ Lageroversigt med filtrering (reol/hylde)
- ✅ Labels/print med QR-koder
- ✅ PDF rapporter (lager og værdi)
- ✅ Samlet lagerværdi beregning (kr. og øre)
- ✅ Billede upload til vine
- ✅ Optællingshistorik

## Teknologi

- **Backend:** Node.js, Express, SQLite
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **QR-koder:** QRCode.js
- **PDF:** jsPDF
- **Import:** xlsx for Excel, native CSV parsing

## Hurtig Start

### 1. Installer Backend Dependencies

```bash
cd backend
npm install
```

### 2. Opret .env fil

```bash
cp .env.example .env
```

Rediger `.env` og sæt:
```
PORT=3000
JWT_SECRET=din-hemmelige-nøgle-her
DB_PATH=./data/vinlager.db
```

### 3. Start Backend

```bash
npm start
```

Backend kører nu på `http://localhost:3000`

### 4. Start Frontend

**Lokalt:**
- Åbn `index.html` i en browser (i root eller frontend mappen)
- Eller brug en lokal webserver (fx Live Server i VS Code)

**GitHub Pages:**
- Se [GITHUB_DEPLOYMENT.md](GITHUB_DEPLOYMENT.md) for instruktioner

## Datamodel

Hver vin har følgende felter:

```json
{
  "vinId": "VIN-0001",           // Unik ID (brugt til QR)
  "varenummer": "123456",        // Varenummer
  "navn": "Château Margaux",
  "type": "Rødvin",
  "kategori": "Rødvin",
  "land": "Frankrig",
  "region": "Bordeaux",
  "drue": "Cabernet Sauvignon",
  "årgang": 2019,
  "reol": "A",
  "hylde": "2",
  "antal": 24,
  "minAntal": 6,
  "indkøbspris": 1250.00,
  "billede": "/uploads/images/wine-123.jpg",
  "oprettet": "2026-01-01"
}
```

## Import

### CSV Format
CSV filer skal bruge semikolon (`;`) som separator.

### Excel Format
Excel filer (.xlsx) understøttes også.

### Import Modes

1. **Overskriv:** Sletter hele lageret og importerer nyt
2. **Tilføj:** Tilføjer kun nye vine (springer eksisterende over)
3. **Opdater:** Opdaterer eksisterende vine baseret på vinId

### Skabelon

Se `skabelon/vinlager_skabelon.csv` for eksempel med 65 realistiske vine.

## API Endpoints

- `GET /api/wines` - Hent alle vine
- `GET /api/wines/:vinId` - Hent specifik vin
- `POST /api/wines` - Opret vin
- `PUT /api/wines/:vinId` - Opdater vin
- `DELETE /api/wines/:vinId` - Slet vin
- `POST /api/count/:vinId` - Opdater antal (optælling)
- `POST /api/import/csv` - Import CSV
- `POST /api/import/excel` - Import Excel
- `GET /api/reports/lager` - Lagerrapport
- `GET /api/reports/værdi` - Værdirapport

## Projektstruktur

```
vinlager-optælling-2026/
├── index.html          # Frontend (root - for GitHub Pages)
├── app.js              # Frontend JavaScript
├── config.js           # Backend URL konfiguration
├── styles.css          # Styling
├── backend/
│   ├── src/
│   │   ├── config/      # Database konfiguration
│   │   ├── routes/      # API routes
│   │   ├── controllers/ # Request handlers
│   │   └── utils/       # Hjælpefunktioner
│   ├── uploads/         # Uploadede billeder
│   ├── data/            # SQLite database
│   └── package.json
├── frontend/            # Frontend filer (også i root)
│   ├── index.html
│   ├── app.js
│   ├── config.js
│   └── styles.css
├── skabelon/
│   └── vinlager_skabelon.csv
└── README.md
```

## Deployment

### Lokalt (Nu)
- Backend kører lokalt på din PC
- Frontend kan køre lokalt eller via GitHub Pages

### Cloud (Senere)
- Backend kan flyttes til Render/Railway/Heroku
- Frontend peger på ny backend URL (kun konfiguration)

Se [GITHUB_DEPLOYMENT.md](GITHUB_DEPLOYMENT.md) for detaljerede instruktioner.

## Konfiguration

### Backend URL

Rediger `config.js` (root) eller `frontend/config.js` for at ændre backend URL:

```javascript
const CONFIG = {
  API_URL: 'http://localhost:3000',  // Lokal
  // API_URL: 'https://din-backend-url.herokuapp.com',  // Cloud
};
```

## Licens

Privat projekt
