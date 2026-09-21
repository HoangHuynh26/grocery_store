const { EmbeddingService } = require('./embeddingService');
const { VN_OFFSET_HOURS, formatVnDateTime } = require('../../../utils/timezone');

class CronScheduler {
  constructor() {
    this.timerId = null;
    this.isRunning = false;
    this.lastRunAt = null;
    this.lastRunStats = null;
    this.nextRunDate = null;
  }

  /**
   * Calculates the exact next 12:00 AM (Midnight / 00:00:00) in Asia/Ho_Chi_Minh (UTC+7)
   */
  getNextMidnightInfo() {
    const now = new Date();
    // Shift to VN calendar components
    const vnNow = new Date(now.getTime() + VN_OFFSET_HOURS * 3600 * 1000);
    const curYear = vnNow.getUTCFullYear();
    const curMonth = vnNow.getUTCMonth();
    const curDate = vnNow.getUTCDate();

    // Target is tomorrow 00:00:00 in VN components
    // 00:00:00 in VN is (Date.UTC(curYear, curMonth, curDate + 1, 0, 0, 0) - VN_OFFSET_HOURS * 3600 * 1000)
    const nextMidnightTime = Date.UTC(curYear, curMonth, curDate + 1, 0, 0, 0, 0) - VN_OFFSET_HOURS * 3600 * 1000;
    const nextDate = new Date(nextMidnightTime);
    const delayMs = Math.max(1000, nextDate.getTime() - now.getTime());
    const hoursUntil = Math.round((delayMs / (3600 * 1000)) * 10) / 10;

    return {
      nextDate,
      delayMs,
      formattedVn: formatVnDateTime(nextDate),
      hoursUntil
    };
  }

  /**
   * Starts the automatic midnight scheduler
   */
  start() {
    if (this.isRunning && this.timerId) {
      clearTimeout(this.timerId);
    }

    const { nextDate, delayMs, formattedVn, hoursUntil } = this.getNextMidnightInfo();
    this.nextRunDate = nextDate;
    this.isRunning = true;

    console.log(`[Cron Scheduler] 🕛 12:00 AM (Midnight) Embedding Auto-Sync scheduled for ${formattedVn} (in ~${hoursUntil} hours) [Asia/Ho_Chi_Minh]`);

    this.timerId = setTimeout(async () => {
      await this.executeMidnightJob();
      // Reschedule for next midnight
      this.start();
    }, delayMs);
  }

  /**
   * Executes the midnight embedding synchronization job
   */
  async executeMidnightJob() {
    console.log(`[Cron Scheduler] 🕛 Starting scheduled 12:00 AM (Midnight) product embedding synchronization...`);
    try {
      const stats = await EmbeddingService.updateAllProductEmbeddings({ force: true });
      this.lastRunAt = new Date().toISOString();
      this.lastRunStats = stats;
      console.log(`[Cron Scheduler] ✅ Midnight embedding sync completed: ${stats.updatedCount} products updated in ${stats.durationMs}ms`);
      return stats;
    } catch (err) {
      console.error(`[Cron Scheduler] ❌ Midnight embedding sync error:`, err.message);
      this.lastRunStats = { error: err.message, failedAt: new Date().toISOString() };
      return null;
    }
  }

  /**
   * Manually trigger embedding sync immediately (e.g. for Admin or automated testing)
   */
  async triggerManualRun({ force = false } = {}) {
    console.log(`[Cron Scheduler] ⚡ Manual product embedding synchronization triggered (force=${force})...`);
    const stats = await EmbeddingService.updateAllProductEmbeddings({ force });
    this.lastRunAt = new Date().toISOString();
    this.lastRunStats = stats;
    return stats;
  }

  /**
   * Returns scheduler diagnostic status
   */
  getStatus() {
    const { nextDate, formattedVn, hoursUntil } = this.getNextMidnightInfo();
    return {
      isRunning: this.isRunning,
      targetTimeDaily: '12:00 AM (00:00:00 Midnight)',
      timezone: 'Asia/Ho_Chi_Minh (UTC+7)',
      nextRunAt: nextDate.toISOString(),
      nextRunFormatted: formattedVn,
      hoursUntilNextRun: hoursUntil,
      lastRunAt: this.lastRunAt,
      lastRunFormatted: this.lastRunAt ? formatVnDateTime(this.lastRunAt) : 'Chưa chạy lần nào',
      lastRunStats: this.lastRunStats
    };
  }

  /**
   * Stops the scheduler
   */
  stop() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
    console.log(`[Cron Scheduler] Midnight scheduler stopped.`);
  }
}

const schedulerInstance = new CronScheduler();
module.exports = schedulerInstance;
