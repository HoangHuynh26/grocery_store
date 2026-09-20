/**
 * Text processing utilities for Vietnamese linguistic normalization and SKU code generation
 */

function removeVietnameseAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function generateProductCode(name) {
  if (!name || typeof name !== 'string') return '';
  const noAccents = removeVietnameseAccents(name);
  const clean = noAccents
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return clean.substring(0, 30);
}

module.exports = {
  removeVietnameseAccents,
  generateProductCode
};
