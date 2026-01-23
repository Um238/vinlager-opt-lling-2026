const db = require('../config/database');
const path = require('path');

// Hent alle vine med lokation data (fra inventory system)
exports.getAll = (req, res) => {
  const { reol, hylde, location } = req.query;
  
  // Hent alle vine med deres inventory data (inkl. lokation)
  let query = `
    SELECT 
      w.id,
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
      w.billede,
      w.oprettet,
      w.opdateret,
      l.name as lokation,
      i.reol,
      i.hylde,
      i.antal,
      i.minAntal
    FROM wines w
    INNER JOIN inventory i ON w.id = i.wine_id
    INNER JOIN locations l ON i.location_id = l.id
    WHERE 1=1
  `;
  const params = [];

  if (reol) {
    query += ' AND i.reol = ?';
    params.push(reol);
  }
  if (hylde) {
    query += ' AND i.hylde = ?';
    params.push(hylde);
  }
  if (location) {
    query += ' AND l.name = ?';
    params.push(location);
  }

  query += ' ORDER BY w.navn, l.name, i.reol, i.hylde';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Fejl ved hentning af vine:', err);
      return res.status(500).json({ error: 'Fejl ved hentning af vine' });
    }
    res.json(rows);
  });
};

// Hent vin efter vinId eller varenummer (med lokation data)
exports.getByVinId = (req, res) => {
  const { vinId } = req.params;
  
  // Søg først på vinId med inventory data
  let query = `
    SELECT 
      w.id,
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
      w.billede,
      w.oprettet,
      w.opdateret,
      l.name as lokation,
      i.reol,
      i.hylde,
      i.antal,
      i.minAntal,
      i.location_id
    FROM wines w
    LEFT JOIN inventory i ON w.id = i.wine_id
    LEFT JOIN locations l ON i.location_id = l.id
    WHERE w.vinId = ?
    LIMIT 1
  `;
  
  db.get(query, [vinId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Fejl ved hentning af vin' });
    }
    
    if (row) {
      // Hvis der ikke er inventory data, prøv at finde første inventory record for denne vin
      if (!row.lokation) {
        db.get(`
          SELECT 
            l.name as lokation,
            i.reol,
            i.hylde,
            i.antal,
            i.minAntal,
            i.location_id
          FROM inventory i
          LEFT JOIN locations l ON i.location_id = l.id
          WHERE i.wine_id = ?
          LIMIT 1
        `, [row.id], (err2, invRow) => {
          if (!err2 && invRow) {
            Object.assign(row, invRow);
          }
          return res.json(row);
        });
      } else {
        return res.json(row);
      }
      return;
    }
    
    // Hvis ikke fundet på vinId, prøv varenummer
    query = `
      SELECT 
        w.id,
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
        w.billede,
        w.oprettet,
        w.opdateret,
        l.name as lokation,
        i.reol,
        i.hylde,
        i.antal,
        i.minAntal,
        i.location_id
      FROM wines w
      LEFT JOIN inventory i ON w.id = i.wine_id
      LEFT JOIN locations l ON i.location_id = l.id
      WHERE w.varenummer = ?
      LIMIT 1
    `;
    
    db.get(query, [vinId], (err, row2) => {
      if (err) {
        return res.status(500).json({ error: 'Fejl ved hentning af vin' });
      }
      if (!row2) {
        return res.status(404).json({ error: 'Vin ikke fundet (søgte på VIN-ID og varenummer)' });
      }
      
      // Hvis der ikke er inventory data, prøv at finde første inventory record
      if (!row2.lokation) {
        db.get(`
          SELECT 
            l.name as lokation,
            i.reol,
            i.hylde,
            i.antal,
            i.minAntal,
            i.location_id
          FROM inventory i
          LEFT JOIN locations l ON i.location_id = l.id
          WHERE i.wine_id = ?
          LIMIT 1
        `, [row2.id], (err3, invRow) => {
          if (!err3 && invRow) {
            Object.assign(row2, invRow);
          }
          return res.json(row2);
        });
      } else {
        return res.json(row2);
      }
    });
  });
};

// Opret ny vin
exports.create = (req, res) => {
  const wine = req.body;

  // Valider påkrævede felter
  if (!wine.vinId || !wine.navn) {
    return res.status(400).json({ error: 'vinId og navn er påkrævet' });
  }

  const query = `
    INSERT INTO wines (
      vinId, varenummer, navn, type, kategori, land, region, drue, 
      årgang, reol, hylde, antal, minAntal, indkøbspris, billede
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    wine.vinId,
    wine.varenummer || null,
    wine.navn,
    wine.type || null,
    wine.kategori || wine.type || null,
    wine.land || null,
    wine.region || null,
    wine.drue || null,
    wine.årgang || null,
    wine.reol || null,
    wine.hylde || null,
    wine.antal || 0,
    wine.minAntal || 24, // Standard minimum er 24 flasker
    wine.indkøbspris || null,
    wine.billede || null
  ], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: 'VinId findes allerede' });
      }
      return res.status(500).json({ error: 'Fejl ved oprettelse af vin' });
    }
    res.status(201).json({ id: this.lastID, vinId: wine.vinId });
  });
};

// Opdater vin
exports.update = (req, res) => {
  const { vinId } = req.params;
  const wine = req.body;

  const query = `
    UPDATE wines SET
      varenummer = ?, navn = ?, type = ?, kategori = ?, land = ?, region = ?,
      drue = ?, årgang = ?, reol = ?, hylde = ?, antal = ?, minAntal = ?,
      indkøbspris = ?, billede = ?, opdateret = CURRENT_TIMESTAMP
    WHERE vinId = ?
  `;

  db.run(query, [
    wine.varenummer || null,
    wine.navn,
    wine.type || null,
    wine.kategori || wine.type || null,
    wine.land || null,
    wine.region || null,
    wine.drue || null,
    wine.årgang || null,
    wine.reol || null,
    wine.hylde || null,
    wine.antal !== undefined ? wine.antal : null,
    wine.minAntal !== undefined ? wine.minAntal : null,
    wine.indkøbspris || null,
    wine.billede || null,
    vinId
  ], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Fejl ved opdatering af vin' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Vin ikke fundet' });
    }
    res.json({ message: 'Vin opdateret', changes: this.changes });
  });
};

// Slet vin
exports.delete = (req, res) => {
  const { vinId } = req.params;
  db.run('DELETE FROM wines WHERE vinId = ?', [vinId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Fejl ved sletning af vin' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Vin ikke fundet' });
    }
    res.json({ message: 'Vin slettet' });
  });
};

// Upload billede
exports.uploadImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Intet billede uploadet' });
  }

  const { vinId } = req.params;
  const imageFilename = req.file.filename;
  
  console.log('Upload billede:', {
    vinId: vinId,
    filename: imageFilename,
    path: req.file.path,
    size: req.file.size
  });

  // Tjek om filen faktisk eksisterer
  const fs = require('fs');
  if (!fs.existsSync(req.file.path)) {
    console.error('Billedfil eksisterer ikke:', req.file.path);
    return res.status(500).json({ error: 'Billedfil kunne ikke gemmes' });
  }

  db.run(
    'UPDATE wines SET billede = ? WHERE vinId = ?',
    [imageFilename, vinId],
    function(err) {
      if (err) {
        console.error('Database fejl:', err);
        return res.status(500).json({ error: 'Fejl ved opdatering af billede' });
      }
      console.log('Billede opdateret i database:', imageFilename);
      res.json({ message: 'Billede uploadet', filename: imageFilename });
    }
  );
};
