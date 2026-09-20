const express = require('express');
const router = express.Router();
const InvoiceController = require('../controllers/invoiceController');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', InvoiceController.list);
router.get('/:id', InvoiceController.getById);
router.put('/:id/adjust', requireSuperAdmin, InvoiceController.adjust);

module.exports = router;
