const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/env');
const routes = require('./routes');
const { errorHandler, AppError } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration: support Vercel domains, localhost, LAN IPs, and custom domains
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      config.corsOrigin,
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5000'
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    try {
      const parsed = new URL(origin);
      if (parsed.hostname.endsWith('.vercel.app') || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return callback(null, true);
      }
    } catch (e) {}

    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-idempotency-key', 'X-Forwarded-For']
}));

// Body parsing with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging (clean format)
if (config.nodeEnv !== 'test') {
  app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));
}

// Rate limiting for API requests
app.use('/api', apiLimiter);

// Root & Health Check for Cloud Load Balancers & Render
app.get(['/', '/health'], (req, res) => {
  res.status(200).json({
    status: 'healthy',
    system: 'Grocery Store Management & POS System Backend',
    version: '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// Serve uploads if any
const uploadDir = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadDir));

// Mount main API
app.use('/api', routes);

// 404 Handler for unmatched routes
app.use((req, res, next) => {
  next(new AppError(`Không tìm thấy đường dẫn: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
});

// Global Centralized Error Handler
app.use(errorHandler);

module.exports = app;
