const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const categoryRoutes = require('./categoryRoutes');
const productRoutes = require('./productRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const posRoutes = require('./posRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const auditRoutes = require('./auditRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const aiRoutes = require('./aiRoutes');

// API Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    system: 'Grocery Store Management & POS System',
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Ho_Chi_Minh'
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/pos', posRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/dashboard', analyticsRoutes);
router.use('/ai', aiRoutes);

module.exports = router;
