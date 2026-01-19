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
      const kroner = Math.floor(totalVærdi);
      const øre = Math.round((totalVærdi - kroner) * 100);

      res.json({
        vine: rows,
        total: {
          værdi: totalVærdi,
          kroner: kroner,
          øre: øre,
          formateret: `${kroner} kr. og ${øre} øre`
        }
      });
    }
  );
};
