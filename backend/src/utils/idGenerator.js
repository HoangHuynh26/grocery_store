const crypto = require('crypto');

function generateInvoiceNumber(sequenceNumber = 1) {
  const now = new Date();
  // Timezone Asia/Ho_Chi_Minh offset +7 hours
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const year = vnTime.getUTCFullYear();
  const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(vnTime.getUTCDate()).padStart(2, '0');
  
  const randomSuffix = crypto.randomInt(1000, 9999);
  const seqPadded = String(sequenceNumber).padStart(4, '0');
  return `INV-${year}${month}${day}-${seqPadded}-${randomSuffix}`;
}

function generateQrToken() {
  return `QR_${crypto.randomBytes(12).toString('hex')}`;
}

function generateIdempotencyKey() {
  return `IDEMP_${crypto.randomUUID()}`;
}

module.exports = {
  generateInvoiceNumber,
  generateQrToken,
  generateIdempotencyKey
};
