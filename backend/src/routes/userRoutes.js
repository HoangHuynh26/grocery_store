const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireSuperAdmin);

router.get('/', UserController.list);
router.post('/', UserController.create);
router.put('/:id', UserController.update);
router.get('/login-logs/history', UserController.getLoginHistory);

module.exports = router;
