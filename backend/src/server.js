const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config/env');
const { initDb } = require('./database');
const { seedDatabase } = require('./database/seed');
const { initSocket } = require('./services/socketService');

async function startServer() {
  try {
    console.log('====================================================');
    console.log(' GROCERY STORE MANAGEMENT SYSTEM (POS & AI ENGINE)  ');
    console.log('====================================================');
    console.log(`[Config] Node Environment: ${config.nodeEnv}`);
    console.log(`[Config] Timezone: ${config.timezone}`);
    console.log(`[Config] Database Mode: ${config.databaseUrl.startsWith('postgres') ? 'External PostgreSQL' : 'Embedded PostgreSQL (Wasm Persistent)'}`);

    // 1. Initialize Database Schema
    await initDb();

    // 2. Seed default data if fresh
    await seedDatabase();

    // 3. Create HTTP & Socket.IO server
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: (origin, callback) => callback(null, true),
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
      }
    });

    initSocket(io);

    // 4. Start listening
    server.listen(config.port, () => {
      console.log(`[Server] Backend API listening on port ${config.port} (http://localhost:${config.port})`);
      console.log(`[Server] Socket.IO endpoint active.`);
      console.log(`[Auth] Default Super Admin: admin / Admin@123456`);
      console.log(`[Auth] Default Cashier Admin: nhanvien1 / Staff@123456`);
      console.log('====================================================');
    });

    // Graceful shutdown handling
    const shutdown = async () => {
      console.log('\n[Server] Shutting down gracefully...');
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('[Server Fatal Error]:', err);
    process.exit(1);
  }
}

startServer();
