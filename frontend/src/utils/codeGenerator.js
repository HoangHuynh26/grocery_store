/**
 * Remove Vietnamese accents from string
 */
export function removeVietnameseAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Generate a clean uppercase product code from product name
 * Example: "Nước ngọt Coca Cola 330ml" -> "NUOC-NGOT-COCA-COLA-330ML"
 */
export function generateProductCodeFromName(name, suffix = '') {
  if (!name || !name.trim()) return '';

  const withoutAccents = removeVietnameseAccents(name.trim());

  // Replace non-alphanumeric with hyphen
  let code = withoutAccents
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();

  // If very long, take first 28 characters cleanly
  if (code.length > 28) {
    code = code.substring(0, 28).replace(/-+$/, '');
  }

  if (suffix) {
    code = `${code}-${suffix}`;
  }

  return code;
}

/**
 * Generate alternative variant code with numbered suffix
 */
export function generateAlternativeCode(baseCode) {
  if (!baseCode) return `SP-${Math.floor(1000 + Math.random() * 9000)}`;
  
  // If it already ends with -01, -02, etc.
  const match = baseCode.match(/-(\d{2})$/);
  if (match) {
    const nextNum = String(parseInt(match[1], 10) + 1).padStart(2, '0');
    return baseCode.replace(/-\d{2}$/, `-${nextNum}`);
  }

  // Otherwise append -01
  return `${baseCode}-01`;
}
