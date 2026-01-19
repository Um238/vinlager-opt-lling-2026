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

## 📁 Trin 2: Forbered Lokalt Repository

### 2.1. Naviger til projekt mappen

```bash
cd "C:\Users\Uffe Mikkelsen\OneDrive\Skrivebord\køkkenlager\vinlager\vinlager-optælling-2026"
```

### 2.2. Initialiser Git (hvis ikke allerede gjort)

```bash
git init
```

### 2.3. Opret .gitignore i projekt root

Opret filen `.gitignore` i root mappen (`vinlager-optælling-2026/.gitignore`):

```
# Node modules
node_modules/
backend/node_modules/

# Environment variables
backend/.env
.env

# Database files
backend/data/*.db
backend/data/*.db-journal
*.db
*.db-journal

# Uploaded images (men beholde mappen struktur)
backend/uploads/images/*
!backend/uploads/images/.gitkeep

# OS files
.DS_Store
Thumbs.db
*.log

# Editor files
.vscode/
.idea/
*.swp
*.swo
```

### 2.4. Tilføj alle filer

```bash
git add .
```

### 2.5. Commit

```bash
git commit -m "Første commit: CellarCount 2026"
```

## 🔗 Trin 3: Forbind til GitHub

### 3.1. Tilføj remote repository

**Erstat `DIT-BRUGERNAVN` og `DIT-REPO-NAVN` med dine værdier:**

```bash
git remote add origin https://github.com/DIT-BRUGERNAVN/DIT-REPO-NAVN.git
```

Eksempel:
```bash
git remote add origin https://github.com/uffemikkelsen/vinlager-optaelling-2026.git
```

### 3.2. Push til GitHub

```bash
git branch -M main
git push -u origin main
```

**Hvis du bliver bedt om login:**
- GitHub bruger nu ikke længere password authentication
- Du skal bruge en **Personal Access Token** eller **GitHub CLI**

#### Opret Personal Access Token:

1. Gå til GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Klik **"Generate new token (classic)"**
3. Navn: `CellarCount 2026`
4. Vælg scope: **repo** (fuld adgang til repositories)
5. Klik **"Generate token"**
6. **KOPIER TOKEN** (du ser den kun én gang!)

7. Når Git beder om password, brug dit GitHub brugernavn og token som password

## 🌐 Trin 4: Deploy Frontend til GitHub Pages

### 4.1. Gå til Repository Settings

1. I dit GitHub repository, klik på **"Settings"** (øverst)
2. Scroll ned til **"Pages"** i venstre menu

### 4.2. Konfigurer GitHub Pages

1. Under **"Source"**, vælg **"Deploy from a branch"**
2. Vælg branch: **`main`**
3. Vælg folder: **`/frontend`** (vigtigt!)
4. Klik **"Save"**

### 4.3. Vent på deployment

- GitHub vil nu deploye din frontend
- Det tager ca. 1-2 minutter
- Din frontend vil være tilgængelig på:
  ```
  https://DIT-BRUGERNAVN.github.io/DIT-REPO-NAVN/
  ```

**Eksempel:**
```
https://uffemikkelsen.github.io/vinlager-optaelling-2026/
```

## ⚙️ Trin 5: Opdater Backend URL i Frontend

### 5.1. Rediger config.js

Når din frontend er deployet, skal du opdatere backend URL'en:

Åbn `frontend/config.js` og opdater:

```javascript
const CONFIG = {
  API_URL: 'http://localhost:3000',  // For lokal brug
  // Når backend er i cloud:
  // API_URL: 'https://din-backend-url.herokuapp.com',
};
```

**For GitHub Pages:**
- Frontend på GitHub Pages kan **ikke** kalde lokale backends (CORS)
- Du skal have backend kørende i cloud for at bruge GitHub Pages frontend
- **ELLER:** Brug frontend lokalt med lokal backend

### 5.2. Commit og push ændringer

```bash
git add frontend/config.js
git commit -m "Opdater backend URL"
git push
```

## 🔧 Trin 6: Backend Kører Lokalt

### 6.1. Start Backend

```bash
cd backend
npm install
npm start
```

Backend kører nu på `http://localhost:3000`

### 6.2. Brug Frontend Lokalt

1. Åbn `frontend/index.html` i browser
2. Eller brug Live Server extension i VS Code
3. Frontend vil nu kunne kalde backend på `localhost:3000`

## ☁️ Trin 7: Flyt Backend til Cloud (Senere)

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

### Option C: Heroku

1. Opret Heroku konto
2. Installer Heroku CLI
3. Opret app:
   ```bash
   heroku create din-app-navn
   ```
4. Push til Heroku:
   ```bash
   cd backend
   git subtree push --prefix backend heroku main
   ```

### 7.1. Opdater Frontend Config

Når backend er i cloud, opdater `frontend/config.js`:

```javascript
const CONFIG = {
  API_URL: 'https://din-backend-url.herokuapp.com',
};
```

Commit og push:

```bash
git add frontend/config.js
git commit -m "Opdater backend URL til cloud"
git push
```

GitHub Pages vil automatisk opdatere.

## ✅ Tjekliste

- [ ] GitHub repository oprettet
- [ ] Filer pushed til GitHub
- [ ] GitHub Pages aktiveret (frontend folder)
- [ ] Frontend tilgængelig på GitHub Pages URL
- [ ] Backend kører lokalt
- [ ] Frontend kan kalde backend (lokalt)
- [ ] (Senere) Backend deployed til cloud
- [ ] Frontend config opdateret med cloud URL

## 🔍 Troubleshooting

### Frontend kan ikke kalde backend (CORS fejl)

**Problem:** Når frontend er på GitHub Pages, kan den ikke kalde lokal backend.

**Løsning:**
- Brug frontend lokalt med lokal backend
- ELLER deploy backend til cloud først

### GitHub Pages viser tom side

**Check:**
- Har du sat source til `/frontend` folder?
- Er der en `index.html` i frontend mappen?
- Check browser console for fejl (F12)

### Git push fejler

**Problem:** Authentication failed

**Løsning:**
- Brug Personal Access Token i stedet for password
- Eller brug GitHub CLI: `gh auth login`

### Backend kan ikke finde database

**Check:**
- Er `backend/data/` mappen oprettet?
- Har backend write permissions?
- Check `DB_PATH` i `.env` fil

## 📚 Yderligere Ressourcer

- [GitHub Pages Dokumentation](https://docs.github.com/en/pages)
- [Render Dokumentation](https://render.com/docs)
- [Railway Dokumentation](https://docs.railway.app)

## 💡 Tips

1. **Commit ofte:** Push ændringer regelmæssigt til GitHub
2. **Brug branches:** Opret branches for større features
3. **Backup database:** Eksporter database regelmæssigt
4. **Miljøvariabler:** Brug aldrig `.env` filer i Git - brug GitHub Secrets eller cloud miljøvariabler

---

**God fornøjelse med CellarCount 2026! 🍷**
