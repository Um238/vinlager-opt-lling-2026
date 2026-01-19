const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/vinlager.db');
const DB_DIR = path.dirname(DB_PATH);

// Opret data mappe hvis den ikke findes
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Fejl ved åbning af database:', err.message);
  } else {
    console.log('Forbundet til SQLite database:', DB_PATH);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Vine tabel - med alle felter fra datamodellen
    db.run(`
      CREATE TABLE IF NOT EXISTS wines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vinId TEXT UNIQUE NOT NULL,
        varenummer TEXT,
        navn TEXT NOT NULL,
        type TEXT,
        kategori TEXT,
        land TEXT,
        region TEXT,
        drue TEXT,
        årgang INTEGER,
        reol TEXT,
        hylde TEXT,
        antal INTEGER DEFAULT 0,
        minAntal INTEGER DEFAULT 0,
        indkøbspris DECIMAL(10, 2),
        billede TEXT,
        oprettet TEXT DEFAULT CURRENT_TIMESTAMP,
        opdateret TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Optællingshistorik
    db.run(`
      CREATE TABLE IF NOT EXISTS counts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vinId TEXT NOT NULL,
        forrigeAntal INTEGER,
        nytAntal INTEGER,
        ændring INTEGER,
        oprettet TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vinId) REFERENCES wines(vinId)
      )
    `);

    // Brugere (valgfri - for senere login)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        role TEXT DEFAULT 'user',
        must_change_password INTEGER DEFAULT 0,
        oprettet TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_wines_vinId ON wines(vinId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_wines_reol_hylde ON wines(reol, hylde)');
    db.run('CREATE INDEX IF NOT EXISTS idx_counts_vinId ON counts(vinId)');

    console.log('Database initialiseret');
  });
}

module.exports = db;
