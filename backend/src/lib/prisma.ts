export { PrismaClient } from '../generated/prisma/client';
export type {
  User, Upload, LogEntry, Finding, Incident,
} from '../generated/prisma/client';

import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
export const prisma = new PrismaClient({ adapter });
