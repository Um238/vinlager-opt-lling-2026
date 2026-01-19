const express = require('express');
const router = express.Router();
const winesController = require('../controllers/wines.controller');
const upload = require('../utils/upload');

router.get('/', winesController.getAll);
router.get('/:vinId', winesController.getByVinId);
router.post('/', winesController.create);
router.put('/:vinId', winesController.update);
router.delete('/:vinId', winesController.delete);
router.post('/:vinId/image', upload.single('billede'), winesController.uploadImage);

module.exports = router;
