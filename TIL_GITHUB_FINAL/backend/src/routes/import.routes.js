const express = require('express');
const router = express.Router();
const importController = require('../controllers/import.controller');
const { importUpload } = require('../utils/upload');

router.post('/csv', importUpload.single('file'), importController.importCSV);
router.post('/excel', importUpload.single('file'), importController.importExcel);

module.exports = router;
