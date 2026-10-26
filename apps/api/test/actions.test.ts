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

const post = (id: string, payload: unknown) =>
  app.inject({ method: 'POST', url: `/api/vehicles/${id}/actions`, payload: payload as object });

describe('POST /vehicles/:id/actions', () => {
  it('persists an action on an aging vehicle', async () => {
    const v = await addVehicle(prisma, { age: 120 });
    const res = await post(v.id, { actionType: 'PRICE_REDUCTION_PLANNED', note: '5% off', createdBy: 'alex' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ actionType: 'PRICE_REDUCTION_PLANNED', note: '5% off', createdBy: 'alex' });
    expect(await prisma.vehicleAction.count({ where: { vehicleId: v.id } })).toBe(1);
  });

  it('rejects an action on a vehicle that is not aging (422) and stores nothing', async () => {
    const v = await addVehicle(prisma, { age: 90 });
    const res = await post(v.id, { actionType: 'HOLD' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('RULE_VIOLATION');
    expect(await prisma.vehicleAction.count()).toBe(0);
  });

  it('accepts the first day it becomes aging (91 days)', async () => {
    const v = await addVehicle(prisma, { age: 91 });
    expect((await post(v.id, { actionType: 'HOLD' })).statusCode).toBe(201);
  });

  it('returns 404 for an unknown vehicle', async () => {
    expect((await post('missing', { actionType: 'HOLD' })).statusCode).toBe(404);
  });

  it('validates the body (400)', async () => {
    const v = await addVehicle(prisma, { age: 120 });
    expect((await post(v.id, { actionType: 'NOT_A_THING' })).statusCode).toBe(400);
    expect((await post(v.id, { actionType: 'HOLD', note: 'x'.repeat(501) })).statusCode).toBe(400);
  });

  it('keeps history append-only; the newest action is the current status', async () => {
    const v = await addVehicle(prisma, { age: 150 });
    await post(v.id, { actionType: 'MARKETING_PUSH' });
    await new Promise((r) => setTimeout(r, 5));
    await post(v.id, { actionType: 'PRICE_REDUCED', note: 'done' });

    const detail = (await app.inject({ url: `/api/vehicles/${v.id}` })).json();
    expect(detail.actions.map((a: any) => a.actionType)).toEqual(['PRICE_REDUCED', 'MARKETING_PUSH']);
    expect(detail.latestAction.actionType).toBe('PRICE_REDUCED');

    const listed = (await app.inject({ url: '/api/dealerships/d1/vehicles' })).json();
    expect(listed.items[0].latestAction.actionType).toBe('PRICE_REDUCED');
  });
});

describe('operational endpoints', () => {
  it('health, ready and metrics respond', async () => {
    expect((await app.inject({ url: '/health' })).json()).toEqual({ status: 'ok' });
    expect((await app.inject({ url: '/ready' })).json()).toEqual({ status: 'ready' });
    const m = await app.inject({ url: '/metrics' });
    expect(m.body).toContain('http_request_duration_seconds');
  });

  it('propagates x-request-id', async () => {
    const res = await app.inject({ url: '/health', headers: { 'x-request-id': 'abc-123' } });
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it('records business counters', async () => {
    // Counters are cumulative for the app's lifetime, so assert on the delta.
    const read = async () => {
      const body = (await app.inject({ url: '/metrics' })).body;
      return Number(/inventory_actions_logged_total\{action_type="MARKETING_PUSH"\} (\d+)/.exec(body)?.[1] ?? 0);
    };
    const before = await read();
    const v = await addVehicle(prisma, { age: 120 });
    await post(v.id, { actionType: 'MARKETING_PUSH' });
    expect(await read()).toBe(before + 1);
  });

  it('serves the OpenAPI document', async () => {
    const spec = (await app.inject({ url: '/docs/json' })).json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths)).toContain('/api/vehicles/{id}/actions');
  });
});
