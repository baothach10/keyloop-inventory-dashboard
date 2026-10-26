import type { InventorySummary, Vehicle, VehicleList } from '@inventory/shared';

export const vehicle = (o: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  dealershipId: 'd1',
  vin: 'VIN00000000000001',
  make: 'Ford',
  model: 'Focus',
  year: 2022,
  trim: 'SE',
  mileage: 12000,
  price: 15000,
  stockedAt: '2026-01-01T00:00:00.000Z',
  daysInStock: 30,
  isAging: false,
  latestAction: null,
  ...o,
});

export const summary: InventorySummary = {
  totalVehicles: 3,
  totalValue: 45000,
  agingCount: 2,
  agingPercent: 66.7,
  agingValue: 30000,
  averageDaysInStock: 120,
  agingWithoutAction: 1,
  thresholdDays: 90,
  ageBuckets: [
    { label: '0-30', count: 1 },
    { label: '31-60', count: 0 },
    { label: '61-90', count: 0 },
    { label: '91-180', count: 1 },
    { label: '180+', count: 1 },
  ],
  makes: ['BMW', 'Ford'],
  modelsByMake: { BMW: ['X1'], Ford: ['Focus', 'Puma'] },
};

export const list = (items: Vehicle[]): VehicleList => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 25,
  totalPages: 1,
});
