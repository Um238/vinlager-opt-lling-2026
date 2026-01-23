const db = require('../config/database');

// Hent alle lokationer
exports.getAll = (req, res) => {
  const { category } = req.query;
  
  let query = 'SELECT * FROM locations WHERE 1=1';
  const params = [];
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY name';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Fejl ved hentning af lokationer:', err);
      return res.status(500).json({ error: 'Fejl ved hentning af lokationer' });
    }
    res.json(rows);
  });
};

// Opret ny lokation
exports.create = (req, res) => {
  const { name, category, description } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Navn er påkrævet' });
  }
  
  db.run(
    'INSERT INTO locations (name, category, description) VALUES (?, ?, ?)',
    [name.trim(), category || 'Vin', description || null],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Lokation med dette navn findes allerede' });
        }
        console.error('Fejl ved oprettelse af lokation:', err);
        return res.status(500).json({ error: 'Fejl ved oprettelse af lokation' });
      }
      res.status(201).json({
        id: this.lastID,
        name: name.trim(),
        category: category || 'Vin',
        description: description || null
      });
    }
  );
};
