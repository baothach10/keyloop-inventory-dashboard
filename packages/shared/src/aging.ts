/** A vehicle is "aging stock" when it has been in inventory for MORE than this many days. */
export const AGING_THRESHOLD_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days a vehicle has been in stock, computed from UTC calendar days so the
 * result does not change with the server's timezone. Future dates clamp to 0.
 */
export function daysInStock(stockedAt: Date, now: Date = new Date()): number {
  const start = Date.UTC(stockedAt.getUTCFullYear(), stockedAt.getUTCMonth(), stockedAt.getUTCDate());
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((end - start) / MS_PER_DAY));
}

/** Strictly greater than the threshold: exactly 90 days is NOT aging, 91 is. */
export function isAging(days: number, threshold: number = AGING_THRESHOLD_DAYS): boolean {
  return days > threshold;
}

/**
 * Latest `stockedAt` a vehicle may have to be at least `days` old.
 * Used to translate age filters into an indexed DB range query.
 */
export function stockedAtCutoff(days: number, now: Date = new Date()): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - days * MS_PER_DAY);
}
