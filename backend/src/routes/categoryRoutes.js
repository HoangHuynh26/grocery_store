const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/categoryController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', CategoryController.list);
router.post('/', requireAdmin, CategoryController.create);
router.put('/:id', requireAdmin, CategoryController.update);
router.delete('/:id', requireAdmin, CategoryController.remove);

module.exports = router;
