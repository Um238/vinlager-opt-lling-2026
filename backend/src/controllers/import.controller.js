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
    // Prøv først at læse som fil
    workbook = XLSX.readFile(filePath);
  } catch (err) {
    // Hvis det fejler, prøv at læse buffer
    const fileBuffer = fs.readFileSync(filePath);
    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  }
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  // Map til lowercase headers
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
    'antal': 'antal',
    'minantal': 'minAntal',
    'minimum': 'minAntal',
    'indkøbspris': 'indkøbspris',
    'pris': 'indkøbspris',
    'billede': 'billede'
  };

  return data.map(row => {
    const mappedRow = {};
    Object.keys(row).forEach(key => {
      const lowerKey = key.toLowerCase().trim();
      const mappedKey = headerMap[lowerKey] || lowerKey;
      mappedRow[mappedKey] = row[key];
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

// Importer data med valgt mode
function importData(rows, mode) {
  return new Promise((resolve, reject) => {
    const results = {
      importeret: 0,
      opdateret: 0,
      fejl: []
    };

    db.serialize(() => {
      // Mode 1: Overskriv hele lageret
      if (mode === 'overskriv') {
        db.run('DELETE FROM wines', (err) => {
          if (err) {
            return reject(new Error('Fejl ved sletning af eksisterende data'));
          }
          processRows();
        });
      } else {
        processRows();
      }

      function processRows() {
        let processed = 0;
        const total = rows.length;

        if (total === 0) {
          return resolve(results);
        }

        rows.forEach((row, index) => {
          // Generer vinId hvis mangler
          if (!row.vinId && row.navn) {
            row.vinId = generateVinId(row.navn);
          }

          if (!row.vinId) {
            results.fejl.push({ row: index + 2, error: 'Mangler vinId eller navn' });
            processed++;
            if (processed === total) resolve(results);
            return;
          }

          // Normaliser data
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
            reol: row.reol || null,
            hylde: row.hylde || null,
            antal: row.antal ? parseInt(row.antal) : 0,
            minAntal: row.minAntal ? parseInt(row.minAntal) : 0,
            indkøbspris: row.indkøbspris ? parseFloat(row.indkøbspris) : null,
            billede: row.billede || null
          };

          if (!wine.navn) {
            results.fejl.push({ row: index + 2, error: 'Navn er påkrævet' });
            processed++;
            if (processed === total) resolve(results);
            return;
          }

          // Check om vin findes
          db.get('SELECT vinId FROM wines WHERE vinId = ?', [wine.vinId], (err, existing) => {
            if (err) {
              results.fejl.push({ row: index + 2, error: err.message });
              processed++;
              if (processed === total) resolve(results);
              return;
            }

            if (existing) {
              // Mode 2: Tilføj - skip eksisterende
              if (mode === 'tilføj') {
                processed++;
                if (processed === total) resolve(results);
                return;
              }

              // Mode 3: Opdater - opdater eksisterende
              if (mode === 'opdater') {
                const updateQuery = `
                  UPDATE wines SET
                    varenummer = ?, navn = ?, type = ?, kategori = ?, land = ?,
                    region = ?, drue = ?, årgang = ?, reol = ?, hylde = ?,
                    antal = ?, minAntal = ?, indkøbspris = ?,
                    opdateret = CURRENT_TIMESTAMP
                  WHERE vinId = ?
                `;

                db.run(updateQuery, [
                  wine.varenummer, wine.navn, wine.type, wine.kategori,
                  wine.land, wine.region, wine.drue, wine.årgang,
                  wine.reol, wine.hylde, wine.antal, wine.minAntal,
                  wine.indkøbspris, wine.vinId
                ], (updateErr) => {
                  if (updateErr) {
                    results.fejl.push({ row: index + 2, error: updateErr.message });
                  } else {
                    results.opdateret++;
                  }
                  processed++;
                  if (processed === total) resolve(results);
                });
                return;
              }

              // Mode 1: Overskriv - erstatter
              const updateQuery = `
                UPDATE wines SET
                  varenummer = ?, navn = ?, type = ?, kategori = ?, land = ?,
                  region = ?, drue = ?, årgang = ?, reol = ?, hylde = ?,
                  antal = ?, minAntal = ?, indkøbspris = ?,
                  opdateret = CURRENT_TIMESTAMP
                WHERE vinId = ?
              `;

              db.run(updateQuery, [
                wine.varenummer, wine.navn, wine.type, wine.kategori,
                wine.land, wine.region, wine.drue, wine.årgang,
                wine.reol, wine.hylde, wine.antal, wine.minAntal,
                wine.indkøbspris, wine.vinId
              ], (updateErr) => {
                if (updateErr) {
                  results.fejl.push({ row: index + 2, error: updateErr.message });
                } else {
                  results.opdateret++;
                }
                processed++;
                if (processed === total) resolve(results);
              });
            } else {
              // Ny vin - indsæt
              const insertQuery = `
                INSERT INTO wines (
                  vinId, varenummer, navn, type, kategori, land, region, drue,
                  årgang, reol, hylde, antal, minAntal, indkøbspris, billede
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;

              db.run(insertQuery, [
                wine.vinId, wine.varenummer, wine.navn, wine.type, wine.kategori,
                wine.land, wine.region, wine.drue, wine.årgang,
                wine.reol, wine.hylde, wine.antal, wine.minAntal,
                wine.indkøbspris, wine.billede
              ], (insertErr) => {
                if (insertErr) {
                  results.fejl.push({ row: index + 2, error: insertErr.message });
                } else {
                  results.importeret++;
                }
                processed++;
                if (processed === total) resolve(results);
              });
            }
          });
        });
      }
    });
  });
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
    const rows = parseExcel(req.file.path);
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
