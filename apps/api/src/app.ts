import { randomUUID } from 'node:crypto';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { PrismaClient } from '@prisma/client';
import {
  actionSchema,
  createActionSchema,
  dealershipSchema,
  summarySchema,
  vehicleDetailSchema,
  vehicleListSchema,
  vehicleQuerySchema,
} from '@inventory/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { InventoryService, NotFoundError, RuleViolationError } from './inventory.service.js';
import { createMetrics } from './metrics.js';

export interface AppOptions {
  prisma: PrismaClient;
  clock?: () => Date;
  logger?: boolean | object;
}

const errorSchema = z.object({ error: z.string(), message: z.string(), requestId: z.string().optional() });
const idParam = z.object({ id: z.string().min(1) });

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
    // Accept an upstream correlation id so logs line up across services.
    genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const metrics = createMetrics();
  const service = new InventoryService(opts.prisma, opts.clock);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Intelligent Inventory Dashboard API',
        version: '1.0.0',
        description: 'Vehicle stock, aging-stock identification (>90 days) and manager actions.',
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });
  app.addHook('onResponse', async (req, reply) => {
    // routeOptions.url is the template (/api/vehicles/:id), keeping label cardinality bounded.
    const route = req.routeOptions?.url ?? 'unmatched';
    metrics.httpDuration.observe(
      { method: req.method, route, status: String(reply.statusCode) },
      reply.elapsedTime / 1000,
    );
  });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error({ err }, 'unhandled error');
    const code =
      err instanceof NotFoundError ? 'NOT_FOUND'
      : err instanceof RuleViolationError ? 'RULE_VIOLATION'
      : status === 400 ? 'VALIDATION_ERROR'
      : 'INTERNAL_ERROR';
    reply.status(status).send({
      error: code,
      message: status >= 500 ? 'Internal server error' : err.message,
      requestId: req.id,
    });
  });

  // --- Operational endpoints -------------------------------------------------
  app.get('/health', { schema: { hide: true } }, async () => ({ status: 'ok' }));
  app.get('/ready', { schema: { hide: true } }, async (_req, reply) => {
    try {
      await opts.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      return reply.status(503).send({ status: 'unavailable' });
    }
  });
  app.get('/metrics', { schema: { hide: true } }, async (_req, reply) => {
    reply.header('content-type', metrics.registry.contentType);
    return metrics.registry.metrics();
  });

  // --- Business endpoints ----------------------------------------------------
  const api = '/api';

  app.get(`${api}/dealerships`, {
    schema: { tags: ['inventory'], response: { 200: z.array(dealershipSchema) } },
  }, async () => service.listDealerships());

  app.get(`${api}/dealerships/:id/vehicles`, {
    schema: {
      tags: ['inventory'],
      summary: 'Filterable, sortable, paginated vehicle list',
      params: idParam,
      querystring: vehicleQuerySchema,
      response: { 200: vehicleListSchema, 404: errorSchema },
    },
  }, async (req) => service.listVehicles(req.params.id, req.query));

  app.get(`${api}/dealerships/:id/inventory/summary`, {
    schema: {
      tags: ['inventory'],
      summary: 'KPIs, age distribution and filter options',
      params: idParam,
      response: { 200: summarySchema, 404: errorSchema },
    },
  }, async (req) => service.summary(req.params.id));

  app.get(`${api}/vehicles/:id`, {
    schema: {
      tags: ['inventory'],
      params: idParam,
      response: { 200: vehicleDetailSchema, 404: errorSchema },
    },
  }, async (req) => service.getVehicle(req.params.id));

  app.post(`${api}/vehicles/:id/actions`, {
    schema: {
      tags: ['actions'],
      summary: 'Log a status / proposed action for an AGING vehicle',
      params: idParam,
      body: createActionSchema,
      response: { 201: actionSchema, 404: errorSchema, 422: errorSchema },
    },
  }, async (req, reply) => {
    try {
      const action = await service.logAction(req.params.id, req.body);
      metrics.actionsLogged.inc({ action_type: action.actionType });
      req.log.info({ vehicleId: req.params.id, actionType: action.actionType }, 'action logged');
      return reply.status(201).send(action);
    } catch (e) {
      if (e instanceof RuleViolationError) metrics.actionsRejected.inc();
      throw e;
    }
  });

  return app;
}
