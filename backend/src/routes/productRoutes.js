const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', ProductController.list);
router.get('/check-code', ProductController.checkCodeAvailability);
router.get('/qr/:token', ProductController.getByQrToken);
router.get('/:id', ProductController.getById);
router.post('/', requireAdmin, ProductController.create);
router.put('/:id', requireAdmin, ProductController.update);
router.delete('/:id', requireAdmin, ProductController.remove);

module.exports = router;
