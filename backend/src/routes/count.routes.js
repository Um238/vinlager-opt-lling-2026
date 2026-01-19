const express = require('express');
const router = express.Router();
const countController = require('../controllers/count.controller');

router.post('/:vinId', countController.updateCount);
router.get('/history/:vinId', countController.getHistory);

module.exports = router;
