const db = require('../config/database');
const XLSX = require('xlsx');
const fs = require('fs');

// Parse CSV fil (med semikolon separator)
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV filen er tom');
  }

  // Find separator (semikolon eller komma)
  const separator = lines[0].includes(';') ? ';' : ',';
  
  // Parse header
  const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
  
  // Map danske header navne til database felter
  const headerMap = {
    'vinid': 'vinId',
    'varenummer': 'varenummer',
    'navn': 'navn',
    'type': 'type',
    'kategori': 'kategori',
    'land': 'land',
    'region': 'region',
    'drue': 'drue',
    'årgang': 'årgang',
    'reol': 'reol',
    'hylde': 'hylde',
    'lokation': 'lokation',
    'location': 'lokation',
    'antal': 'antal',
    'minantal': 'minAntal',
    'minimum': 'minAntal',
    'indkøbspris': 'indkøbspris',
    'pris': 'indkøbspris',
    'billede': 'billede'
  };

  const mappedHeaders = headers.map(h => headerMap[h] || h);
  
  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator).map(v => v.trim());
    if (values.length === 0 || !values[0]) continue; // Skip tomme rækker
    
    const row = {};
    mappedHeaders.forEach((mappedHeader, idx) => {
      if (mappedHeader && values[idx] !== undefined) {
        row[mappedHeader] = values[idx];
      }
    });
    
    if (row.vinId || row.navn) {
      rows.push(row);
    }
  }
  
  return rows;
}

// Parse Excel fil
function parseExcel(filePath) {
  let workbook;
  try {
    // Prøv først at læse buffer (virker bedre med uploadede filer)
    const fileBuffer = fs.readFileSync(filePath);
    // Brug codepage 65001 (UTF-8) for korrekt encoding af æ, ø, å
    workbook = XLSX.read(fileBuffer, { 
      type: 'buffer',
      codepage: 65001,
      cellText: false,
      cellDates: true
    });
  } catch (err) {
    // Hvis buffer fejler, prøv at læse som fil
    try {
      workbook = XLSX.readFile(filePath, {
        codepage: 65001,
        cellText: false,
        cellDates: true
      });
    } catch (fileErr) {
      throw new Error(`Kan ikke læse Excel fil: ${err.message || fileErr.message}`);
    }
  }
  
  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel filen indeholder ingen ark');
  }
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    throw new Error('Excel arket er tomt');
  }
  
  // Brug sheet_to_json med raw: false for at få formaterede værdier
  const data = XLSX.utils.sheet_to_json(worksheet, {
    raw: false, // Få formaterede værdier (ikke rå tal)
    defval: '' // Default værdi for tomme celler
  });
  
  if (!data || data.length === 0) {
    throw new Error('Excel filen indeholder ingen data (kun headers?)');
  }

  // Map til lowercase headers (case-insensitive)
  const headerMap = {
    'vinid': 'vinId',
    'vin-id': 'vinId',
    'varenummer': 'varenummer',
    'navn': 'navn',
    'type': 'type',
    'kategori': 'kategori',
    'størrelse': 'størrelse', // For Øl & Vand
    'land': 'land',
    'region': 'region',
    'drue': 'drue',
    'årgang': 'årgang',
    'ar': 'årgang',
    'reol': 'reol',
    'hylde': 'hylde',
    'lokation': 'lokation',
    'location': 'lokation',
    'antal': 'antal',
    'minantal': 'minAntal',
    'min antal': 'minAntal',
    'minimum': 'minAntal',
    'indkøbspris': 'indkøbspris',
    'indkøbs pris': 'indkøbspris',
    'pris': 'indkøbspris',
    'billede': 'billede'
  };

  return data.map(row => {
    const mappedRow = {};
    Object.keys(row).forEach(key => {
      // Fjern whitespace og konverter til lowercase
      const lowerKey = key.toLowerCase().trim().replace(/\s+/g, '');
      const mappedKey = headerMap[lowerKey] || lowerKey;
      // Bevar original værdi, men map key korrekt
      let value = row[key];
      // Hvis værdien er et tal, konverter det
      if (typeof value === 'number') {
        value = value.toString();
      }
      mappedRow[mappedKey] = value;
    });
    return mappedRow;
  }).filter(row => row.vinId || row.navn);
}

// Generer vinId hvis den mangler
function generateVinId(navn) {
  // Fjern specialtegn og tag første 10 tegn
  const clean = navn.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `VIN-${clean}-${timestamp}`;
}

// Find eller opret lokation
function findOrCreateLocation(locationName, category = 'Vin') {
  return new Promise((resolve, reject) => {
    if (!locationName || locationName.trim() === '') {
      // Hvis ingen lokation, brug standard "Vinlager"
      locationName = 'Vinlager';
    }
    
    // Find eksisterende lokation
    db.get('SELECT id FROM locations WHERE name = ?', [locationName.trim()], (err, location) => {
      if (err) {
        return reject(err);
      }
      
      if (location) {
        return resolve(location.id);
      }
      
      // Opret ny lokation
      db.run(
        'INSERT INTO locations (name, category) VALUES (?, ?)',
        [locationName.trim(), category],
        function(insertErr) {
          if (insertErr) {
            return reject(insertErr);
          }
          resolve(this.lastID);
        }
      );
    });
  });
}

// Find eller opret vin (kun vin-info, ikke antal/reol/hylde)
function findOrCreateWine(wine) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM wines WHERE vinId = ?', [wine.vinId], (err, existing) => {
      if (err) {
        return reject(err);
      }
      
      if (existing) {
        // Opdater vin-info (men ikke antal/reol/hylde - det er i inventory)
        const updateQuery = `
          UPDATE wines SET
            varenummer = ?, navn = ?, type = ?, kategori = ?, land = ?,
            region = ?, drue = ?, årgang = ?, indkøbspris = ?, billede = ?,
            opdateret = CURRENT_TIMESTAMP
          WHERE vinId = ?
        `;
        
        db.run(updateQuery, [
          wine.varenummer, wine.navn, wine.type, wine.kategori,
          wine.land, wine.region, wine.drue, wine.årgang,
          wine.indkøbspris, wine.billede, wine.vinId
        ], (updateErr) => {
          if (updateErr) {
            return reject(updateErr);
          }
          resolve(existing.id);
        });
      } else {
        // Opret ny vin
        const insertQuery = `
          INSERT INTO wines (
            vinId, varenummer, navn, type, kategori, land, region, drue,
            årgang, indkøbspris, billede
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(insertQuery, [
          wine.vinId, wine.varenummer, wine.navn, wine.type, wine.kategori,
          wine.land, wine.region, wine.drue, wine.årgang,
          wine.indkøbspris, wine.billede
        ], function(insertErr) {
          if (insertErr) {
            return reject(insertErr);
          }
          resolve(this.lastID);
        });
      }
    });
  });
}

// Find eller opret/opdater inventory række
function findOrUpdateInventory(wineId, locationId, reol, hylde, antal, minAntal) {
  return new Promise((resolve, reject) => {
    // Find eksisterende inventory række
    db.get(
      'SELECT id FROM inventory WHERE wine_id = ? AND location_id = ? AND reol = ? AND hylde = ?',
      [wineId, locationId, reol || null, hylde || null],
      (err, existing) => {
        if (err) {
          return reject(err);
        }
        
        if (existing) {
          // Opdater eksisterende
          db.run(
            'UPDATE inventory SET antal = ?, minAntal = ?, opdateret = CURRENT_TIMESTAMP WHERE id = ?',
            [antal, minAntal, existing.id],
            (updateErr) => {
              if (updateErr) {
                return reject(updateErr);
              }
              resolve({ id: existing.id, action: 'updated' });
            }
          );
        } else {
          // Opret ny
          db.run(
            'INSERT INTO inventory (wine_id, location_id, reol, hylde, antal, minAntal) VALUES (?, ?, ?, ?, ?, ?)',
            [wineId, locationId, reol || null, hylde || null, antal, minAntal],
            function(insertErr) {
              if (insertErr) {
                return reject(insertErr);
              }
              resolve({ id: this.lastID, action: 'created' });
            }
          );
        }
      }
    );
  });
}

// Importer data med valgt mode (ny version med inventory system)
async function importData(rows, mode, category = 'vin') {
  const results = {
    importeret: 0,
    opdateret: 0,
    fejl: []
  };

  // KRITISK: Mode 1: Overskriv hele lageret - kun for den specifikke kategori
  if (mode === 'overskriv') {
    // Hvis category er 'ol-vand', slet kun øl & vand produkter
    // Hvis category er 'vin', slet kun vin produkter
    if (category === 'ol-vand') {
      // Slet kun øl & vand (kategori indeholder øl, vand, sodavand, fadøl, flaske, dåse)
      await new Promise((resolve, reject) => {
        // Først find alle øl & vand wine IDs
        db.all(`SELECT id FROM wines WHERE 
          (kategori LIKE '%øl%' OR kategori LIKE '%vand%' OR kategori LIKE '%sodavand%' OR 
           kategori LIKE '%fadøl%' OR kategori LIKE '%flaske%' OR kategori LIKE '%dåse%' OR
           vinId LIKE 'OL-%' OR vinId LIKE 'W%')`, [], (err, olVandWines) => {
          if (err) return reject(err);
          
          if (olVandWines && olVandWines.length > 0) {
            const wineIds = olVandWines.map(w => w.id);
            const placeholders = wineIds.map(() => '?').join(',');
            
            // Slet inventory for disse wines
            db.run(`DELETE FROM inventory WHERE wine_id IN (${placeholders})`, wineIds, (err) => {
              if (err) return reject(err);
              // Slet wines
              db.run(`DELETE FROM wines WHERE id IN (${placeholders})`, wineIds, (err) => {
                if (err) return reject(err);
                resolve();
              });
            });
          } else {
            resolve();
          }
        });
      });
    } else {
      // Slet kun vin (ikke øl & vand)
      await new Promise((resolve, reject) => {
        // Find alle VIN wine IDs (ikke øl & vand)
        db.all(`SELECT id FROM wines WHERE 
          (kategori NOT LIKE '%øl%' AND kategori NOT LIKE '%vand%' AND kategori NOT LIKE '%sodavand%' AND 
           kategori NOT LIKE '%fadøl%' AND kategori NOT LIKE '%flaske%' AND kategori NOT LIKE '%dåse%' AND
           vinId NOT LIKE 'OL-%' AND vinId NOT LIKE 'W%') OR kategori IS NULL`, [], (err, vinWines) => {
          if (err) return reject(err);
          
          if (vinWines && vinWines.length > 0) {
            const wineIds = vinWines.map(w => w.id);
            const placeholders = wineIds.map(() => '?').join(',');
            
            // Slet inventory for disse wines
            db.run(`DELETE FROM inventory WHERE wine_id IN (${placeholders})`, wineIds, (err) => {
              if (err) return reject(err);
              // Slet wines
              db.run(`DELETE FROM wines WHERE id IN (${placeholders})`, wineIds, (err) => {
                if (err) return reject(err);
                resolve();
              });
            });
          } else {
            resolve();
          }
        });
      });
    }
  }

  // Process hver række
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    
    try {
      // Generer vinId hvis mangler
      if (!row.vinId && row.navn) {
        row.vinId = generateVinId(row.navn);
      }

      if (!row.vinId || !row.navn) {
        results.fejl.push({ row: index + 2, error: 'Mangler vinId eller navn' });
        continue;
      }

      // Normaliser vin-data (uden antal/reol/hylde - det er i inventory)
      const wine = {
        vinId: row.vinId.toString().trim(),
        varenummer: row.varenummer ? row.varenummer.toString().trim() : null,
        navn: row.navn ? row.navn.toString().trim() : null,
        type: row.type || null,
        kategori: row.kategori || row.type || null,
        land: row.land || null,
        region: row.region || null,
        drue: row.drue || null,
        årgang: row.årgang ? parseInt(row.årgang) : null,
        indkøbspris: row.indkøbspris ? parseFloat(row.indkøbspris.toString().replace(',', '.')) : null,
        billede: row.billede || null
      };

      // Normaliser inventory-data
      const locationName = row.lokation || row.location || 'Vinlager';
      const reol = row.reol ? row.reol.toString().trim() : null;
      const hylde = row.hylde ? row.hylde.toString().trim() : null;
      const antal = row.antal ? parseInt(row.antal) : 0;
      const minAntal = row.minAntal ? parseInt(row.minAntal) : (row.minimum ? parseInt(row.minimum) : 24);

      // Mode 2: Tilføj - tjek om vin allerede findes
      if (mode === 'tilføj') {
        const existing = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM wines WHERE vinId = ?', [wine.vinId], (err, result) => {
            if (err) return reject(err);
            resolve(result);
          });
        });
        
        if (existing) {
          // Vin findes allerede - skip
          continue;
        }
      }

      // 1. Find eller opret vin
      const wineId = await findOrCreateWine(wine);
      
      // 2. Find eller opret lokation (med korrekt kategori)
      const locationId = await findOrCreateLocation(locationName, category);
      
      // 3. Find eller opret/opdater inventory
      const inventoryResult = await findOrUpdateInventory(wineId, locationId, reol, hylde, antal, minAntal);
      
      if (inventoryResult.action === 'created') {
        results.importeret++;
      } else {
        results.opdateret++;
      }
      
    } catch (error) {
      results.fejl.push({ row: index + 2, error: error.message });
    }
  }

  return results;
}

// CSV Import
exports.importCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Ingen fil uploadet' });
  }

  const { mode, category } = req.body; // overskriv, tilføj, opdater + vin eller ol-vand

  if (!['overskriv', 'tilføj', 'opdater'].includes(mode)) {
    return res.status(400).json({ error: 'Ugyldig mode. Brug: overskriv, tilføj eller opdater' });
  }

  try {
    const rows = parseCSV(req.file.path);
    const results = await importData(rows, mode, category || 'vin');

    // Slet temp fil
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'Import gennemført',
      ...results
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
};

// Excel Import
exports.importExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Ingen fil uploadet' });
  }

  const { mode, category } = req.body; // overskriv, tilføj, opdater + vin eller ol-vand

  if (!['overskriv', 'tilføj', 'opdater'].includes(mode)) {
    return res.status(400).json({ error: 'Ugyldig mode. Brug: overskriv, tilføj eller opdater' });
  }

  try {
    console.log('Excel import starter...', {
      filename: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      category: category || 'vin'
    });

    const rows = parseExcel(req.file.path);
    console.log(`Excel fil parsed: ${rows.length} rækker fundet`);
    
    if (rows.length === 0) {
      throw new Error('Excel filen indeholder ingen data. Tjek at der er data under header-rækken.');
    }

    const results = await importData(rows, mode, category || 'vin');

    // Slet temp fil
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.log('Excel import gennemført:', results);

    res.json({
      message: 'Import gennemført',
      ...results
    });
  } catch (error) {
    console.error('Excel import fejl:', error);
    
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Fejl ved sletning af temp fil:', unlinkErr);
      }
    }
    
    res.status(500).json({ 
      error: error.message || 'Ukendt fejl ved Excel import',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Export til Excel med lokation
exports.exportExcel = async (req, res) => {
  try {
    // Hent alle vine med deres inventory data (inkl. lokation)
    const query = `
      SELECT 
        w.vinId,
        w.varenummer,
        w.navn,
        w.type,
        w.kategori,
        w.land,
        w.region,
        w.drue,
        w.årgang,
        w.indkøbspris,
        l.name as lokation,
        i.reol,
        i.hylde,
        i.antal,
        i.minAntal
      FROM wines w
      INNER JOIN inventory i ON w.id = i.wine_id
      INNER JOIN locations l ON i.location_id = l.id
      ORDER BY w.navn, l.name, i.reol, i.hylde
    `;

    const rows = await new Promise((resolve, reject) => {
      db.all(query, [], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ingen data at eksportere' });
    }

    // Opret Excel workbook
    const workbook = XLSX.utils.book_new();
    
    // Konverter data til Excel format
    const excelData = rows.map(row => ({
      'VIN-ID': row.vinId || '',
      'Varenummer': row.varenummer || '',
      'Navn': row.navn || '',
      'Type': row.type || '',
      'Kategori': row.kategori || '',
      'Land': row.land || '',
      'Region': row.region || '',
      'Drue': row.drue || '',
      'Årgang': row.årgang || '',
      'Lokation': row.lokation || '',
      'Reol': row.reol || '',
      'Hylde': row.hylde || '',
      'Antal': row.antal || 0,
      'MinAntal': row.minAntal || 24,
      'Indkøbspris': row.indkøbspris || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vinlager');

    // Generer Excel buffer med UTF-8 encoding
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      codepage: 65001 // UTF-8 encoding for korrekt håndtering af æ, ø, å
    });

    // Send som download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'vinlager_export.xlsx');
    res.send(excelBuffer);

  } catch (error) {
    console.error('Excel export fejl:', error);
    res.status(500).json({ 
      error: error.message || 'Ukendt fejl ved Excel export',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Download Excel skabelon (med eksempeldata - realistiske vine)
exports.downloadTemplate = async (req, res) => {
  try {
    // Realistiske vine med rigtige navne, lande, regioner, drue sorter, årgange og priser
    const wines = [
      // Frankrig - Bordeaux
      { navn: 'Château Margaux', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bordeaux', drue: 'Cabernet Sauvignon', årgang: 2018, pris: 650 },
      { navn: 'Château Latour', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bordeaux', drue: 'Cabernet Sauvignon', årgang: 2017, pris: 680 },
      { navn: 'Château Mouton Rothschild', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bordeaux', drue: 'Cabernet Sauvignon', årgang: 2019, pris: 700 },
      { navn: 'Château Lafite Rothschild', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bordeaux', drue: 'Cabernet Sauvignon', årgang: 2018, pris: 690 },
      { navn: 'Château Haut-Brion', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bordeaux', drue: 'Merlot', årgang: 2017, pris: 670 },
      { navn: 'Château Cheval Blanc', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bordeaux', drue: 'Merlot', årgang: 2018, pris: 650 },
      { navn: 'Château Pétrus', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bordeaux', drue: 'Merlot', årgang: 2019, pris: 700 },
      { navn: 'Château d\'Yquem', type: 'Dessertvin', kategori: 'Dessertvin', land: 'Frankrig', region: 'Bordeaux', drue: 'Sémillon', årgang: 2017, pris: 450 },
      { navn: 'Château Palmer', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bordeaux', drue: 'Cabernet Sauvignon', årgang: 2018, pris: 320 },
      { navn: 'Château Cos d\'Estournel', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bordeaux', drue: 'Cabernet Sauvignon', årgang: 2017, pris: 280 },
      // Frankrig - Burgundy
      { navn: 'Domaine de la Romanée-Conti', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bourgogne', drue: 'Pinot Noir', årgang: 2018, pris: 680 },
      { navn: 'Domaine Leroy', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bourgogne', drue: 'Pinot Noir', årgang: 2019, pris: 550 },
      { navn: 'Domaine Armand Rousseau', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bourgogne', drue: 'Pinot Noir', årgang: 2018, pris: 420 },
      { navn: 'Domaine Comte de Vogüé', type: 'Rødvin', kategori: 'Rødvin', land: 'Frankrig', region: 'Bourgogne', drue: 'Pinot Noir', årgang: 2017, pris: 480 },
      { navn: 'Domaine Leflaive', type: 'Hvidvin', kategori: 'Hvidvin', land: 'Frankrig', region: 'Bourgogne', drue: 'Chardonnay', årgang: 2019, pris: 380 },
      { navn: 'Domaine Coche-Dury', type: 'Hvidvin', kategori: 'Hvidvin', land: 'Frankrig', region: 'Bourgogne', drue: 'Chardonnay', årgang: 2018, pris: 450 },
      // Frankrig - Champagne
      { navn: 'Dom Pérignon', type: 'Mousserende', kategori: 'Mousserende', land: 'Frankrig', region: 'Champagne', drue: 'Chardonnay', årgang: 2015, pris: 850 },
      { navn: 'Krug Grande Cuvée', type: 'Mousserende', kategori: 'Mousserende', land: 'Frankrig', region: 'Champagne', drue: 'Chardonnay', årgang: 2016, pris: 420 },
      { navn: 'Veuve Clicquot', type: 'Mousserende', kategori: 'Mousserende', land: 'Frankrig', region: 'Champagne', drue: 'Pinot Noir', årgang: 2017, pris: 380 },
      { navn: 'Moët & Chandon', type: 'Mousserende', kategori: 'Mousserende', land: 'Frankrig', region: 'Champagne', drue: 'Chardonnay', årgang: 2018, pris: 320 },
      { navn: 'Laurent-Perrier', type: 'Mousserende', kategori: 'Mousserende', land: 'Frankrig', region: 'Champagne', drue: 'Chardonnay', årgang: 2019, pris: 280 },
      // Italien - Toscana
      { navn: 'Sassicaia', type: 'Rødvin', kategori: 'Rødvin', land: 'Italien', region: 'Toscana', drue: 'Cabernet Sauvignon', årgang: 2018, pris: 450 },
      { navn: 'Ornellaia', type: 'Rødvin', kategori: 'Rødvin', land: 'Italien', region: 'Toscana', drue: 'Merlot', årgang: 2017, pris: 420 },
      { navn: 'Tignanello', type: 'Rødvin', kategori: 'Rødvin', land: 'Italien', region: 'Toscana', drue: 'Sangiovese', årgang: 2019, pris: 380 },
      { navn: 'Brunello di Montalcino', type: 'Rødvin', kategori: 'Rødvin', land: 'Italien', region: 'Toscana', drue: 'Sangiovese', årgang: 2016, pris: 320 },
      { navn: 'Chianti Classico', type: 'Rødvin', kategori: 'Rødvin', land: 'Italien', region: 'Toscana', drue: 'Sangiovese', årgang: 2018, pris: 180 },
      { navn: 'Super Tuscan', type: 'Rødvin', kategori: 'Rødvin', land: 'Italien', region: 'Toscana', drue: 'Cabernet Sauvignon', årgang: 2017, pris: 250 },
      // Italien - Piemonte
      { navn: 'Barolo', type: 'Rødvin', kategori: 'Rødvin', land: 'Italien', region: 'Piemonte', drue: 'Nebbiolo', årgang: 2016, pris: 320 },
      { navn: 'Barbaresco', type: 'Rødvin', kategori: 'Rødvin', land: 'Italien', region: 'Piemonte', drue: 'Nebbiolo', årgang: 2017, pris: 280 },
      { navn: 'Barbera d\'Asti', type: 'Rødvin', kategori: 'Rødvin', land: 'Italien', region: 'Piemonte', drue: 'Barbera', årgang: 2018, pris: 120 },
      { navn: 'Gaja', type: 'Rødvin', kategori: 'Rødvin', land: 'Italien', region: 'Piemonte', drue: 'Nebbiolo', årgang: 2018, pris: 450 },
      // Spanien
      { navn: 'Vega Sicilia', type: 'Rødvin', kategori: 'Rødvin', land: 'Spanien', region: 'Ribera del Duero', drue: 'Tempranillo', årgang: 2016, pris: 380 },
      { navn: 'Marqués de Riscal', type: 'Rødvin', kategori: 'Rødvin', land: 'Spanien', region: 'Rioja', drue: 'Tempranillo', årgang: 2017, pris: 180 },
      { navn: 'La Rioja Alta', type: 'Rødvin', kategori: 'Rødvin', land: 'Spanien', region: 'Rioja', drue: 'Tempranillo', årgang: 2015, pris: 220 },
      { navn: 'Pesquera', type: 'Rødvin', kategori: 'Rødvin', land: 'Spanien', region: 'Ribera del Duero', drue: 'Tempranillo', årgang: 2018, pris: 150 },
      { navn: 'Albariño', type: 'Hvidvin', kategori: 'Hvidvin', land: 'Spanien', region: 'Rías Baixas', drue: 'Albariño', årgang: 2019, pris: 120 },
      // Tyskland
      { navn: 'Riesling Trocken', type: 'Hvidvin', kategori: 'Hvidvin', land: 'Tyskland', region: 'Mosel', drue: 'Riesling', årgang: 2019, pris: 95 },
      { navn: 'Riesling Spätlese', type: 'Hvidvin', kategori: 'Hvidvin', land: 'Tyskland', region: 'Rheingau', drue: 'Riesling', årgang: 2018, pris: 120 },
      { navn: 'Gewürztraminer', type: 'Hvidvin', kategori: 'Hvidvin', land: 'Tyskland', region: 'Pfalz', drue: 'Gewürztraminer', årgang: 2019, pris: 85 },
      // Portugal
      { navn: 'Porto Vintage', type: 'Dessertvin', kategori: 'Dessertvin', land: 'Portugal', region: 'Douro', drue: 'Touriga Nacional', årgang: 2017, pris: 280 },
      { navn: 'Graham\'s Port', type: 'Dessertvin', kategori: 'Dessertvin', land: 'Portugal', region: 'Douro', drue: 'Touriga Nacional', årgang: 2016, pris: 220 },
      // USA - California
      { navn: 'Opus One', type: 'Rødvin', kategori: 'Rødvin', land: 'USA', region: 'Napa Valley', drue: 'Cabernet Sauvignon', årgang: 2017, pris: 450 },
      { navn: 'Screaming Eagle', type: 'Rødvin', kategori: 'Rødvin', land: 'USA', region: 'Napa Valley', drue: 'Cabernet Sauvignon', årgang: 2018, pris: 650 },
      { navn: 'Caymus', type: 'Rødvin', kategori: 'Rødvin', land: 'USA', region: 'Napa Valley', drue: 'Cabernet Sauvignon', årgang: 2017, pris: 320 },
      { navn: 'Silver Oak', type: 'Rødvin', kategori: 'Rødvin', land: 'USA', region: 'Napa Valley', drue: 'Cabernet Sauvignon', årgang: 2016, pris: 280 },
      { navn: 'Chardonnay Napa', type: 'Hvidvin', kategori: 'Hvidvin', land: 'USA', region: 'Napa Valley', drue: 'Chardonnay', årgang: 2019, pris: 180 },
      // Australien
      { navn: 'Penfolds Grange', type: 'Rødvin', kategori: 'Rødvin', land: 'Australien', region: 'South Australia', drue: 'Shiraz', årgang: 2016, pris: 550 },
      { navn: 'Henschke Hill of Grace', type: 'Rødvin', kategori: 'Rødvin', land: 'Australien', region: 'South Australia', drue: 'Shiraz', årgang: 2017, pris: 480 },
      { navn: 'Shiraz Barossa', type: 'Rødvin', kategori: 'Rødvin', land: 'Australien', region: 'Barossa Valley', drue: 'Shiraz', årgang: 2018, pris: 150 },
      { navn: 'Chardonnay Yarra Valley', type: 'Hvidvin', kategori: 'Hvidvin', land: 'Australien', region: 'Yarra Valley', drue: 'Chardonnay', årgang: 2019, pris: 120 },
      // Chile
      { navn: 'Almaviva', type: 'Rødvin', kategori: 'Rødvin', land: 'Chile', region: 'Maipo Valley', drue: 'Cabernet Sauvignon', årgang: 2017, pris: 280 },
      { navn: 'Don Melchor', type: 'Rødvin', kategori: 'Rødvin', land: 'Chile', region: 'Maipo Valley', drue: 'Cabernet Sauvignon', årgang: 2018, pris: 220 },
      { navn: 'Carmenère', type: 'Rødvin', kategori: 'Rødvin', land: 'Chile', region: 'Colchagua Valley', drue: 'Carmenère', årgang: 2017, pris: 95 },
      // Argentina
      { navn: 'Catena Zapata', type: 'Rødvin', kategori: 'Rødvin', land: 'Argentina', region: 'Mendoza', drue: 'Malbec', årgang: 2018, pris: 180 },
      { navn: 'Malbec Reserva', type: 'Rødvin', kategori: 'Rødvin', land: 'Argentina', region: 'Mendoza', drue: 'Malbec', årgang: 2017, pris: 120 },
      // Sydafrika
      { navn: 'Kanonkop Pinotage', type: 'Rødvin', kategori: 'Rødvin', land: 'Sydafrika', region: 'Stellenbosch', drue: 'Pinotage', årgang: 2018, pris: 150 },
      { navn: 'Chenin Blanc', type: 'Hvidvin', kategori: 'Hvidvin', land: 'Sydafrika', region: 'Stellenbosch', drue: 'Chenin Blanc', årgang: 2019, pris: 95 },
      // Danmark
      { navn: 'Dansk Riesling', type: 'Hvidvin', kategori: 'Hvidvin', land: 'Danmark', region: 'Sjælland', drue: 'Riesling', årgang: 2019, pris: 180 },
      { navn: 'Dansk Solaris', type: 'Hvidvin', kategori: 'Hvidvin', land: 'Danmark', region: 'Fyn', drue: 'Solaris', årgang: 2019, pris: 150 },
      { navn: 'Dansk Rondo', type: 'Rødvin', kategori: 'Rødvin', land: 'Danmark', region: 'Sjælland', drue: 'Rondo', årgang: 2018, pris: 120 },
    ];

    // Lokationer
    const locations = ['Restaurant 1', 'Restaurant 2', 'Vinlager 1', 'Vinlager 2', 'Vinkøler 1', 'Vinkøler 2'];

    // Generer data med headers
    const headers = [
      'vinId',
      'varenummer',
      'navn',
      'type',
      'kategori',
      'land',
      'region',
      'drue',
      'årgang',
      'lokation',
      'reol',
      'hylde',
      'antal',
      'minAntal',
      'indkøbspris'
    ];

    const templateData = [headers];
    
    let vinIdCounter = 1;
    let varenummerCounter = 1;

    // Fordel vine på forskellige lokationer
    wines.forEach((wine, index) => {
      const location = locations[index % locations.length];
      const reol = String.fromCharCode(65 + (index % 6)); // A, B, C, D, E, F
      const hylde = (index % 4) + 1; // 1, 2, 3, 4
      const antal = 24 + Math.floor(Math.random() * 48); // 24-72 flasker
      
      templateData.push([
        `VIN-${String(vinIdCounter).padStart(4, '0')}`,
        `W${String(varenummerCounter).padStart(3, '0')}`,
        wine.navn,
        wine.type,
        wine.kategori,
        wine.land,
        wine.region,
        wine.drue,
        wine.årgang,
        location,
        reol,
        hylde,
        antal,
        24,
        wine.pris.toFixed(2).replace('.', ',')
      ]);
      
      vinIdCounter++;
      varenummerCounter++;
      
      // Nogle vine skal have flere lokationer (ca. 20% af vine)
      if (Math.random() < 0.2 && index < wines.length - 5) {
        const secondLocation = locations[(index + 3) % locations.length];
        const secondReol = String.fromCharCode(65 + ((index + 2) % 6));
        const secondHylde = ((index + 1) % 4) + 1;
        const secondAntal = 24 + Math.floor(Math.random() * 24);
        
        templateData.push([
          `VIN-${String(vinIdCounter - 1).padStart(4, '0')}`, // Samme vinId
          `W${String(varenummerCounter - 1).padStart(3, '0')}`, // Samme varenummer
          wine.navn,
          wine.type,
          wine.kategori,
          wine.land,
          wine.region,
          wine.drue,
          wine.årgang,
          secondLocation,
          secondReol,
          secondHylde,
          secondAntal,
          24,
          wine.pris.toFixed(2).replace('.', ',')
        ]);
      }
    });

    // Opret Excel workbook
    const workbook = XLSX.utils.book_new();
    
    // Konverter til Excel format
    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    
    // Sæt kolonne bredder
    worksheet['!cols'] = [
      { wch: 12 }, // vinId
      { wch: 12 }, // varenummer
      { wch: 35 }, // navn
      { wch: 15 }, // type
      { wch: 15 }, // kategori
      { wch: 15 }, // land
      { wch: 20 }, // region
      { wch: 20 }, // drue
      { wch: 8 },  // årgang
      { wch: 15 }, // lokation
      { wch: 6 },  // reol
      { wch: 6 },  // hylde
      { wch: 8 },  // antal
      { wch: 8 },  // minAntal
      { wch: 12 }  // indkøbspris
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vinlager');

    // Generer Excel buffer med UTF-8 encoding
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      cellStyles: true,
      codepage: 65001 // UTF-8 encoding for korrekt håndtering af æ, ø, å
    });

    // Send som download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'vinlager_skabelon.xlsx');
    res.send(excelBuffer);

  } catch (error) {
    console.error('Template download fejl:', error);
    res.status(500).json({ 
      error: error.message || 'Ukendt fejl ved download af skabelon',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Export til CSV med lokation
exports.exportCSV = async (req, res) => {
  try {
    // Hent alle vine med deres inventory data (inkl. lokation)
    const query = `
      SELECT 
        w.vinId,
        w.varenummer,
        w.navn,
        w.type,
        w.kategori,
        w.land,
        w.region,
        w.drue,
        w.årgang,
        w.indkøbspris,
        l.name as lokation,
        i.reol,
        i.hylde,
        i.antal,
        i.minAntal
      FROM wines w
      INNER JOIN inventory i ON w.id = i.wine_id
      INNER JOIN locations l ON i.location_id = l.id
      ORDER BY w.navn, l.name, i.reol, i.hylde
    `;

    const rows = await new Promise((resolve, reject) => {
      db.all(query, [], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ingen data at eksportere' });
    }

    // Opret CSV header
    const headers = ['vinId', 'varenummer', 'navn', 'type', 'kategori', 'land', 'region', 'drue', 'årgang', 'lokation', 'reol', 'hylde', 'antal', 'minAntal', 'indkøbspris'];
    let csv = headers.join(';') + '\n';

    // Tilføj rækker
    rows.forEach(row => {
      const values = [
        row.vinId || '',
        row.varenummer || '',
        row.navn || '',
        row.type || '',
        row.kategori || '',
        row.land || '',
        row.region || '',
        row.drue || '',
        row.årgang || '',
        row.lokation || '',
        row.reol || '',
        row.hylde || '',
        row.antal || 0,
        row.minAntal || 24,
        row.indkøbspris || ''
      ];
      csv += values.join(';') + '\n';
    });

    // Send som download med UTF-8 BOM for korrekt encoding i Excel
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'vinlager_export.csv');
    res.send('\ufeff' + csv); // BOM for UTF-8 i Excel

  } catch (error) {
    console.error('CSV export fejl:', error);
    res.status(500).json({ 
      error: error.message || 'Ukendt fejl ved CSV export',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
