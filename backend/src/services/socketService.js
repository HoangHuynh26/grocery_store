let ioInstance = null;

function initSocket(io) {
  ioInstance = io;
  io.on('connection', (socket) => {
    // Client connected
    socket.on('disconnect', () => {
      // Client disconnected
    });
  });
  console.log('[Socket.IO] Realtime server initialized');
}

function getIo() {
  return ioInstance;
}

function emitEvent(eventName, data) {
  if (ioInstance) {
    try {
      ioInstance.emit(eventName, data);
    } catch (err) {
      console.warn('[Socket.IO Emit Error]:', err.message);
    }
  }
}

function broadcastStockUpdate(products) {
  emitEvent('stock:updated', products);
}

function broadcastInvoiceCreated(invoice) {
  emitEvent('invoice:created', invoice);
}

function broadcastLowStockAlert(product) {
  emitEvent('stock:low_alert', product);
}

function broadcastAdminActivity(activity) {
  emitEvent('admin:activity', activity);
}

module.exports = {
  initSocket,
  getIo,
  broadcastStockUpdate,
  broadcastInvoiceCreated,
  broadcastLowStockAlert,
  broadcastAdminActivity
};
