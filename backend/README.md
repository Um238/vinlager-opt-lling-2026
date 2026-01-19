# Backend - CellarCount 2026

Backend API for vinlager optællingssystemet.

## Installation

```bash
npm install
```

## Konfiguration

1. Kopier `.env.example` til `.env`:
```bash
cp .env.example .env
```

2. Rediger `.env` og sæt værdier:
```
PORT=3000
JWT_SECRET=din-hemmelige-nøgle-her
DB_PATH=./data/vinlager.db
NODE_ENV=development
```

## Start Server

```bash
npm start
```

Serveren starter på `http://localhost:3000`

## API Endpoints

### Health Check
- `GET /api/health` - Tjek om server kører

### Vine
- `GET /api/wines` - Hent alle vine (query: ?reol=A&hylde=1)
- `GET /api/wines/:vinId` - Hent specifik vin
- `POST /api/wines` - Opret vin
- `PUT /api/wines/:vinId` - Opdater vin
- `DELETE /api/wines/:vinId` - Slet vin
- `POST /api/wines/:vinId/image` - Upload billede (multipart/form-data)

### Optælling
- `POST /api/count/:vinId` - Opdater antal
  ```json
  {
    "ændring": 1,      // Relativ ændring
    "nytAntal": 25     // Eller direkte antal
  }
  ```
- `GET /api/count/history/:vinId` - Hent optællingshistorik

### Import
- `POST /api/import/csv` - Import CSV (multipart/form-data)
  - Body: `file` (fil), `mode` (overskriv/tilføj/opdater)
- `POST /api/import/excel` - Import Excel (multipart/form-data)
  - Body: `file` (fil), `mode` (overskriv/tilføj/opdater)

### Rapporter
- `GET /api/reports/lager` - Lagerrapport
- `GET /api/reports/værdi` - Værdirapport med total

## Database

SQLite database oprettes automatisk ved første kørsel i `data/vinlager.db`.

### Schema

- **wines:** Alle vine med alle felter
- **counts:** Optællingshistorik
- **users:** Brugere (for senere login)

## Upload

Billeder uploades til `uploads/images/` og serveres statisk på `/uploads/images/`.

Max filstørrelse: 5MB

## CORS

CORS er aktiveret for alle origins (kan begrænses i produktion).

## Deployment til Cloud

Se hoved README eller GITHUB_DEPLOYMENT.md for instruktioner.
