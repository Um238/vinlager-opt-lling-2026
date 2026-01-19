const db = require('../config/database');
const path = require('path');

// Hent alle vine
exports.getAll = (req, res) => {
  const { reol, hylde } = req.query;
  let query = 'SELECT * FROM wines WHERE 1=1';
  const params = [];

  if (reol) {
    query += ' AND reol = ?';
    params.push(reol);
  }
  if (hylde) {
    query += ' AND hylde = ?';
    params.push(hylde);
  }

  query += ' ORDER BY reol, hylde, navn';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Fejl ved hentning af vine' });
    }
    res.json(rows);
  });
};

// Hent vin efter vinId
exports.getByVinId = (req, res) => {
  const { vinId } = req.params;
  db.get('SELECT * FROM wines WHERE vinId = ?', [vinId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Fejl ved hentning af vin' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Vin ikke fundet' });
    }
    res.json(row);
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
    wine.minAntal || 0,
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
  const imagePath = `/uploads/images/${req.file.filename}`;

  db.run(
    'UPDATE wines SET billede = ? WHERE vinId = ?',
    [imagePath, vinId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Fejl ved opdatering af billede' });
      }
      res.json({ message: 'Billede uploadet', path: imagePath });
    }
  );
};
