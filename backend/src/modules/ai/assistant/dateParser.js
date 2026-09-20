// Natural Vietnamese Date Parser for Asia/Ho_Chi_Minh timezone

const { VN_OFFSET_HOURS } = require('../../../utils/timezone');

function parseVietnameseNaturalDate(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  const now = new Date();
  const vnNow = new Date(now.getTime() + VN_OFFSET_HOURS * 60 * 60 * 1000);
  const curYear = vnNow.getUTCFullYear();
  const curMonth = vnNow.getUTCMonth(); // 0-indexed
  const curDate = vnNow.getUTCDate();

  function makeIsoRange(y, m, d) {
    const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    const display = `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;
    return { startDate: start, endDate: end, label: display, year: y, month: m + 1, day: d };
  }

  // 1. "hôm nay"
  if (lower.includes('hôm nay') || lower.includes('hom nay')) {
    return makeIsoRange(curYear, curMonth, curDate);
  }

  // 2. "hôm qua"
  if (lower.includes('hôm qua') || lower.includes('hom qua')) {
    const yest = new Date(vnNow.getTime() - 24 * 3600 * 1000);
    return makeIsoRange(yest.getUTCFullYear(), yest.getUTCMonth(), yest.getUTCDate());
  }

  // 3. "tháng này"
  if (lower.includes('tháng này') || lower.includes('thang nay')) {
    const lastDay = new Date(Date.UTC(curYear, curMonth + 1, 0)).getUTCDate();
    const start = new Date(Date.UTC(curYear, curMonth, 1, 0, 0, 0) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    const end = new Date(Date.UTC(curYear, curMonth, lastDay, 23, 59, 59, 999) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    return { startDate: start, endDate: end, label: `Tháng ${curMonth + 1}/${curYear}` };
  }

  // 4. "tháng trước"
  if (lower.includes('tháng trước') || lower.includes('thang truoc')) {
    const lm = new Date(Date.UTC(curYear, curMonth - 1, 1));
    const lmYear = lm.getUTCFullYear();
    const lmMonth = lm.getUTCMonth();
    const lastDay = new Date(Date.UTC(lmYear, lmMonth + 1, 0)).getUTCDate();
    const start = new Date(Date.UTC(lmYear, lmMonth, 1, 0, 0, 0) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    const end = new Date(Date.UTC(lmYear, lmMonth, lastDay, 23, 59, 59, 999) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    return { startDate: start, endDate: end, label: `Tháng ${lmMonth + 1}/${lmYear}` };
  }

  // 5. Explicit DD/MM/YYYY e.g. "20/08/2026" or "20-08-2026"
  const dmyMatch = lower.match(/(\b\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    return makeIsoRange(y, m, d);
  }

  // 6. Explicit "ngày X tháng Y năm Z" or "ngày X tháng Y"
  const ngThMatch = lower.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?/);
  if (ngThMatch) {
    const d = parseInt(ngThMatch[1], 10);
    const m = parseInt(ngThMatch[2], 10) - 1;
    const y = ngThMatch[3] ? parseInt(ngThMatch[3], 10) : curYear;
    return makeIsoRange(y, m, d);
  }

  // 7. "ngày X" (Ví dụ: "ngày 15" -> ngày 15 của tháng hiện tại)
  const ngMatch = lower.match(/(?:ngày|ngay)\s+(\d{1,2})\b/);
  if (ngMatch) {
    const d = parseInt(ngMatch[1], 10);
    if (d >= 1 && d <= 31) {
      return makeIsoRange(curYear, curMonth, d);
    }
  }

  return null;
}

module.exports = {
  parseVietnameseNaturalDate
};
