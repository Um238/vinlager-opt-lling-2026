const express = require('express');
const router = express.Router();
const importController = require('../controllers/import.controller');
const { importUpload } = require('../utils/upload');

// Import routes
router.post('/csv', importUpload.single('file'), importController.importCSV);
router.post('/excel', importUpload.single('file'), importController.importExcel);

// Export routes
router.get('/csv', importController.exportCSV);
router.get('/excel', importController.exportExcel);

// Download template route
router.get('/template', importController.downloadTemplate);

module.exports = router;
