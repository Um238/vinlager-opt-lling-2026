# GitHub Deployment Guide - CellarCount 2026

Denne guide forklarer hvordan du uploader og deployer CellarCount 2026 på GitHub.

## 📋 Forudsætninger

- GitHub konto (gratis)
- Git installeret på din PC
- Node.js installeret (for backend)

## 🚀 Trin 1: Opret GitHub Repository

1. Gå til [github.com](https://github.com) og log ind
2. Klik på **"+"** → **"New repository"**
3. Navn: `vinlager-optaelling-2026` (eller dit foretrukne navn)
4. Beskrivelse: `Vinlager optællingssystem med QR-kode scanning`
5. Vælg **Public** eller **Private** (private er gratis for personlige projekter)
6. **IKKE** tjek "Initialize with README" (vi har allerede filer)
7. Klik **"Create repository"**

## 📁 Trin 2: Upload Filer til GitHub

### Metode A: Via GitHub Web Interface (Nemmest)

1. **I dit nye repository på GitHub:**
   - Klik på **"uploading an existing file"** (eller "Add file" → "Upload files")

2. **Upload alle filer fra `TIL_GITHUB_FINAL` mappen:**
   - **Drag & drop** hele `TIL_GITHUB_FINAL` mappen ind i browser vinduet
   - ELLER klik **"choose your files"** og vælg alle filer

3. **Commit:**
   - Skriv commit besked: `Initial commit - CellarCount 2026`
   - Klik **"Commit changes"**

### Metode B: Via Git (Hvis du har Git installeret)

1. **Naviger til TIL_GITHUB_FINAL mappen:**
   ```bash
   cd "C:\Users\Uffe Mikkelsen\OneDrive\Skrivebord\køkkenlager\vinlager\vinlager-optælling-2026\TIL_GITHUB_FINAL"
   ```

2. **Initialiser Git:**
   ```bash
   git init
   ```

3. **Tilføj alle filer:**
   ```bash
   git add .
   ```

4. **Commit:**
   ```bash
   git commit -m "Initial commit - CellarCount 2026"
   ```

5. **Forbind til GitHub:**
   ```bash
   git remote add origin https://github.com/DIT-BRUGERNAVN/DIT-REPO-NAVN.git
   git branch -M main
   git push -u origin main
   ```

## 🌐 Trin 3: Deploy Frontend til GitHub Pages

### 3.1. Gå til Repository Settings

1. I dit GitHub repository, klik på **"Settings"** (øverst)
2. Scroll ned til **"Pages"** i venstre menu

### 3.2. Konfigurer GitHub Pages

1. Under **"Build and deployment"**:
   - **Source:** Vælg **"Deploy from a branch"**
   - **Branch:** Vælg **`main`** (eller `master`)
   - **Folder:** Hvis der er en dropdown, vælg **`/` (root)** - da vi har `index.html` i root
   - Hvis der IKKE er en folder dropdown, det er OK - GitHub Pages vil automatisk finde `index.html` i root

2. Klik **"Save"**

### 3.3. Vent på deployment

- GitHub vil nu deploye din frontend
- Det tager ca. 1-2 minutter
- Din frontend vil være tilgængelig på:
  ```
  https://DIT-BRUGERNAVN.github.io/DIT-REPO-NAVN/
  ```

**Eksempel:**
```
https://um238.github.io/vinlager-optaelling-2026/
```

## ⚙️ Trin 4: Opdater Backend URL i Frontend

### 4.1. Rediger config.js

Da frontend filerne også ligger i root, skal du opdatere både:
- `config.js` (i root)
- `frontend/config.js`

Men da de er identiske, kan du bare opdatere begge.

**For lokal brug:**
```javascript
const CONFIG = {
  API_URL: 'http://localhost:3000',
  TIMEOUT: 10000
};
```

**Når backend er i cloud:**
```javascript
const CONFIG = {
  API_URL: 'https://din-backend-url.herokuapp.com',
  TIMEOUT: 10000
};
```

## 🔧 Trin 5: Backend Kører Lokalt

### 5.1. Start Backend

```bash
cd backend
npm install
npm start
```

Backend kører nu på `http://localhost:3000`

### 5.2. Brug Frontend

- **Lokalt:** Åbn `index.html` i browser (fra TIL_GITHUB_FINAL eller efter download fra GitHub)
- **GitHub Pages:** Gå til din GitHub Pages URL (frontend vil IKKE kunne kalde lokal backend pga. CORS)

## ☁️ Trin 6: Flyt Backend til Cloud (Senere)

Når du er klar til at flytte backend til cloud:

### Option A: Render (Anbefalet - Gratis tier)

1. Gå til [render.com](https://render.com) og opret konto
2. Klik **"New +"** → **"Web Service"**
3. Forbind dit GitHub repository
4. Konfiguration:
   - **Name:** `vinlager-backend`
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variables:**
     - `PORT=10000`
     - `JWT_SECRET=din-hemmelige-nøgle`
     - `NODE_ENV=production`
5. Klik **"Create Web Service"**

Backend URL vil være: `https://vinlager-backend.onrender.com`

### Option B: Railway

1. Gå til [railway.app](https://railway.app)
2. Opret nyt projekt fra GitHub repository
3. Vælg backend mappe
4. Railway detecterer automatisk Node.js
5. Tilføj environment variables

## ✅ Tjekliste

- [ ] GitHub repository oprettet
- [ ] Filer uploaded til GitHub (fra TIL_GITHUB_FINAL)
- [ ] GitHub Pages aktiveret (root folder)
- [ ] Frontend tilgængelig på GitHub Pages URL
- [ ] Backend kører lokalt
- [ ] Frontend kan kalde backend (lokalt)

## 🔍 Troubleshooting

### Frontend viser README i stedet for applikation

**Problemet:** GitHub Pages peger på root, men finder README.md først.

**Løsning:** Vi har allerede `index.html` i root, så det skulle virke. Hvis det ikke gør:
- Tjek at `index.html` er i root mappen
- Vent 2-3 minutter og refresh
- Clear browser cache

### Frontend kan ikke kalde backend (CORS fejl)

**Problem:** Når frontend er på GitHub Pages, kan den ikke kalde lokal backend.

**Løsning:**
- Brug frontend lokalt med lokal backend
- ELLER deploy backend til cloud først

### Git push fejler

**Problem:** Authentication failed

**Løsning:**
- Brug Personal Access Token i stedet for password
- Eller brug GitHub CLI: `gh auth login`

---

**God fornøjelse med CellarCount 2026! 🍷**
