/// <reference types="node" />
import dotenv from 'dotenv';
dotenv.config({ override: true });

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password';
import { parseZscalerEvent } from '../src/parser/zscaler';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const CHUNK_SIZE = 500;
// Check local (Docker) path first, then project root path
const LOCAL_SAMPLE = path.resolve(__dirname, '../example-logs/zscaler-sample.jsonl');
const ROOT_SAMPLE = path.resolve(__dirname, '../../example-logs/zscaler-sample.jsonl');
const SAMPLE_FILE = fs.existsSync(LOCAL_SAMPLE) ? LOCAL_SAMPLE : ROOT_SAMPLE;

async function main() {
  // 1. Seed user
  const passwordHash = await hashPassword('Demo1234!');
  const user = await prisma.user.upsert({
    where: { email: 'admin@tenex.demo' },
    update: {},
    create: { email: 'admin@tenex.demo', passwordHash },
  });
  console.log('Seeded user: admin@tenex.demo / Demo1234!');

  // 2. Check if demo upload already exists (idempotency)
  const existing = await prisma.upload.findFirst({
    where: {
      userId: user.id,
      filename: 'zscaler-sample.jsonl',
    },
  });
  if (existing) {
    console.log('Demo upload already exists, skipping log seed.');
    return;
  }

  // 3. Check if sample file exists
  if (!fs.existsSync(SAMPLE_FILE)) {
    console.log(`Sample file not found: ${SAMPLE_FILE}`);
    console.log('Run "npm run generate-sample" first to create it.');
    return;
  }

  // 4. Parse sample file
  const content = fs.readFileSync(SAMPLE_FILE, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  const parsed = [];
  let parseErrors = 0;
  for (const line of lines) {
    try {
      const raw = JSON.parse(line);
      parsed.push(parseZscalerEvent(raw));
    } catch {
      parseErrors++;
    }
  }

  console.log(`Parsed ${parsed.length} log entries (${parseErrors} errors)`);

  // 5. Create upload record
  const upload = await prisma.upload.create({
    data: {
      userId: user.id,
      filename: 'zscaler-sample.jsonl',
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
      logCount: parsed.length,
      parseErrors,
      status: 'completed',
      completedAt: new Date(),
    },
  });

  // 6. Chunked insert of log entries
  for (let i = 0; i < parsed.length; i += CHUNK_SIZE) {
    const chunk = parsed.slice(i, i + CHUNK_SIZE);
    await prisma.logEntry.createMany({
      data: chunk.map(log => ({
        uploadId: upload.id,
        epochTime: log.epochTime,
        normalizedTime: log.normalizedTime,
        sourceIp: log.sourceIp,
        destHost: log.destHost,
        url: log.url,
        method: log.method,
        respCode: log.respCode,
        reqSize: log.reqSize,
        respSize: log.respSize,
        totalSize: log.totalSize,
        action: log.action,
        riskScore: log.riskScore,
        threatSeverity: log.threatSeverity,
        threatName: log.threatName,
        appClass: log.appClass,
        urlClass: log.urlClass,
        login: log.login,
        rawJson: log.rawJson as object,
      })),
    });
    console.log(`  Inserted chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(parsed.length / CHUNK_SIZE)}`);
  }

  console.log(`Seeded demo upload: ${upload.id} with ${parsed.length} log entries`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
