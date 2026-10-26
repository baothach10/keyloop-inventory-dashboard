import { describe, expect, it } from 'vitest';
import { createActionSchema, vehicleQuerySchema } from './schemas.js';

describe('vehicleQuerySchema', () => {
  it('applies defaults', () => {
    const q = vehicleQuerySchema.parse({});
    expect(q).toMatchObject({ sort: 'daysInStock', order: 'desc', page: 1, pageSize: 25 });
  });
  it('coerces numeric and boolean query strings', () => {
    const q = vehicleQuerySchema.parse({ minAge: '30', aging: 'true', page: '2' });
    expect(q.minAge).toBe(30);
    expect(q.aging).toBe(true);
    expect(q.page).toBe(2);
  });
  it('rejects minAge > maxAge', () => {
    expect(vehicleQuerySchema.safeParse({ minAge: '50', maxAge: '10' }).success).toBe(false);
  });
  it('caps pageSize at 100', () => {
    expect(vehicleQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});

describe('createActionSchema', () => {
  it('accepts a known action and defaults the author', () => {
    expect(createActionSchema.parse({ actionType: 'HOLD' }).createdBy).toBe('manager');
  });
  it('rejects unknown actions', () => {
    expect(createActionSchema.safeParse({ actionType: 'NOPE' }).success).toBe(false);
  });
});
