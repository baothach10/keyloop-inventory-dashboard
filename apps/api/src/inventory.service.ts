import type { Prisma, PrismaClient } from '@prisma/client';
import {
  AGING_THRESHOLD_DAYS,
  daysInStock,
  isAging,
  stockedAtCutoff,
  type ActionType,
  type CreateActionInput,
  type InventorySummary,
  type Vehicle,
  type VehicleAction,
  type VehicleDetail,
  type VehicleList,
  type VehicleQuery,
} from '@inventory/shared';

type VehicleRow = Prisma.VehicleGetPayload<{ include: { actions: true } }>;
type ActionRow = VehicleRow['actions'][number];

export class NotFoundError extends Error {
  readonly statusCode = 404;
}
/** Business-rule violation (valid request, but not allowed in the current state). */
export class RuleViolationError extends Error {
  readonly statusCode = 422;
}

const toAction = (a: ActionRow): VehicleAction => ({
  id: a.id,
  vehicleId: a.vehicleId,
  actionType: a.actionType as ActionType,
  note: a.note,
  createdBy: a.createdBy,
  createdAt: a.createdAt.toISOString(),
});

export class InventoryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private toVehicle(v: VehicleRow): Vehicle {
    const days = daysInStock(v.stockedAt, this.clock());
    const latest = [...v.actions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return {
      id: v.id,
      dealershipId: v.dealershipId,
      vin: v.vin,
      make: v.make,
      model: v.model,
      year: v.year,
      trim: v.trim,
      mileage: v.mileage,
      price: v.price,
      stockedAt: v.stockedAt.toISOString(),
      daysInStock: days,
      isAging: isAging(days),
      latestAction: latest ? toAction(latest) : null,
    };
  }

  async listDealerships() {
    return this.prisma.dealership.findMany({ orderBy: { name: 'asc' } });
  }

  private async assertDealership(id: string) {
    if (!(await this.prisma.dealership.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundError(`Dealership ${id} not found`);
    }
  }

  /**
   * Age filters become a range on the indexed `stockedAt` column:
   * older (higher age) <=> earlier stockedAt, so minAge => stockedAt <= cutoff(minAge).
   */
  private buildWhere(dealershipId: string, q: Partial<VehicleQuery>): Prisma.VehicleWhereInput {
    const now = this.clock();
    const stockedAt: Prisma.DateTimeFilter = {};
    const minAge = q.aging ? Math.max(q.minAge ?? 0, AGING_THRESHOLD_DAYS + 1) : q.minAge;
    if (minAge !== undefined) stockedAt.lte = stockedAtCutoff(minAge, now);
    if (q.maxAge !== undefined) stockedAt.gte = stockedAtCutoff(q.maxAge, now);

    const where: Prisma.VehicleWhereInput = { dealershipId };
    if (Object.keys(stockedAt).length) where.stockedAt = stockedAt;
    if (q.make) where.make = q.make;
    if (q.model) where.model = q.model;
    if (q.q) where.OR = [{ vin: { contains: q.q } }, { make: { contains: q.q } }, { model: { contains: q.q } }];
    return where;
  }

  async listVehicles(dealershipId: string, q: VehicleQuery): Promise<VehicleList> {
    await this.assertDealership(dealershipId);
    const where = this.buildWhere(dealershipId, q);
    // daysInStock is derived: ordering by age == ordering by stockedAt in the opposite direction.
    const dir = q.order;
    const orderBy: Prisma.VehicleOrderByWithRelationInput =
      q.sort === 'daysInStock' ? { stockedAt: dir === 'asc' ? 'desc' : 'asc' } : { [q.sort]: dir };

    const [total, rows] = await Promise.all([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { actions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
    ]);
    return {
      items: rows.map((r) => this.toVehicle(r)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  }

  async getVehicle(id: string): Promise<VehicleDetail> {
    const v = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { actions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!v) throw new NotFoundError(`Vehicle ${id} not found`);
    return { ...this.toVehicle(v), actions: v.actions.map(toAction) };
  }

  /** Actions may only be logged on aging stock (requirement 3). */
  async logAction(vehicleId: string, input: CreateActionInput): Promise<VehicleAction> {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) throw new NotFoundError(`Vehicle ${vehicleId} not found`);
    const days = daysInStock(v.stockedAt, this.clock());
    if (!isAging(days)) {
      throw new RuleViolationError(
        `Vehicle has been in stock ${days} days; actions can only be logged for stock older than ${AGING_THRESHOLD_DAYS} days`,
      );
    }
    const row = await this.prisma.vehicleAction.create({
      data: { vehicleId, actionType: input.actionType, note: input.note ?? null, createdBy: input.createdBy },
    });
    return toAction(row);
  }

  async summary(dealershipId: string): Promise<InventorySummary> {
    await this.assertDealership(dealershipId);
    const now = this.clock();
    const agingWhere: Prisma.VehicleWhereInput = {
      dealershipId,
      stockedAt: { lte: stockedAtCutoff(AGING_THRESHOLD_DAYS + 1, now) },
    };
    const [all, agingAgg, agingWithAction] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { dealershipId },
        select: { make: true, model: true, price: true, stockedAt: true },
      }),
      this.prisma.vehicle.aggregate({ where: agingWhere, _count: true, _sum: { price: true } }),
      this.prisma.vehicle.count({ where: { ...agingWhere, actions: { some: {} } } }),
    ]);

    const buckets = [
      { label: '0-30', min: 0, max: 30 },
      { label: '31-60', min: 31, max: 60 },
      { label: '61-90', min: 61, max: 90 },
      { label: '91-180', min: 91, max: 180 },
      { label: '180+', min: 181, max: Infinity },
    ].map((b) => ({ label: b.label, min: b.min, max: b.max, count: 0 }));

    let daysTotal = 0;
    let totalValue = 0;
    const modelsByMake: Record<string, Set<string>> = {};
    for (const v of all) {
      const d = daysInStock(v.stockedAt, now);
      daysTotal += d;
      totalValue += v.price;
      const b = buckets.find((x) => d >= x.min && d <= x.max);
      if (b) b.count++;
      (modelsByMake[v.make] ??= new Set()).add(v.model);
    }

    const total = all.length;
    const agingCount = agingAgg._count;
    return {
      totalVehicles: total,
      totalValue,
      agingCount,
      agingPercent: total ? Math.round((agingCount / total) * 1000) / 10 : 0,
      agingValue: agingAgg._sum.price ?? 0,
      averageDaysInStock: total ? Math.round(daysTotal / total) : 0,
      agingWithoutAction: agingCount - agingWithAction,
      thresholdDays: AGING_THRESHOLD_DAYS,
      ageBuckets: buckets.map(({ label, count }) => ({ label, count })),
      makes: Object.keys(modelsByMake).sort(),
      modelsByMake: Object.fromEntries(
        Object.entries(modelsByMake).map(([k, s]) => [k, [...s].sort()]),
      ),
    };
  }
}
