import type { PrismaClient } from '@prisma/client';
import { createPrisma } from '../src/db.js';
import { buildApp } from '../src/app.js';

/** Frozen clock: every age in the tests is exact and independent of when they run. */
export const NOW = new Date('2026-06-30T12:00:00Z');

export function daysAgo(n: number): Date {
  return new Date(Date.UTC(2026, 5, 30 - n));
}

export async function createTestApp() {
  const prisma: PrismaClient = createPrisma('file:./test.db');
  const app = await buildApp({ prisma, clock: () => NOW });
  return { app, prisma };
}

let vinCounter = 0;
export async function resetDb(prisma: PrismaClient) {
  await prisma.vehicleAction.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.dealership.deleteMany();
  await prisma.dealership.createMany({
    data: [
      { id: 'd1', name: 'Dealer One' },
      { id: 'd2', name: 'Dealer Two' },
    ],
  });
}

export async function addVehicle(
  prisma: PrismaClient,
  o: { age: number; make?: string; model?: string; dealershipId?: string; price?: number; vin?: string },
) {
  return prisma.vehicle.create({
    data: {
      dealershipId: o.dealershipId ?? 'd1',
      vin: o.vin ?? `TESTVIN${String(++vinCounter).padStart(10, '0')}`,
      make: o.make ?? 'Toyota',
      model: o.model ?? 'Corolla',
      year: 2022,
      mileage: 10000,
      price: o.price ?? 20000,
      stockedAt: daysAgo(o.age),
    },
  });
}
