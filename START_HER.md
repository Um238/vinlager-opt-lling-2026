# 🚀 Start Her - CellarCount 2026

Velkommen til CellarCount 2026! Følg disse trin for at komme i gang.

## ⚡ Hurtig Start (5 minutter)

### 1. Installer Backend Dependencies

```bash
cd backend
npm install
```

### 2. Opret .env fil

I `backend` mappen:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# Eller manuelt: Kopier .env.example til .env
```

Rediger `backend/.env` og sæt:
```
PORT=3000
JWT_SECRET=din-hemmelige-nøgle-ændre-dette
DB_PATH=./data/vinlager.db
```

### 3. Start Backend

```bash
# I backend mappen
npm start
```

Du skulle se:
```
🚀 Server kører på http://localhost:3000
📊 API health check: http://localhost:3000/api/health
```

**Lad backend køre i dette vindue!**

### 4. Åbn Frontend

**Option A: Direkte i Browser**
- Åbn `frontend/index.html` i din browser

**Option B: Med Live Server (anbefalet)**
- I VS Code: Højreklik på `frontend/index.html` → "Open with Live Server"
- Eller brug en lokal webserver

### 5. Test Systemet

1. Gå til **"Import"** siden
2. Upload `skabelon/vinlager_skabelon.csv`
3. Vælg **"Tilføj nye vine"**
4. Klik **"Start import"**
5. Gå til **"Lager"** for at se vine

## 📱 QR-kode Optælling

1. Gå til **"Optælling"** siden
2. Indtast eller scan en VIN-ID (fx `VIN-0001`)
3. Klik **"Søg vin"**
4. Brug **+1** / **-1** knapper eller indtast direkte antal
5. Klik **"Gem antal"**

## 📊 Funktioner

- **Dashboard:** Oversigt med statistik
- **Lager:** Se alle vine med filtrering
- **Optælling:** QR-scanning og antal opdatering
- **Import:** Import CSV/Excel med 3 modes
- **Labels:** Generer og print labels med QR-koder
- **Rapporter:** PDF rapporter (lager og værdi)

## 🔧 Fejlfinding

### Backend starter ikke

**Check:**
- Er Node.js installeret? (`node --version`)
- Er du i `backend` mappen?
- Har du kørt `npm install`?

### Frontend kan ikke kalde backend

**Check:**
- Kører backend? (`http://localhost:3000/api/health`)
- Check `frontend/config.js` - er API_URL korrekt?
- Check browser console (F12) for CORS fejl

### Import fejler

**Check:**
- Er CSV filen i korrekt format (semikolon separator)?
- Har filen header-række?
- Check backend console for fejl

### Database fejl

**Check:**
- Er `backend/data/` mappen oprettet?
- Har backend write permissions?

## 📚 Næste Skridt

- Se [README.md](README.md) for fuld dokumentation
- Se [GITHUB_DEPLOYMENT.md](GITHUB_DEPLOYMENT.md) for GitHub upload guide
- Import din egen CSV/Excel med dine vine
- Brug QR-koder til optælling

## 🎯 Tips

1. **Backup database:** Kopier `backend/data/vinlager.db` regelmæssigt
2. **Test import:** Brug skabelonen først til at teste
3. **QR-koder:** Print labels og brug dem til optælling
4. **Rapporter:** Generer PDF rapporter for lageroverblik

---

**God fornøjelse! 🍷**
