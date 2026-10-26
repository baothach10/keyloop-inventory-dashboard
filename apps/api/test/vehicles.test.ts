import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addVehicle, createTestApp, resetDb } from './helpers.js';

let app: FastifyInstance;
let prisma: PrismaClient;

beforeAll(async () => ({ app, prisma } = await createTestApp()));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(() => resetDb(prisma));

const list = async (qs = '', dealer = 'd1') => {
  const res = await app.inject({ url: `/api/dealerships/${dealer}/vehicles${qs}` });
  return { res, body: res.json() };
};

describe('GET /dealerships/:id/vehicles', () => {
  it('derives daysInStock and isAging, with the 90/91 day boundary', async () => {
    await addVehicle(prisma, { age: 90, vin: 'B90' });
    await addVehicle(prisma, { age: 91, vin: 'B91' });
    const { body } = await list();
    const byVin = Object.fromEntries(body.items.map((v: any) => [v.vin, v]));
    expect(byVin.B90).toMatchObject({ daysInStock: 90, isAging: false });
    expect(byVin.B91).toMatchObject({ daysInStock: 91, isAging: true });
  });

  it('only returns vehicles of the requested dealership', async () => {
    await addVehicle(prisma, { age: 5, dealershipId: 'd1' });
    await addVehicle(prisma, { age: 5, dealershipId: 'd2' });
    expect((await list()).body.total).toBe(1);
  });

  it('filters by make and model', async () => {
    await addVehicle(prisma, { age: 5, make: 'Ford', model: 'Focus' });
    await addVehicle(prisma, { age: 5, make: 'Ford', model: 'Puma' });
    await addVehicle(prisma, { age: 5, make: 'BMW', model: 'X1' });
    expect((await list('?make=Ford')).body.total).toBe(2);
    expect((await list('?make=Ford&model=Puma')).body.total).toBe(1);
  });

  it('aging=true returns only stock older than 90 days', async () => {
    await addVehicle(prisma, { age: 90 });
    await addVehicle(prisma, { age: 91 });
    await addVehicle(prisma, { age: 200 });
    const { body } = await list('?aging=true');
    expect(body.items.map((v: any) => v.daysInStock).sort((a: number, b: number) => a - b)).toEqual([91, 200]);
  });

  it('filters by an inclusive age range', async () => {
    for (const age of [10, 30, 60, 100]) await addVehicle(prisma, { age });
    const { body } = await list('?minAge=30&maxAge=60');
    expect(body.items.map((v: any) => v.daysInStock).sort((a: number, b: number) => a - b)).toEqual([30, 60]);
  });

  it('searches by VIN fragment', async () => {
    await addVehicle(prisma, { age: 5, vin: 'WVWZZZ1JZXW000001' });
    await addVehicle(prisma, { age: 5, vin: 'OTHERVIN000000002' });
    expect((await list('?q=WVWZZZ')).body.total).toBe(1);
  });

  it('sorts oldest first by default and honours order=asc', async () => {
    for (const age of [20, 150, 80]) await addVehicle(prisma, { age });
    expect((await list()).body.items.map((v: any) => v.daysInStock)).toEqual([150, 80, 20]);
    expect((await list('?order=asc')).body.items.map((v: any) => v.daysInStock)).toEqual([20, 80, 150]);
  });

  it('paginates', async () => {
    for (let i = 0; i < 7; i++) await addVehicle(prisma, { age: i });
    const { body } = await list('?pageSize=3&page=3');
    expect(body).toMatchObject({ total: 7, page: 3, pageSize: 3, totalPages: 3 });
    expect(body.items).toHaveLength(1);
  });

  it('returns 404 for an unknown dealership', async () => {
    const { res, body } = await list('', 'nope');
    expect(res.statusCode).toBe(404);
    expect(body.error).toBe('NOT_FOUND');
  });

  it('returns 400 for invalid query params', async () => {
    const { res, body } = await list('?minAge=50&maxAge=10');
    expect(res.statusCode).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect((await list('?pageSize=1000')).res.statusCode).toBe(400);
  });
});

describe('GET /dealerships/:id/inventory/summary', () => {
  it('computes aging KPIs, buckets and filter options', async () => {
    await addVehicle(prisma, { age: 10, price: 10000, make: 'Ford', model: 'Focus' });
    await addVehicle(prisma, { age: 90, price: 20000, make: 'Ford', model: 'Puma' });
    const aging1 = await addVehicle(prisma, { age: 100, price: 30000, make: 'BMW', model: 'X1' });
    await addVehicle(prisma, { age: 200, price: 40000, make: 'BMW', model: 'X3' });
    await prisma.vehicleAction.create({
      data: { vehicleId: aging1.id, actionType: 'HOLD', createdBy: 't' },
    });
    await addVehicle(prisma, { age: 400, dealershipId: 'd2' }); // must not leak in

    const res = await app.inject({ url: '/api/dealerships/d1/inventory/summary' });
    const s = res.json();
    expect(s).toMatchObject({
      totalVehicles: 4,
      totalValue: 100000,
      agingCount: 2,
      agingPercent: 50,
      agingValue: 70000,
      agingWithoutAction: 1,
      thresholdDays: 90,
      averageDaysInStock: 100,
    });
    expect(s.ageBuckets).toEqual([
      { label: '0-30', count: 1 },
      { label: '31-60', count: 0 },
      { label: '61-90', count: 1 },
      { label: '91-180', count: 1 },
      { label: '180+', count: 1 },
    ]);
    expect(s.makes).toEqual(['BMW', 'Ford']);
    expect(s.modelsByMake.BMW).toEqual(['X1', 'X3']);
  });

  it('handles an empty dealership', async () => {
    const s = (await app.inject({ url: '/api/dealerships/d2/inventory/summary' })).json();
    expect(s).toMatchObject({ totalVehicles: 0, agingCount: 0, agingPercent: 0, averageDaysInStock: 0 });
  });
});
