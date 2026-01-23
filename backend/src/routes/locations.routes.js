const express = require('express');
const router = express.Router();
const locationsController = require('../controllers/locations.controller');

// Hent alle lokationer
router.get('/', locationsController.getAll);

// Opret ny lokation
router.post('/', locationsController.create);

module.exports = router;
