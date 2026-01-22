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
        minAntal INTEGER DEFAULT 24,
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

    // Lokationer (Vinlager, Vinkøler, Bar 1, Restaurant 1, etc.)
    db.run(`
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        category TEXT DEFAULT 'Vin',
        description TEXT,
        oprettet TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Inventory (lagerbeholdning per lokation)
    // En vin kan stå flere steder - hver kombination af vin + lokation = én række
    db.run(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wine_id INTEGER NOT NULL,
        location_id INTEGER NOT NULL,
        reol TEXT,
        hylde TEXT,
        antal INTEGER DEFAULT 0,
        minAntal INTEGER DEFAULT 24,
        oprettet TEXT DEFAULT CURRENT_TIMESTAMP,
        opdateret TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wine_id) REFERENCES wines(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
        UNIQUE(wine_id, location_id, reol, hylde)
      )
    `);

    // Rapporter historik
    db.run(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reportId TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        wineCount INTEGER DEFAULT 0,
        totalValue DECIMAL(10, 2) DEFAULT 0,
        location TEXT,
        archived INTEGER DEFAULT 0,
        created TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_wines_vinId ON wines(vinId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_wines_reol_hylde ON wines(reol, hylde)');
    db.run('CREATE INDEX IF NOT EXISTS idx_counts_vinId ON counts(vinId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name)');
    db.run('CREATE INDEX IF NOT EXISTS idx_locations_category ON locations(category)');
    db.run('CREATE INDEX IF NOT EXISTS idx_inventory_wine_id ON inventory(wine_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_inventory_location_id ON inventory(location_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_inventory_wine_location ON inventory(wine_id, location_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_reports_reportId ON reports(reportId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created)');

    console.log('Database initialiseret');
    
    // Opret standard admin bruger hvis ingen brugere findes
    createDefaultAdmin();
  });
}

// Opret standard admin bruger (kun hvis ingen brugere findes)
function createDefaultAdmin() {
  const bcrypt = require('bcryptjs');
  
  // Tjek om der allerede er brugere
  db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
    if (err) {
      console.error('Fejl ved tjek af brugere:', err);
      return;
    }
    
    // Hvis der allerede er brugere, skip
    if (result.count > 0) {
      console.log('Brugere findes allerede i databasen');
      return;
    }
    
    // Opret standard admin bruger
    const defaultPassword = 'admin123';
    bcrypt.hash(defaultPassword, 10, (err, hash) => {
      if (err) {
        console.error('Fejl ved hashing af password:', err);
        return;
      }
      
      db.run(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES (?, ?, ?, ?)`,
        ['admin', 'admin@vinlager.dk', hash, 'admin'],
        function(err) {
          if (err) {
            console.error('Fejl ved oprettelse af admin bruger:', err);
          } else {
            console.log('✅ Standard admin bruger oprettet');
            console.log('   Brugernavn: admin');
            console.log('   Password: admin123');
            console.log('   ⚠️  VIGTIGT: Skift password efter første login!');
          }
        }
      );
    });
  });
}

module.exports = db;
