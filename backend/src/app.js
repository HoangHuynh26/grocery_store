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

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow localhost or undefined (e.g. curl/mobile apps/same origin)
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in dev, adjust as needed
    }
  },
  credentials: true
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
