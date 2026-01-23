const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
const uploadsPath = path.join(__dirname, '../uploads');
console.log('Serving uploads from:', uploadsPath);
app.use('/uploads', express.static(uploadsPath));

// Routes
const winesRoutes = require('./routes/wines.routes');
const importRoutes = require('./routes/import.routes');
const countRoutes = require('./routes/count.routes');
const reportsRoutes = require('./routes/reports.routes');
const authRoutes = require('./routes/auth.routes');
const locationsRoutes = require('./routes/locations.routes');

app.use('/api/wines', winesRoutes);
app.use('/api/import', importRoutes);
app.use('/api/count', countRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Vinlager API kører' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server fejl:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Intern server fejl'
  });
});

module.exports = app;
