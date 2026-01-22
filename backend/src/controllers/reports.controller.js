const db = require('../config/database');

// Lagerrapport
exports.getLagerReport = (req, res) => {
  db.all(
    `SELECT 
      vinId, navn, type, land, region, årgang, reol, hylde, 
      antal, minAntal, indkøbspris, 
      CASE WHEN antal < minAntal THEN 1 ELSE 0 END as lavtLager
    FROM wines 
    ORDER BY reol, hylde, navn`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Fejl ved hentning af rapport' });
      }
      res.json(rows);
    }
  );
};

// Værdirapport
exports.getVærdiReport = (req, res) => {
  db.all(
    `SELECT 
      vinId, navn, antal, indkøbspris,
      (antal * COALESCE(indkøbspris, 0)) as værdi
    FROM wines
    ORDER BY værdi DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Fejl ved hentning af værdirapport' });
      }

      // Beregn total værdi
      const totalVærdi = rows.reduce((sum, row) => sum + (row.værdi || 0), 0);
      
      // Formatér i dansk format (punktum som tusindseperator, komma som decimalseparator)
      // Eksempel: 137505.00 -> "137.505,00"
      const parts = totalVærdi.toFixed(2).split('.');
      const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const decimalPart = parts[1] || '00';
      const formateret = `${integerPart},${decimalPart}`;

      res.json({
        vine: rows,
        total: {
          værdi: totalVærdi,
          formateret: `${formateret} kr.`
        }
      });
    }
  );
};

// Gem rapport i historik
exports.saveReport = (req, res) => {
  const { reportId, name, type, wineCount, totalValue, location } = req.body;
  
  if (!reportId || !name || !type) {
    return res.status(400).json({ error: 'Manglende påkrævede felter' });
  }
  
  db.run(
    `INSERT OR REPLACE INTO reports (reportId, name, type, wineCount, totalValue, location, archived, created)
     VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now', 'localtime'))`,
    [reportId, name, type, wineCount || 0, totalValue || 0, location || 'Lokal'],
    function(err) {
      if (err) {
        console.error('Fejl ved gemning af rapport:', err);
        return res.status(500).json({ error: 'Fejl ved gemning af rapport' });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
};

// Hent rapport historik
exports.getReportsHistory = (req, res) => {
  // Hent alle rapporter (både arkiverede og ikke-arkiverede)
  // Frontend filtrerer selv baseret på brugervalg
  db.all(
    `SELECT 
      reportId as id,
      name,
      type,
      wineCount,
      totalValue,
      location,
      archived,
      created as date
    FROM reports 
    ORDER BY created DESC
    LIMIT 100`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Fejl ved hentning af rapport historik:', err);
        return res.status(500).json({ error: 'Fejl ved hentning af rapport historik' });
      }
      res.json(rows);
    }
  );
};

// Opdater rapport (fx arkivering)
exports.updateReport = (req, res) => {
  const { reportId } = req.params;
  const { archived } = req.body;
  
  if (!reportId) {
    return res.status(400).json({ error: 'Manglende reportId' });
  }
  
  db.run(
    `UPDATE reports SET archived = ? WHERE reportId = ?`,
    [archived ? 1 : 0, reportId],
    function(err) {
      if (err) {
        console.error('Fejl ved opdatering af rapport:', err);
        return res.status(500).json({ error: 'Fejl ved opdatering af rapport' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Rapport ikke fundet' });
      }
      res.json({ success: true, changes: this.changes });
    }
  );
};
