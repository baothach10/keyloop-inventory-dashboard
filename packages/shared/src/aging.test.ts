import { describe, expect, it } from 'vitest';
import { AGING_THRESHOLD_DAYS, daysInStock, isAging, stockedAtCutoff } from './aging.js';

const NOW = new Date('2026-06-30T15:30:00Z');

describe('daysInStock', () => {
  it('counts whole UTC calendar days', () => {
    expect(daysInStock(new Date('2026-06-20T23:59:00Z'), NOW)).toBe(10);
  });
  it('is 0 on the day of arrival', () => {
    expect(daysInStock(new Date('2026-06-30T00:00:00Z'), NOW)).toBe(0);
  });
  it('clamps future dates to 0', () => {
    expect(daysInStock(new Date('2026-07-15T00:00:00Z'), NOW)).toBe(0);
  });
});

describe('isAging', () => {
  it('uses a 90-day threshold', () => expect(AGING_THRESHOLD_DAYS).toBe(90));
  it('treats exactly 90 days as NOT aging', () => expect(isAging(90)).toBe(false));
  it('treats 91 days as aging', () => expect(isAging(91)).toBe(true));
  it('treats 0 days as not aging', () => expect(isAging(0)).toBe(false));
  it('supports a custom threshold', () => expect(isAging(31, 30)).toBe(true));
});

describe('stockedAtCutoff', () => {
  it('round-trips with daysInStock', () => {
    const cutoff = stockedAtCutoff(90, NOW);
    expect(daysInStock(cutoff, NOW)).toBe(90);
  });
});
