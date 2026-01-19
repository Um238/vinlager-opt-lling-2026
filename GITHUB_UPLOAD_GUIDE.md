# 📤 Præcis Guide: Upload til GitHub

Dette er en **meget detaljeret step-by-step guide** til at uploade CellarCount 2026 til GitHub.

## 📋 Forudsætninger

- GitHub konto (gratis på github.com)
- Git installeret på din PC
- Projekt mappen: `vinlager-optælling-2026`

---

## 🔍 TRIN 1: Tjek hvilke filer der skal uploades

### ✅ Filer og mapper der SKAL uploades:

```
vinlager-optælling-2026/
├── backend/
│   ├── src/                    ← HELE mappen
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── routes/
│   │   │   ├── count.routes.js
│   │   │   ├── import.routes.js
│   │   │   ├── reports.routes.js
│   │   │   └── wines.routes.js
│   │   ├── controllers/
│   │   │   ├── count.controller.js
│   │   │   ├── import.controller.js
│   │   │   ├── reports.controller.js
│   │   │   └── wines.controller.js
│   │   └── utils/
│   │       └── upload.js
│   ├── uploads/
│   │   ├── images/
│   │   │   └── .gitkeep       ← Kun denne fil (ikke billederne)
│   │   └── temp/
│   │       └── .gitkeep       ← Kun denne fil
│   ├── data/
│   │   └── .gitkeep           ← Kun denne fil (ikke .db filer)
│   ├── package.json           ← VIGTIG!
│   ├── README.md
│   └── .gitignore
│
├── frontend/
│   ├── index.html             ← HELE mappen
│   ├── app.js
│   ├── config.js
│   └── styles.css
│
├── skabelon/
│   ├── vinlager_skabelon.csv  ← HELE mappen
│   └── README.md
│
├── README.md                  ← Root filer
├── START_HER.md
├── GITHUB_DEPLOYMENT.md
├── GITHUB_UPLOAD_GUIDE.md     ← Denne fil
└── .gitignore
```

### ❌ Filer der IKKE skal uploades:

- `backend/node_modules/` - Installeres med `npm install`
- `backend/.env` - Oprettes lokalt
- `backend/data/*.db` - Database filer (lokal data)
- `backend/data/*.db-journal` - Database journal filer
- `backend/uploads/images/*.jpg` - Uploadede billeder (kun .gitkeep)
- `backend/uploads/temp/*.csv` - Temp filer (kun .gitkeep)
- `.DS_Store`, `Thumbs.db` - System filer
- `*.log` - Log filer

---

## 🚀 TRIN 2: Opret GitHub Repository

1. **Gå til GitHub:** https://github.com
2. **Log ind** med din konto
3. **Klik på "+"** (øverst til højre) → **"New repository"**
4. **Repository navn:** `vinlager-optaelling-2026` (eller dit eget navn)
5. **Beskrivelse:** `Vinlager optællingssystem med QR-kode scanning`
6. **Vælg:** 
   - ☑ **Public** (alle kan se)
   - ☐ **Private** (kun du kan se - også gratis)
7. **IKKE tjek:**
   - ☐ Add a README file
   - ☐ Add .gitignore
   - ☐ Choose a license
8. **Klik:** "Create repository"

---

## 💻 TRIN 3: Forbered lokalt (PowerShell)

### 3.1. Åbn PowerShell

Tryk `Windows + X` → vælg "Windows PowerShell" eller "Terminal"

### 3.2. Naviger til projekt mappen

```powershell
cd "C:\Users\Uffe Mikkelsen\OneDrive\Skrivebord\køkkenlager\vinlager\vinlager-optælling-2026"
```

**Tjek at du er i rigtig mappe:**
```powershell
dir
```
Du skulle se: `backend`, `frontend`, `skabelon`, `README.md`

### 3.3. Initialiser Git (hvis ikke allerede gjort)

```powershell
git init
```

Du skulle se: `Initialized empty Git repository...`

---

## 📝 TRIN 4: Opret .gitignore (hvis mangler)

**Tjek om `.gitignore` findes:**
```powershell
dir .gitignore
```

**Hvis den ikke findes, opret den:**
Den skulle allerede være der, men hvis ikke:

```powershell
notepad .gitignore
```

Kopier dette ind:

```
node_modules/
backend/node_modules/
backend/.env
.env
*.env
backend/data/*.db
backend/data/*.db-journal
*.db
*.db-journal
backend/uploads/images/*
!backend/uploads/images/.gitkeep
backend/uploads/temp/*
!backend/uploads/temp/.gitkeep
.DS_Store
Thumbs.db
*.log
.vscode/
.idea/
*.swp
*.swo
*.tmp
*.temp
```

Gem og luk Notepad.

---

## ✅ TRIN 5: Tilføj alle filer til Git

### 5.1. Tjek hvilke filer der skal tilføjes

```powershell
git status
```

Du skulle se en liste af filer der ikke er tracked.

### 5.2. Tilføj alle filer

```powershell
git add .
```

**Bekræft:**
```powershell
git status
```

Du skulle nu se alle filer som "Changes to be committed" (grønne).

### 5.3. Tjek at korrekte filer er med

**Tjek at disse mapper er med:**
```powershell
git ls-files | Select-String -Pattern "backend/src|frontend|skabelon"
```

Du skulle se filer fra alle tre mapper.

**Tjek at node_modules IKKE er med:**
```powershell
git ls-files | Select-String -Pattern "node_modules"
```

Der skulle være **ingen** resultater.

---

## 📦 TRIN 6: Commit filer

```powershell
git commit -m "Første commit: CellarCount 2026 komplet system"
```

Du skulle se noget som:
```
[main (root-commit) xxxxxxx] Første commit: CellarCount 2026 komplet system
 X files changed, Y insertions(+)
```

---

## 🔗 TRIN 7: Forbind til GitHub

### 7.1. Tilføj remote repository

**Erstat `DIT-BRUGERNAVN` og `DIT-REPO-NAVN`:**

```powershell
git remote add origin https://github.com/DIT-BRUGERNAVN/DIT-REPO-NAVN.git
```

**Eksempel:**
```powershell
git remote add origin https://github.com/uffemikkelsen/vinlager-optaelling-2026.git
```

### 7.2. Tjek remote

```powershell
git remote -v
```

Du skulle se:
```
origin  https://github.com/DIT-BRUGERNAVN/DIT-REPO-NAVN.git (fetch)
origin  https://github.com/DIT-BRUGERNAVN/DIT-REPO-NAVN.git (push)
```

---

## 🔐 TRIN 8: Opret Personal Access Token (hvis nødvendigt)

GitHub kræver nu en token i stedet for password.

### 8.1. Opret token

1. Gå til: https://github.com/settings/tokens
2. Klik: **"Generate new token (classic)"**
3. **Note:** `CellarCount 2026 Upload`
4. **Expiration:** Vælg en dato (fx 90 dage eller "No expiration")
5. **Scopes:** Tjek **☑ repo** (fuld adgang til repositories)
6. Klik: **"Generate token"**
7. **KOPIER TOKEN NU** (du ser den kun én gang!)
   - Den ser ud som: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 8.2. Gem token

Skriv token ned et sikkert sted - du skal bruge den ved push.

---

## 📤 TRIN 9: Push til GitHub

### 9.1. Sæt branch til main

```powershell
git branch -M main
```

### 9.2. Push filer

```powershell
git push -u origin main
```

### 9.3. Indtast credentials

**Username:** Dit GitHub brugernavn
**Password:** **INDTAST DIN TOKEN** (ikke dit password!)

Hvis det lykkedes, skulle du se:
```
Enumerating objects: X, done.
Counting objects: 100% (X/X), done.
Writing objects: 100% (X/X), done.
To https://github.com/...
 * [new branch]      main -> main
```

---

## ✅ TRIN 10: Bekræft på GitHub

1. **Gå til dit repository på GitHub:**
   ```
   https://github.com/DIT-BRUGERNAVN/DIT-REPO-NAVN
   ```

2. **Tjek at alle mapper er der:**
   - Klik gennem mapperne
   - Du skulle se: `backend/`, `frontend/`, `skabelon/`

3. **Tjek at filer er med:**
   - Gå til `backend/src/` - du skulle se alle .js filer
   - Gå til `frontend/` - du skulle se .html, .js, .css
   - Gå til `skabelon/` - du skulle se .csv fil

4. **Tjek at korrekte filer IKKE er med:**
   - Gå til `backend/` - der skulle **ikke** være `node_modules/`
   - Der skulle **ikke** være `.env` fil
   - Der skulle **ikke** være `.db` filer

---

## 🌐 TRIN 11: Deploy Frontend til GitHub Pages

### 11.1. Gå til Settings

I dit GitHub repository:
1. Klik på **"Settings"** tab (øverst)
2. Scroll ned i venstre menu
3. Klik på **"Pages"**

### 11.2. Konfigurer GitHub Pages

1. Under **"Source"**:
   - Vælg: **"Deploy from a branch"**
2. Under **"Branch"**:
   - Vælg: **`main`**
   - Vælg folder: **`/frontend`** ← **VIGTIGT!**
3. Klik: **"Save"**

### 11.3. Vent på deployment

- GitHub vil nu deploye
- Vent 1-2 minutter
- Refresh siden
- Du skulle se:
  ```
  Your site is live at https://DIT-BRUGERNAVN.github.io/DIT-REPO-NAVN/
  ```

### 11.4. Test din side

Åbn URL'en i browser - din frontend skulle nu være tilgængelig!

---

## 🔧 TRIN 12: Test lokalt (valgfrit)

### 12.1. Start Backend

```powershell
cd backend
npm install
npm start
```

Backend kører nu på `http://localhost:3000`

### 12.2. Test Frontend

1. Åbn `frontend/index.html` i browser
2. Eller brug GitHub Pages URL fra trin 11.4
3. Test import, QR scanning, etc.

---

## ✅ CHECKLISTE

- [ ] Alle mapper er uploadet (backend, frontend, skabelon)
- [ ] Alle .js filer er i backend/src/
- [ ] Alle frontend filer (html, js, css) er uploadet
- [ ] CSV skabelon er uploadet
- [ ] node_modules er **IKKE** uploadet
- [ ] .env filer er **IKKE** uploadet
- [ ] .db filer er **IKKE** uploadet
- [ ] GitHub Pages er konfigureret (frontend folder)
- [ ] Frontend er tilgængelig på GitHub Pages URL

---

## 🆘 Fejlfinding

### Git push fejler: Authentication failed

**Løsning:**
- Brug Personal Access Token i stedet for password
- Token starter med `ghp_`

### Filer mangler på GitHub

**Løsning:**
```powershell
git add .
git commit -m "Tilføj manglende filer"
git push
```

### node_modules er uploadet (fejl!)

**Løsning:**
1. Slet fra Git (men beholde lokalt):
```powershell
git rm -r --cached backend/node_modules
git commit -m "Fjern node_modules"
git push
```

2. Tjek .gitignore indeholder `node_modules/`

### GitHub Pages viser tom side

**Check:**
- Er source sat til `/frontend` folder?
- Er der en `index.html` i frontend mappen?
- Vent 2-3 minutter efter deployment
- Check browser console (F12) for fejl

### Backend kan ikke køre

**Check:**
```powershell
cd backend
npm install
npm start
```

Hvis fejl:
- Tjek at `package.json` er uploadet
- Tjek at alle .js filer er uploadet i `src/`

---

## 📚 Næste Skridt

1. **Brug systemet lokalt:**
   - Backend kører lokalt
   - Frontend kan bruge GitHub Pages eller køre lokalt

2. **Senere: Deploy backend til cloud:**
   - Render.com (gratis tier)
   - Railway.app
   - Heroku
   - Se `GITHUB_DEPLOYMENT.md` for instruktioner

3. **Opdater backend URL:**
   - Når backend er i cloud, opdater `frontend/config.js`
   - Push igen til GitHub

---

**🎉 Tillykke! Din kode er nu på GitHub!**
