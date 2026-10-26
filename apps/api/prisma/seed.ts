import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Deterministic PRNG so every environment gets the same demo data.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

const CATALOG: Record<string, { models: string[]; base: number }> = {
  Toyota: { models: ['Corolla', 'Camry', 'RAV4', 'Yaris'], base: 24000 },
  Ford: { models: ['Focus', 'Fiesta', 'Kuga', 'Puma'], base: 22000 },
  Volkswagen: { models: ['Golf', 'Polo', 'Tiguan', 'Passat'], base: 26000 },
  BMW: { models: ['1 Series', '3 Series', 'X1', 'X3'], base: 38000 },
  Audi: { models: ['A3', 'A4', 'Q3', 'Q5'], base: 40000 },
  Honda: { models: ['Civic', 'Jazz', 'CR-V'], base: 25000 },
  Nissan: { models: ['Qashqai', 'Juke', 'Leaf'], base: 23000 },
  Hyundai: { models: ['i20', 'i30', 'Tucson'], base: 21000 },
};
const TRIMS = ['Base', 'SE', 'Sport', 'Premium', 'Limited'] as const;
const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'; // no I, O, Q like real VINs

const vin = () => Array.from({ length: 17 }, () => pick([...VIN_CHARS])).join('');
const daysAgo = (n: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

/** ~35% of stock is aging so the dashboard has something to show; boundary cases are forced. */
function ageInDays(i: number): number {
  if (i === 0) return 90; // boundary: NOT aging
  if (i === 1) return 91; // boundary: aging
  const r = rand();
  if (r < 0.65) return Math.floor(rand() * 90);
  return 91 + Math.floor(rand() * 240);
}

async function main() {
  await prisma.vehicleAction.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.dealership.deleteMany();

  const dealerships = [
    { id: 'dealer-london', name: 'Keyloop Motors London', count: 140 },
    { id: 'dealer-manchester', name: 'Keyloop Motors Manchester', count: 110 },
  ];

  for (const d of dealerships) {
    await prisma.dealership.create({ data: { id: d.id, name: d.name } });
    const vehicles = Array.from({ length: d.count }, (_, i) => {
      const make = pick(Object.keys(CATALOG));
      const entry = CATALOG[make]!;
      const year = 2019 + Math.floor(rand() * 7);
      const age = ageInDays(i);
      return {
        dealershipId: d.id,
        vin: vin(),
        make,
        model: pick(entry.models),
        year,
        trim: pick(TRIMS),
        mileage: Math.round((2026 - year) * (6000 + rand() * 6000)),
        price: Math.round((entry.base * (0.55 + (year - 2019) * 0.07) * (0.9 + rand() * 0.25)) / 50) * 50,
        stockedAt: daysAgo(age),
      };
    });
    await prisma.vehicle.createMany({ data: vehicles });
  }

  // Pre-log a few actions so the UI shows statuses and history immediately.
  const aging = await prisma.vehicle.findMany({
    where: { stockedAt: { lt: daysAgo(90) } },
    orderBy: { stockedAt: 'asc' },
    take: 12,
  });
  const seedActions = [
    ['PRICE_REDUCTION_PLANNED', 'Drop 5% at month end'],
    ['MARKETING_PUSH', 'Feature on homepage carousel'],
    ['TRANSFER_PLANNED', 'Move to higher-demand branch'],
    ['AUCTION_PLANNED', 'Send to next Thursday auction'],
  ] as const;
  for (const [i, v] of aging.entries()) {
    const [actionType, note] = seedActions[i % seedActions.length]!;
    await prisma.vehicleAction.create({ data: { vehicleId: v.id, actionType, note, createdBy: 'seed' } });
  }

  const total = await prisma.vehicle.count();
  console.log(`Seeded ${dealerships.length} dealerships, ${total} vehicles, ${aging.length} actions`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
