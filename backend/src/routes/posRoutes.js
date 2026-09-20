const express = require('express');
const router = express.Router();
const PosController = require('../controllers/posController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/validate-stock', PosController.validateStock);
router.post('/checkout', PosController.checkout);

module.exports = router;
