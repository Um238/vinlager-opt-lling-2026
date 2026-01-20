const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Simpel login funktion
exports.login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Brugernavn og password er påkrævet' 
    });
  }

  // Find bruger i database
  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    (err, user) => {
      if (err) {
        console.error('Database fejl:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Server fejl' 
        });
      }

      if (!user) {
        return res.status(401).json({ 
          success: false, 
          error: 'Brugernavn eller password forkert' 
        });
      }

      // Tjek password (hvis password_hash findes)
      if (user.password_hash) {
        bcrypt.compare(password, user.password_hash, (err, match) => {
          if (err) {
            console.error('Password check fejl:', err);
            return res.status(500).json({ 
              success: false, 
              error: 'Server fejl' 
            });
          }

          if (!match) {
            return res.status(401).json({ 
              success: false, 
              error: 'Brugernavn eller password forkert' 
            });
          }

          // Generer JWT token
          const token = jwt.sign(
            { 
              id: user.id, 
              username: user.username, 
              role: user.role 
            },
            process.env.JWT_SECRET || 'din-hemmelige-nøgle-ændr-dette',
            { expiresIn: '24h' }
          );

          // Returner success (uden password)
          res.json({
            success: true,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role
            },
            token
          });
        });
      } else {
        // Hvis bruger ikke har password_hash endnu, returner fejl
        return res.status(401).json({ 
          success: false, 
          error: 'Brugernavn eller password forkert' 
        });
      }
    }
  );
};
