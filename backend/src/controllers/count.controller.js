const db = require('../config/database');

// Opdater antal (optælling) - Nu med lokationssupport
exports.updateCount = (req, res) => {
  const { vinId } = req.params;
  const { ændring, nytAntal, locationId, locationName } = req.body;

  // Hvis locationName er angivet, find location_id
  let finalLocationId = locationId;
  
  if (locationName && !locationId) {
    db.get('SELECT id FROM locations WHERE name = ?', [locationName], (err, location) => {
      if (err) {
        return res.status(500).json({ error: 'Fejl ved hentning af lokation' });
      }
      if (!location) {
        return res.status(404).json({ error: 'Lokation ikke fundet' });
      }
      finalLocationId = location.id;
      continueUpdateCount();
    });
  } else {
    continueUpdateCount();
  }

  function continueUpdateCount() {
    // Hent wine_id fra vinId
    db.get('SELECT id FROM wines WHERE vinId = ?', [vinId], (err, wine) => {
      if (err) {
        return res.status(500).json({ error: 'Fejl ved hentning af vin' });
      }
      if (!wine) {
        return res.status(404).json({ error: 'Vin ikke fundet' });
      }

      const wineId = wine.id;

      // Hvis locationId er angivet, brug inventory system
      if (finalLocationId) {
        // Hent nuværende antal fra inventory
        db.get(
          'SELECT antal FROM inventory WHERE wine_id = ? AND location_id = ?',
          [wineId, finalLocationId],
          (err, inventory) => {
            if (err) {
              return res.status(500).json({ error: 'Fejl ved hentning af lager' });
            }

            const forrigeAntal = inventory ? inventory.antal : 0;
            let nyVærdi;

            if (nytAntal !== undefined) {
              nyVærdi = parseInt(nytAntal);
            } else if (ændring !== undefined) {
              nyVærdi = forrigeAntal + parseInt(ændring);
            } else {
              return res.status(400).json({ error: 'Enten ændring eller nytAntal skal angives' });
            }

            // Opdater eller opret inventory
            if (inventory) {
              db.run(
                'UPDATE inventory SET antal = ?, opdateret = CURRENT_TIMESTAMP WHERE wine_id = ? AND location_id = ?',
                [nyVærdi, wineId, finalLocationId],
                function(updateErr) {
                  if (updateErr) {
                    return res.status(500).json({ error: 'Fejl ved opdatering af lager' });
                  }
                  logCountAndRespond();
                }
              );
            } else {
              // Opret ny inventory record
              db.run(
                'INSERT INTO inventory (wine_id, location_id, antal) VALUES (?, ?, ?)',
                [wineId, finalLocationId, nyVærdi],
                function(insertErr) {
                  if (insertErr) {
                    return res.status(500).json({ error: 'Fejl ved oprettelse af lager' });
                  }
                  logCountAndRespond();
                }
              );
            }

            function logCountAndRespond() {
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
                locationId: finalLocationId,
                forrigeAntal,
                nytAntal: nyVærdi,
                ændring: ændringVærdi
              });
            }
          }
        );
      } else {
        // KRITISK FIX: Hvis ingen locationId, find eller opret en default lokation
        // Først prøv at finde en eksisterende lokation (fx "Lokal" eller første lokation)
        db.get('SELECT id FROM locations ORDER BY id LIMIT 1', [], (err, defaultLocation) => {
          if (err) {
            console.error('Fejl ved hentning af default lokation:', err);
            // Hvis ingen lokationer findes, opdater wines direkte som fallback
            return updateWinesDirectly();
          }
          
          // Hvis der findes en lokation, brug den
          if (defaultLocation) {
            finalLocationId = defaultLocation.id;
            // Genkald continueUpdateCount med locationId
            continueUpdateCount();
          } else {
            // Ingen lokationer - opdater wines direkte
            updateWinesDirectly();
          }
        });
        
        function updateWinesDirectly() {
          // Fallback: Opdater wines tabel direkte (gammel metode - for bagudkompatibilitet)
          db.get('SELECT antal FROM wines WHERE vinId = ?', [vinId], (err, wine) => {
            if (err) {
              return res.status(500).json({ error: 'Fejl ved hentning af vin' });
            }

            const forrigeAntal = wine ? wine.antal : 0;
            let nyVærdi;

            if (nytAntal !== undefined) {
              nyVærdi = parseInt(nytAntal);
            } else if (ændring !== undefined) {
              nyVærdi = forrigeAntal + parseInt(ændring);
            } else {
              return res.status(400).json({ error: 'Enten ændring eller nytAntal skal angives' });
            }

            db.run(
              'UPDATE wines SET antal = ?, opdateret = CURRENT_TIMESTAMP WHERE vinId = ?',
              [nyVærdi, vinId],
              function(updateErr) {
                if (updateErr) {
                  return res.status(500).json({ error: 'Fejl ved opdatering af antal' });
                }

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
        }
      }
    });
  }
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
