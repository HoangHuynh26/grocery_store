// Timezone utility for Asia/Ho_Chi_Minh (UTC+7)

const VN_OFFSET_HOURS = 7;
const VN_OFFSET_MS = VN_OFFSET_HOURS * 60 * 60 * 1000;

function getNowVn() {
  const now = new Date();
  return new Date(now.getTime() + VN_OFFSET_MS);
}

function formatVnDateTime(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  
  // Convert UTC date to VN components
  const vn = new Date(d.getTime() + VN_OFFSET_MS);
  const day = String(vn.getUTCDate()).padStart(2, '0');
  const month = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const year = vn.getUTCFullYear();
  const hours = String(vn.getUTCHours()).padStart(2, '0');
  const minutes = String(vn.getUTCMinutes()).padStart(2, '0');
  const seconds = String(vn.getUTCSeconds()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function formatVnDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  
  const vn = new Date(d.getTime() + VN_OFFSET_MS);
  const day = String(vn.getUTCDate()).padStart(2, '0');
  const month = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const year = vn.getUTCFullYear();
  
  return `${day}/${month}/${year}`;
}

// Get UTC ISO boundaries for Asia/Ho_Chi_Minh calendar ranges
function getDateRangeBoundaries(preset, customStartDate = null, customEndDate = null) {
  const now = new Date();
  const nowVn = new Date(now.getTime() + VN_OFFSET_MS);
  
  const vnYear = nowVn.getUTCFullYear();
  const vnMonth = nowVn.getUTCMonth(); // 0-indexed
  const vnDate = nowVn.getUTCDate();

  function makeUtcRange(yStart, mStart, dStart, yEnd, mEnd, dEnd) {
    // 00:00:00.000 in VN is (start - 7h) in UTC
    const startUtc = new Date(Date.UTC(yStart, mStart, dStart, 0, 0, 0, 0) - VN_OFFSET_MS);
    // 23:59:59.999 in VN is (end - 7h) in UTC
    const endUtc = new Date(Date.UTC(yEnd, mEnd, dEnd, 23, 59, 59, 999) - VN_OFFSET_MS);
    return { startDate: startUtc.toISOString(), endDate: endUtc.toISOString() };
  }

  switch (preset) {
    case 'today':
      return makeUtcRange(vnYear, vnMonth, vnDate, vnYear, vnMonth, vnDate);
    case 'yesterday':
      const yestVn = new Date(nowVn.getTime() - 24 * 60 * 60 * 1000);
      return makeUtcRange(yestVn.getUTCFullYear(), yestVn.getUTCMonth(), yestVn.getUTCDate(), yestVn.getUTCFullYear(), yestVn.getUTCMonth(), yestVn.getUTCDate());
    case '7days':
      const sevenDaysAgo = new Date(nowVn.getTime() - 6 * 24 * 60 * 60 * 1000);
      return makeUtcRange(sevenDaysAgo.getUTCFullYear(), sevenDaysAgo.getUTCMonth(), sevenDaysAgo.getUTCDate(), vnYear, vnMonth, vnDate);
    case '30days':
      const thirtyDaysAgo = new Date(nowVn.getTime() - 29 * 24 * 60 * 60 * 1000);
      return makeUtcRange(thirtyDaysAgo.getUTCFullYear(), thirtyDaysAgo.getUTCMonth(), thirtyDaysAgo.getUTCDate(), vnYear, vnMonth, vnDate);
    case 'this_month':
      const lastDayThisMonth = new Date(Date.UTC(vnYear, vnMonth + 1, 0)).getUTCDate();
      return makeUtcRange(vnYear, vnMonth, 1, vnYear, vnMonth, lastDayThisMonth);
    case 'last_month':
      const lastMonthVn = new Date(Date.UTC(vnYear, vnMonth - 1, 1));
      const lmYear = lastMonthVn.getUTCFullYear();
      const lmMonth = lastMonthVn.getUTCMonth();
      const lastDayLastMonth = new Date(Date.UTC(lmYear, lmMonth + 1, 0)).getUTCDate();
      return makeUtcRange(lmYear, lmMonth, 1, lmYear, lmMonth, lastDayLastMonth);
    case 'this_year':
      return makeUtcRange(vnYear, 0, 1, vnYear, 11, 31);
    case 'custom':
      if (customStartDate && customEndDate) {
        const s = new Date(customStartDate);
        const e = new Date(customEndDate);
        return {
          startDate: new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0) - VN_OFFSET_MS).toISOString(),
          endDate: new Date(Date.UTC(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999) - VN_OFFSET_MS).toISOString()
        };
      }
      return makeUtcRange(vnYear, vnMonth, vnDate, vnYear, vnMonth, vnDate);
    default:
      return makeUtcRange(vnYear, vnMonth, vnDate, vnYear, vnMonth, vnDate);
  }
}

module.exports = {
  VN_OFFSET_HOURS,
  getNowVn,
  formatVnDateTime,
  formatVnDate,
  getDateRangeBoundaries
};
