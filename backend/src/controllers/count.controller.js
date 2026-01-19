const db = require('../config/database');

// Opdater antal (optælling)
exports.updateCount = (req, res) => {
  const { vinId } = req.params;
  const { ændring, nytAntal } = req.body;

  // Hent nuværende antal
  db.get('SELECT antal FROM wines WHERE vinId = ?', [vinId], (err, wine) => {
    if (err) {
      return res.status(500).json({ error: 'Fejl ved hentning af vin' });
    }
    if (!wine) {
      return res.status(404).json({ error: 'Vin ikke fundet' });
    }

    const forrigeAntal = wine.antal;
    let nyVærdi;

    if (nytAntal !== undefined) {
      // Direkte antal angivet
      nyVærdi = parseInt(nytAntal);
    } else if (ændring !== undefined) {
      // Relativ ændring (+1, -1, etc.)
      nyVærdi = forrigeAntal + parseInt(ændring);
    } else {
      return res.status(400).json({ error: 'Enten ændring eller nytAntal skal angives' });
    }

    // Opdater antal
    db.run(
      'UPDATE wines SET antal = ?, opdateret = CURRENT_TIMESTAMP WHERE vinId = ?',
      [nyVærdi, vinId],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Fejl ved opdatering af antal' });
        }

        // Log optælling
        const ændringVærdi = nyVærdi - forrigeAntal;
        db.run(
          'INSERT INTO counts (vinId, forrigeAntal, nytAntal, ændring) VALUES (?, ?, ?, ?)',
          [vinId, forrigeAntal, nyVærdi, ændringVærdi],
          (logErr) => {
            if (logErr) {
              console.error('Fejl ved logging:', logErr);
            }
          }
        );

        res.json({
          message: 'Antal opdateret',
          vinId,
          forrigeAntal,
          nytAntal: nyVærdi,
          ændring: ændringVærdi
        });
      }
    );
  });
};

// Hent optællingshistorik
exports.getHistory = (req, res) => {
  const { vinId } = req.params;
  db.all(
    'SELECT * FROM counts WHERE vinId = ? ORDER BY oprettet DESC LIMIT 50',
    [vinId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Fejl ved hentning af historik' });
      }
      res.json(rows);
    }
  );
};
