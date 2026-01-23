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
async function importData(rows, mode) {
  const results = {
    importeret: 0,
    opdateret: 0,
    fejl: []
  };

  // Mode 1: Overskriv hele lageret
  if (mode === 'overskriv') {
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM inventory', (err) => {
        if (err) return reject(err);
        db.run('DELETE FROM wines', (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
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
      
      // 2. Find eller opret lokation
      const locationId = await findOrCreateLocation(locationName, 'Vin');
      
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

  const { mode } = req.body; // overskriv, tilføj, opdater

  if (!['overskriv', 'tilføj', 'opdater'].includes(mode)) {
    return res.status(400).json({ error: 'Ugyldig mode. Brug: overskriv, tilføj eller opdater' });
  }

  try {
    const rows = parseCSV(req.file.path);
    const results = await importData(rows, mode);

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

  const { mode } = req.body; // overskriv, tilføj, opdater

  if (!['overskriv', 'tilføj', 'opdater'].includes(mode)) {
    return res.status(400).json({ error: 'Ugyldig mode. Brug: overskriv, tilføj eller opdater' });
  }

  try {
    console.log('Excel import starter...', {
      filename: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const rows = parseExcel(req.file.path);
    console.log(`Excel fil parsed: ${rows.length} rækker fundet`);
    
    if (rows.length === 0) {
      throw new Error('Excel filen indeholder ingen data. Tjek at der er data under header-rækken.');
    }

    const results = await importData(rows, mode);

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

// Download Excel skabelon (tom skabelon med korrekt kolonne rækkefølge)
exports.downloadTemplate = async (req, res) => {
  try {
    // Opret tom Excel skabelon med korrekt kolonne rækkefølge
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

    // Opret tom data array med kun headers
    const templateData = [headers];

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
