import dotenv from 'dotenv';
dotenv.config({ override: true });

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await hashPassword('Demo1234!');
  await prisma.user.upsert({
    where: { email: 'admin@tenex.demo' },
    update: {},
    create: { email: 'admin@tenex.demo', passwordHash },
  });
  console.log('Seeded user: admin@tenex.demo / Demo1234!');
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
