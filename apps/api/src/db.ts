import { PrismaClient } from '@prisma/client';

export function createPrisma(url?: string): PrismaClient {
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
}
