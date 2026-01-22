const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');

router.get('/lager', reportsController.getLagerReport);
router.get('/værdi', reportsController.getVærdiReport);
router.post('/save', reportsController.saveReport);
router.get('/history', reportsController.getReportsHistory);
module.exports = router;

