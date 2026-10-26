import { buildApp } from './app.js';
import { createPrisma } from './db.js';

const port = Number(process.env.PORT ?? 3001);
const prisma = createPrisma();

const app = await buildApp({
  prisma,
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers.authorization'],
    ...(process.env.NODE_ENV !== 'production' && {
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
    }),
  },
});

// Graceful shutdown: stop accepting requests, drain in-flight ones, release the DB.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

await app.listen({ port, host: '0.0.0.0' });
