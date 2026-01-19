const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');

router.get('/lager', reportsController.getLagerReport);
router.get('/værdi', reportsController.getVærdiReport);

module.exports = router;
