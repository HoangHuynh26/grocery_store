// Natural Vietnamese Date & Hour Parser for Asia/Ho_Chi_Minh timezone

const { VN_OFFSET_HOURS } = require('../../../utils/timezone');

/**
 * Extracts specific hour or hour range from Vietnamese natural query
 * e.g. "lúc 13 giờ", "vào lúc 13h", "13h", "13:00", "8 giờ tối", "từ 13h đến 15h"
 */
function extractHourInfo(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // 1. Hour range: e.g. "từ 13h đến 15h", "từ 13 giờ đến 15 giờ", "13h - 15h"
  const rangeMatch = lower.match(/(?:từ|tu|khung|khung giờ)?\s*(\d{1,2})\s*(?:giờ|gio|h)\s*(?:đến|den|tới|toi|-)\s*(\d{1,2})\s*(?:giờ|gio|h)/i);
  if (rangeMatch) {
    let startH = parseInt(rangeMatch[1], 10);
    let endH = parseInt(rangeMatch[2], 10);
    if (startH >= 0 && startH <= 23 && endH >= 0 && endH <= 23) {
      if (startH > endH) {
        const tmp = startH;
        startH = endH;
        endH = tmp;
      }
      return { startHour: startH, endHour: endH, isRange: true };
    }
  }

  // 2. Colon notation: 13:00, 13:30, 08:15
  const colonMatch = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10);
    return { startHour: h, endHour: h, isRange: false };
  }

  // 3. Time with day-part qualifiers: e.g. "8 giờ tối", "8h tối", "2h chiều", "9h sáng"
  const partMatch = lower.match(/(?:lúc|vao luc|vào lúc|khoảng|khoang|hồi|hoi|khung)?\s*(\d{1,2})\s*(?:giờ|gio|h)\s*(sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem)\b/i);
  if (partMatch) {
    let h = parseInt(partMatch[1], 10);
    const part = partMatch[2].toLowerCase();
    if ((part === 'chiều' || part === 'chieu' || part === 'tối' || part === 'toi' || part === 'đêm' || part === 'dem') && h < 12) {
      h += 12;
    } else if ((part === 'trưa' || part === 'trua') && h === 12) {
      h = 12;
    } else if ((part === 'sáng' || part === 'sang') && h === 12) {
      h = 0;
    }
    if (h >= 0 && h <= 23) {
      return { startHour: h, endHour: h, isRange: false };
    }
  }

  // 4. "vào lúc 13 giờ", "lúc 13h", "khoảng 13 giờ", "lúc 13"
  const prefixMatch = lower.match(/(?:vào lúc|vao luc|lúc|luc|khoảng|khoang|hồi|hoi|khung giờ|khung gio|khung)\s*(\d{1,2})\s*(?:giờ|gio|h|g)?\b/i);
  if (prefixMatch) {
    const h = parseInt(prefixMatch[1], 10);
    if (h >= 0 && h <= 23) {
      return { startHour: h, endHour: h, isRange: false };
    }
  }

  // 5. Standalone "13 giờ", "13h"
  const standaloneMatch = lower.match(/\b(\d{1,2})\s*(?:giờ|gio|h)\b/i);
  if (standaloneMatch) {
    const h = parseInt(standaloneMatch[1], 10);
    if (h >= 0 && h <= 23) {
      return { startHour: h, endHour: h, isRange: false };
    }
  }

  return null;
}

function parseVietnameseNaturalDate(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  const now = new Date();
  const vnNow = new Date(now.getTime() + VN_OFFSET_HOURS * 60 * 60 * 1000);
  const curYear = vnNow.getUTCFullYear();
  const curMonth = vnNow.getUTCMonth(); // 0-indexed
  const curDate = vnNow.getUTCDate();

  const hourInfo = extractHourInfo(text);

  function makeIsoRange(y, m, d, dayLabel = null) {
    const dateDisplay = `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;
    
    if (hourInfo) {
      const startH = hourInfo.startHour;
      const endH = hourInfo.endHour;
      const start = new Date(Date.UTC(y, m, d, startH, 0, 0, 0) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
      const end = new Date(Date.UTC(y, m, d, endH, 59, 59, 999) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
      const hourDisplay = startH === endH ? `${String(startH).padStart(2, '0')}:00` : `${String(startH).padStart(2, '0')}:00 - ${String(endH).padStart(2, '0')}:59`;
      const suffix = dayLabel ? ` ${dayLabel}` : '';
      const label = `lúc ${hourDisplay}${suffix} (${dateDisplay})`;

      return {
        startDate: start,
        endDate: end,
        label,
        dateDisplay,
        hourDisplay,
        isHourly: true,
        targetHour: startH,
        endHour: endH,
        year: y,
        month: m + 1,
        day: d
      };
    }

    const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    return {
      startDate: start,
      endDate: end,
      label: dayLabel ? `${dayLabel} (${dateDisplay})` : dateDisplay,
      dateDisplay,
      isHourly: false,
      year: y,
      month: m + 1,
      day: d
    };
  }

  // 1. "hôm nay"
  if (lower.includes('hôm nay') || lower.includes('hom nay')) {
    return makeIsoRange(curYear, curMonth, curDate, 'hôm nay');
  }

  // 2. "hôm qua"
  if (lower.includes('hôm qua') || lower.includes('hom qua')) {
    const yest = new Date(vnNow.getTime() - 24 * 3600 * 1000);
    return makeIsoRange(yest.getUTCFullYear(), yest.getUTCMonth(), yest.getUTCDate(), 'hôm qua');
  }

  // 3. If hour is present and no specific day was declared -> default to today!
  if (hourInfo) {
    return makeIsoRange(curYear, curMonth, curDate, 'hôm nay');
  }

  // 4. "tháng này"
  if (lower.includes('tháng này') || lower.includes('thang nay')) {
    const lastDay = new Date(Date.UTC(curYear, curMonth + 1, 0)).getUTCDate();
    const start = new Date(Date.UTC(curYear, curMonth, 1, 0, 0, 0) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    const end = new Date(Date.UTC(curYear, curMonth, lastDay, 23, 59, 59, 999) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    return { startDate: start, endDate: end, label: `Tháng ${curMonth + 1}/${curYear}`, isHourly: false };
  }

  // 5. "tháng trước"
  if (lower.includes('tháng trước') || lower.includes('thang truoc')) {
    const lm = new Date(Date.UTC(curYear, curMonth - 1, 1));
    const lmYear = lm.getUTCFullYear();
    const lmMonth = lm.getUTCMonth();
    const lastDay = new Date(Date.UTC(lmYear, lmMonth + 1, 0)).getUTCDate();
    const start = new Date(Date.UTC(lmYear, lmMonth, 1, 0, 0, 0) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    const end = new Date(Date.UTC(lmYear, lmMonth, lastDay, 23, 59, 59, 999) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
    return { startDate: start, endDate: end, label: `Tháng ${lmMonth + 1}/${lmYear}`, isHourly: false };
  }

  // 6. Explicit DD/MM/YYYY e.g. "20/08/2026" or "20-08-2026"
  const dmyMatch = lower.match(/(\b\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    return makeIsoRange(y, m, d);
  }

  // 7. Explicit "ngày X tháng Y năm Z" or "ngày X tháng Y"
  const ngThMatch = lower.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?/);
  if (ngThMatch) {
    const d = parseInt(ngThMatch[1], 10);
    const m = parseInt(ngThMatch[2], 10) - 1;
    const y = ngThMatch[3] ? parseInt(ngThMatch[3], 10) : curYear;
    return makeIsoRange(y, m, d);
  }

  // 8. "ngày X" (Ví dụ: "ngày 15" -> ngày 15 của tháng hiện tại)
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
  extractHourInfo,
  parseVietnameseNaturalDate
};

