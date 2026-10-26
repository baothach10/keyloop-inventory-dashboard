import { z } from 'zod';

export const ACTION_TYPES = [
  'PRICE_REDUCTION_PLANNED',
  'PRICE_REDUCED',
  'MARKETING_PUSH',
  'TRANSFER_PLANNED',
  'AUCTION_PLANNED',
  'HOLD',
  'SOLD',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABELS: Record<ActionType, string> = {
  PRICE_REDUCTION_PLANNED: 'Price Reduction Planned',
  PRICE_REDUCED: 'Price Reduced',
  MARKETING_PUSH: 'Marketing Push',
  TRANSFER_PLANNED: 'Transfer Planned',
  AUCTION_PLANNED: 'Auction Planned',
  HOLD: 'Hold',
  SOLD: 'Sold',
};

export const SORT_FIELDS = ['daysInStock', 'price', 'make', 'year', 'mileage'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

const boolFromQuery = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

export const vehicleQuerySchema = z
  .object({
    make: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    minAge: z.coerce.number().int().min(0).optional(),
    maxAge: z.coerce.number().int().min(0).optional(),
    aging: boolFromQuery.optional(),
    sort: z.enum(SORT_FIELDS).default('daysInStock'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((v) => v.minAge === undefined || v.maxAge === undefined || v.minAge <= v.maxAge, {
    message: 'minAge must be <= maxAge',
    path: ['minAge'],
  });
export type VehicleQuery = z.infer<typeof vehicleQuerySchema>;

export const createActionSchema = z.object({
  actionType: z.enum(ACTION_TYPES),
  note: z.string().trim().max(500).optional(),
  createdBy: z.string().trim().min(1).max(80).default('manager'),
});
export type CreateActionInput = z.infer<typeof createActionSchema>;

export const actionSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  actionType: z.enum(ACTION_TYPES),
  note: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
});
export type VehicleAction = z.infer<typeof actionSchema>;

export const vehicleSchema = z.object({
  id: z.string(),
  dealershipId: z.string(),
  vin: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  trim: z.string().nullable(),
  mileage: z.number().int(),
  price: z.number(),
  stockedAt: z.string(),
  daysInStock: z.number().int(),
  isAging: z.boolean(),
  latestAction: actionSchema.nullable(),
});
export type Vehicle = z.infer<typeof vehicleSchema>;

export const vehicleDetailSchema = vehicleSchema.extend({
  actions: z.array(actionSchema),
});
export type VehicleDetail = z.infer<typeof vehicleDetailSchema>;

export const vehicleListSchema = z.object({
  items: z.array(vehicleSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int(),
});
export type VehicleList = z.infer<typeof vehicleListSchema>;

export const dealershipSchema = z.object({ id: z.string(), name: z.string() });
export type Dealership = z.infer<typeof dealershipSchema>;

export const summarySchema = z.object({
  totalVehicles: z.number().int(),
  totalValue: z.number(),
  agingCount: z.number().int(),
  agingPercent: z.number(),
  agingValue: z.number(),
  averageDaysInStock: z.number(),
  agingWithoutAction: z.number().int(),
  thresholdDays: z.number().int(),
  ageBuckets: z.array(z.object({ label: z.string(), count: z.number().int() })),
  makes: z.array(z.string()),
  modelsByMake: z.record(z.array(z.string())),
});
export type InventorySummary = z.infer<typeof summarySchema>;
