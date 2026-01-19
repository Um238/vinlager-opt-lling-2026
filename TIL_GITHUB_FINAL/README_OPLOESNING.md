# 📦 TIL_GITHUB_FINAL - Alle Filer til Upload

**Dette er den komplette mappe med ALLE filer der skal uploades til GitHub.**

## ✅ Hvad er inkluderet:

1. **Root filer:**
   - `index.html` - Frontend applikation (for GitHub Pages)
   - `app.js` - Frontend JavaScript
   - `config.js` - Backend URL konfiguration
   - `styles.css` - Styling
   - `README.md` - Hoved dokumentation
   - `.gitignore` - Git ignore filer

2. **Backend mappe:**
   - Komplet backend med alle routes, controllers, config
   - `package.json` - Dependencies
   - `.gitkeep` filer i tomme mapper

3. **Frontend mappe:**
   - Frontend filer (kan også bruges lokalt)

4. **Skabelon mappe:**
   - CSV skabelon med 65 vine
   - README med instruktioner

5. **Dokumentation:**
   - GitHub deployment guide
   - START_HER guide

## 🚀 Hvordan bruger du denne mappe:

### Metode 1: Upload hele mappen til GitHub

1. **Gå til din GitHub repository**
2. **Upload alle filer fra denne mappe** (TIL_GITHUB_FINAL)
3. **Bevare mappestrukturen**

### Metode 2: Brug Git (hvis du har Git installeret)

1. **Kopier alle filer fra TIL_GITHUB_FINAL til din GitHub repository mappe**
2. **Commit og push:**
   ```bash
   git add .
   git commit -m "Initial commit - CellarCount 2026"
   git push
   ```

## ⚠️ VIGTIGT:

- **ALDRIG** upload `.env` filer (de er i .gitignore)
- **ALDRIG** upload `node_modules` (de er i .gitignore)
- **ALDRIG** upload `.db` filer (de er i .gitignore)
- **ALDRIG** upload billeder i `uploads/images/` (kun .gitkeep filen)

## ✅ Når du har uploadet:

1. **Aktiver GitHub Pages:**
   - Repository → Settings → Pages
   - Source: `main` branch, folder: `/` (root)
   
2. **Frontend vil være tilgængelig på:**
   ```
   https://DIT-BRUGERNAVN.github.io/DIT-REPO-NAVN/
   ```

3. **Backend skal køre lokalt:**
   - Se `START_HER.md` for instruktioner

---

**Denne mappe indeholder PRÆCIST de filer der skal til GitHub - ikke mere, ikke mindre!**
