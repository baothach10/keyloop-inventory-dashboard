import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export function createMetrics() {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });
  const httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency by route template',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
  });
  const actionsLogged = new Counter({
    name: 'inventory_actions_logged_total',
    help: 'Manager actions logged on aging vehicles',
    labelNames: ['action_type'] as const,
    registers: [registry],
  });
  const actionsRejected = new Counter({
    name: 'inventory_actions_rejected_total',
    help: 'Actions rejected because the vehicle is not aging',
    registers: [registry],
  });
  return { registry, httpDuration, actionsLogged, actionsRejected };
}
export type Metrics = ReturnType<typeof createMetrics>;
