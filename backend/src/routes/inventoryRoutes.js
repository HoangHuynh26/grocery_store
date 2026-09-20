const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/inventoryController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', InventoryController.getStatus);
router.get('/transactions', InventoryController.getHistory);
router.post('/import', requireAdmin, InventoryController.importGoods);
router.post('/adjust', requireAdmin, InventoryController.adjust);

module.exports = router;
