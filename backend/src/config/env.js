require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  timezone: process.env.TZ || 'Asia/Ho_Chi_Minh',
  databaseUrl: process.env.DATABASE_URL || 'embedded',
  databaseDataDir: process.env.DATABASE_DATA_DIR || './data/pgdata',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_grocery_jwt_key_2026_secure_random',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'super_secret_grocery_refresh_key_2026_secure_random',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  momo: {
    partnerCode: process.env.MOMO_PARTNER_CODE || '',
    accessKey: process.env.MOMO_ACCESS_KEY || '',
    secretKey: process.env.MOMO_SECRET_KEY || ''
  }
};

module.exports = config;
