const express = require('express');
const router = express.Router();
const InvoiceController = require('../controllers/invoiceController');
const { authenticateToken, requireSuperAdmin, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', InvoiceController.list);
router.get('/:id', InvoiceController.getById);
router.put('/:id/adjust', requireSuperAdmin, InvoiceController.adjust);
router.put('/:id/payment', requireAdmin, InvoiceController.updatePayment);

module.exports = router;
