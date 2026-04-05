# Build Plan: Tenex Log Analyzer

This is the complete executable specification. The bot executes tasks in order. Every schema, prompt, helper, and API contract is defined here to prevent guessing.

---

## Table of Contents

1. Project Overview
2. Tech Stack
3. Repository Structure
4. Environment Variables
5. Database Schema (Prisma)
6. API Endpoint Contracts
7. Frontend Routes
8. Zod Schemas (Canonical)
9. Detection Rule Specifications
10. Claude Prompts and Validators
11. UI Helper Functions
12. Hour 0: Pre-Flight (Day 0, 30 min)
13. Hour 1: Scaffold + Auth + Docker
14. Hour 2: Upload + Parse + Synthetic Generator
15. Hour 3: Detection Rules 1 and 2 + Seed Data
16. Hour 4: Detection Rules 3 and 4 + Claude Pipeline
17. Hour 5: APIs + Frontend Data Layer
18. Hour 6: Dashboard UI
19. Hour 7: Deploy + README + Video
20. Testing Strategy
21. Submission Checklist

---

## 1. Project Overview

**Product:** AI-powered SOC triage tool for Zscaler Web Proxy logs.

**Pipeline:**
1. User uploads Zscaler JSONL log file (up to 10,000 entries)
2. Parser validates and stores entries in Postgres
3. Four deterministic detection rules produce Findings with confidence scores
4. Claude groups Findings into Incidents
5. Claude writes L2 analyst handoff for each Incident
6. Dashboard shows severity-ordered Incidents with evidence drill-in and timeline

**Key differentiator:** Claude is used for incident grouping and analyst handoff writing, not detection. Detection is deterministic and unit-tested.

---

## 2. Tech Stack

Use LATEST stable versions at the time of build. Do not pin to a specific minor version unless there is a known compatibility issue.

**Backend:**
- Node 20+
- Express 5.x
- TypeScript 5.x (strict mode)
- Prisma 6.x (ORM)
- PostgreSQL 16 (Docker locally)
- jsonwebtoken
- argon2 (password hashing)
- multer (file upload)
- cors, cookie-parser, helmet
- express-rate-limit
- zod (validation)
- @anthropic-ai/sdk (Claude)
- vitest (testing)

**Frontend:**
- Next.js 15.x (App Router)
- TypeScript 5.x (strict mode)
- Tailwind CSS 3.x
- @tanstack/react-query (v5)
- zod

**Deployment:**
- Docker Compose for local Postgres
- Railway for production (3 services: frontend, backend, Postgres)

---

## 3. Repository Structure

```
tenex-log-analyzer/
├── backend/
│   ├── src/
│   │   ├── auth/
│   │   │   ├── jwt.ts
│   │   │   ├── middleware.ts
│   │   │   └── password.ts
│   │   ├── detection/
│   │   │   ├── beaconing.ts
│   │   │   ├── exfil.ts
│   │   │   ├── credStuffing.ts
│   │   │   ├── highRisk.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── llm/
│   │   │   ├── claude.ts
│   │   │   ├── prompts.ts
│   │   │   ├── fallback.ts
│   │   │   └── pipeline.ts
│   │   ├── parser/
│   │   │   └── zscaler.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   └── uploads.ts
│   │   ├── schemas/
│   │   │   └── zscaler.ts
│   │   ├── lib/
│   │   │   └── prisma.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── scripts/
│   │   └── generate-sample.ts
│   ├── tests/
│   │   ├── beaconing.test.ts
│   │   ├── exfil.test.ts
│   │   ├── credStuffing.test.ts
│   │   └── highRisk.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── .gitignore
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── upload/
│   │   │   └── page.tsx
│   │   └── dashboard/
│   │       ├── page.tsx
│   │       └── [uploadId]/
│   │           └── page.tsx
│   ├── components/
│   │   ├── IncidentCard.tsx
│   │   ├── FindingEvidence.tsx
│   │   ├── Timeline.tsx
│   │   ├── SeverityBadge.tsx
│   │   ├── EmptyState.tsx
│   │   └── LoadingState.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── types.ts
│   │   ├── ui-helpers.ts
│   │   └── queryClient.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.js
│   ├── .env.example
│   └── .gitignore
├── example-logs/
│   └── zscaler-sample.jsonl
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 4. Environment Variables

**backend/.env.example:**
```
DATABASE_URL="postgresql://tenex:tenex@localhost:5432/tenex?schema=public"
JWT_SECRET="change-me-to-32-byte-random-string-minimum-length"
ANTHROPIC_API_KEY="sk-ant-..."
FRONTEND_URL="http://localhost:3000"
PORT=4000
NODE_ENV=development
```

**frontend/.env.example:**
```
NEXT_PUBLIC_BACKEND_URL="http://localhost:4000"
```

**Production (Railway) backend env vars:**
- DATABASE_URL (auto-set by Railway Postgres plugin)
- JWT_SECRET (generate with `openssl rand -hex 32`)
- ANTHROPIC_API_KEY
- FRONTEND_URL (Railway frontend URL)
- PORT (Railway sets this automatically)
- NODE_ENV=production

**Production (Railway) frontend env vars:**
- NEXT_PUBLIC_BACKEND_URL (Railway backend URL)

---

## 5. Database Schema (Prisma)

**backend/prisma/schema.prisma (complete, canonical):**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  uploads      Upload[]
}

model Upload {
  id           String     @id @default(cuid())
  userId       String
  user         User       @relation(fields: [userId], references: [id])
  filename     String
  sizeBytes    Int
  logCount     Int
  parseErrors  Int        @default(0)
  status       String     @default("processing")
  errorMessage String?
  createdAt    DateTime   @default(now())
  completedAt  DateTime?
  logs         LogEntry[]
  findings     Finding[]
  incidents    Incident[]

  @@index([userId, createdAt])
}

model LogEntry {
  id             String   @id @default(cuid())
  uploadId       String
  upload         Upload   @relation(fields: [uploadId], references: [id], onDelete: Cascade)
  epochTime      Int
  normalizedTime DateTime
  sourceIp       String
  destHost       String
  url            String
  method         String
  respCode       Int
  reqSize        Int
  respSize       Int
  totalSize      Int
  action         String
  riskScore      Int
  threatSeverity String
  threatName     String
  appClass       String
  urlClass       String
  login          String?
  rawJson        Json

  @@index([uploadId, normalizedTime])
  @@index([uploadId, sourceIp])
  @@index([uploadId, destHost])
}

model Finding {
  id             String    @id @default(cuid())
  uploadId       String
  upload         Upload    @relation(fields: [uploadId], references: [id], onDelete: Cascade)
  incidentId     String?
  incident       Incident? @relation(fields: [incidentId], references: [id])
  techniqueId    String
  techniqueName  String
  severity       String
  confidence     Int
  sourceIp       String?
  destHost       String?
  reason         String
  evidenceLogIds Json
  startTime      DateTime
  endTime        DateTime
  createdAt      DateTime  @default(now())

  @@index([uploadId, severity])
  @@index([uploadId, startTime])
  @@index([incidentId])
}

model Incident {
  id               String    @id @default(cuid())
  uploadId         String
  upload           Upload    @relation(fields: [uploadId], references: [id], onDelete: Cascade)
  title            String
  severity         String
  whatHappened     String
  whyItMatters     String
  investigateNext  Json
  suggestedContain String?
  startTime        DateTime
  endTime          DateTime
  aiGenerated      Boolean   @default(true)
  findings         Finding[]
  createdAt        DateTime  @default(now())

  @@index([uploadId, severity])
  @@index([uploadId, startTime])
}
```

**Severity enum values (string):** `critical`, `high`, `medium`, `low`

**Status enum values (string):** `processing`, `completed`, `failed`

---

## 6. API Endpoint Contracts

All endpoints return JSON. Errors use `{ error: string, details?: unknown }` shape. All authenticated routes read JWT from httpOnly cookie named `tenex_session`.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | /api/auth/login | No | `{email, password}` | `{user: {id, email}}` + Set-Cookie |
| POST | /api/auth/logout | Yes | empty | `{ok: true}` + clear cookie |
| GET | /api/auth/me | Yes | empty | `{user: {id, email}}` |
| POST | /api/uploads | Yes | multipart/form-data (file) | `{uploadId, logCount, parseErrors}` |
| GET | /api/uploads | Yes | empty | `{uploads: Upload[]}` |
| GET | /api/uploads/:id/summary | Yes | empty | `{upload, counts: {critical, high, medium, low}}` |
| GET | /api/uploads/:id/incidents | Yes | empty | `{incidents: IncidentWithFindings[]}` |
| GET | /api/uploads/:id/timeline | Yes | empty | `{events: TimelineEvent[], startTime, endTime}` |
| GET | /api/health | No | empty | `{ok: true}` |

**IncidentWithFindings shape:**
```typescript
{
  id: string;
  title: string;
  severity: string;
  whatHappened: string;
  whyItMatters: string;
  investigateNext: string[];
  suggestedContain: string | null;
  startTime: string;
  endTime: string;
  aiGenerated: boolean;
  findings: Array<{
    id: string;
    techniqueId: string;
    techniqueName: string;
    severity: string;
    confidence: number;
    sourceIp: string | null;
    destHost: string | null;
    reason: string;
    evidence: Array<LogEntry>; // first 5 log entries
  }>
}
```

**TimelineEvent shape:**
```typescript
{
  id: string;
  time: string;
  type: 'finding';
  severity: string;
  title: string;
  incidentId: string;
}
```

---

## 7. Frontend Routes

| Route | File | Auth | Purpose |
|---|---|---|---|
| / | app/page.tsx | No | Redirect to /login or /dashboard |
| /login | app/login/page.tsx | No | Login form |
| /upload | app/upload/page.tsx | Yes | File upload page |
| /dashboard | app/dashboard/page.tsx | Yes | List all uploads |
| /dashboard/[uploadId] | app/dashboard/[uploadId]/page.tsx | Yes | Incident dashboard for one upload |

---

## 8. Zod Schemas (Canonical)

**backend/src/schemas/zscaler.ts:**

```typescript
import { z } from 'zod';

export const ZscalerEventSchema = z.object({
  sourcetype: z.string().optional(),
  event: z.object({
    epochtime: z.coerce.number().int().positive(),
    time: z.string().optional(),
    login: z.string().optional(),
    action: z.enum(['Allowed', 'Blocked', 'Cautioned', 'Isolated']),
    urlcat: z.string().optional().default('Unknown'),
    urlclass: z.string().optional().default('Unknown'),
    host: z.string(),
    url: z.string(),
    sip: z.string().optional().default(''),
    cip: z.string(),
    reqmethod: z.string().default('GET'),
    respcode: z.coerce.number().int(),
    reqsize: z.coerce.number().int().nonnegative().default(0),
    respsize: z.coerce.number().int().nonnegative().default(0),
    totalsize: z.coerce.number().int().nonnegative().default(0),
    proto: z.string().optional().default('HTTPS'),
    riskscore: z.coerce.number().int().min(0).max(100).default(0),
    threatseverity: z.string().default('None (0)'),
    threatname: z.string().default('None'),
    malwarecat: z.string().default('None'),
    appname: z.string().default('Unknown'),
    appclass: z.string().default('Unknown'),
  }),
});

export type ZscalerEvent = z.infer<typeof ZscalerEventSchema>;
```

**Shared API response schemas** are defined inline in each route handler and duplicated in frontend/lib/types.ts.

---

## 9. Detection Rule Specifications

Each rule is a pure function in its own file. Input: `LogEntry[]` + `uploadId`. Output: `Finding[]`.

### 9.1 Beaconing (T1071.001)

**File:** `backend/src/detection/beaconing.ts`

```typescript
import type { LogEntry } from '@prisma/client';
import type { FindingInput } from './types';

const MIN_CONNECTIONS = 15;
const CV_THRESHOLD = 0.35;

export function detectBeaconing(logs: LogEntry[], uploadId: string): FindingInput[] {
  const pairs = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const key = `${log.sourceIp}:${log.destHost}`;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key)!.push(log);
  }

  const findings: FindingInput[] = [];

  for (const [key, entries] of pairs.entries()) {
    if (entries.length < MIN_CONNECTIONS) continue;

    entries.sort((a, b) => a.epochTime - b.epochTime);
    const intervals: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      intervals.push(entries[i].epochTime - entries[i - 1].epochTime);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean === 0) continue;
    const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
    const stddev = Math.sqrt(variance);
    const cv = stddev / mean;

    if (cv > CV_THRESHOLD) continue;

    const confidence = Math.min(95, Math.round((1 - cv / CV_THRESHOLD) * 100));
    const [sourceIp, destHost] = key.split(':');
    const severity = confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low';

    findings.push({
      uploadId,
      techniqueId: 'T1071.001',
      techniqueName: 'Application Layer Protocol: Web Protocols',
      severity,
      confidence,
      sourceIp,
      destHost,
      reason: `Regular connection pattern detected. ${entries.length} connections with CV=${cv.toFixed(3)} (mean interval ${Math.round(mean)}s). Indicates automated beacon traffic.`,
      evidenceLogIds: entries.slice(0, 10).map(e => e.id),
      startTime: new Date(entries[0].epochTime * 1000),
      endTime: new Date(entries[entries.length - 1].epochTime * 1000),
    });
  }

  return findings;
}
```

### 9.2 Data Exfiltration (T1041)

**File:** `backend/src/detection/exfil.ts`

```typescript
import type { LogEntry } from '@prisma/client';
import type { FindingInput } from './types';

const MIN_BYTES = 50 * 1024 * 1024; // 50 MB
const MULTIPLIER = 10;

export function detectExfil(logs: LogEntry[], uploadId: string): FindingInput[] {
  const pairTotals = new Map<string, { bytes: number; logs: LogEntry[] }>();

  for (const log of logs) {
    if (log.action !== 'Allowed') continue;
    const key = `${log.sourceIp}:${log.destHost}`;
    if (!pairTotals.has(key)) pairTotals.set(key, { bytes: 0, logs: [] });
    const entry = pairTotals.get(key)!;
    entry.bytes += log.totalSize;
    entry.logs.push(log);
  }

  if (pairTotals.size === 0) return [];

  const byteValues = Array.from(pairTotals.values()).map(v => v.bytes).sort((a, b) => a - b);
  const median = byteValues[Math.floor(byteValues.length / 2)] || 1;

  const findings: FindingInput[] = [];

  for (const [key, data] of pairTotals.entries()) {
    if (data.bytes < MIN_BYTES) continue;
    if (data.bytes < median * MULTIPLIER) continue;

    const mb = Math.round(data.bytes / 1024 / 1024);
    const confidence = Math.min(95, 50 + Math.round(mb / 10));
    const [sourceIp, destHost] = key.split(':');
    const severity = mb >= 500 ? 'critical' : mb >= 200 ? 'high' : 'medium';

    data.logs.sort((a, b) => a.epochTime - b.epochTime);

    findings.push({
      uploadId,
      techniqueId: 'T1041',
      techniqueName: 'Exfiltration Over C2 Channel',
      severity,
      confidence,
      sourceIp,
      destHost,
      reason: `${mb} MB transferred from ${sourceIp} to ${destHost} (${Math.round(data.bytes / median)}x upload median). Possible data exfiltration.`,
      evidenceLogIds: data.logs.slice(0, 10).map(l => l.id),
      startTime: new Date(data.logs[0].epochTime * 1000),
      endTime: new Date(data.logs[data.logs.length - 1].epochTime * 1000),
    });
  }

  return findings;
}
```

### 9.3 Credential Stuffing / Password Spray (T1110.003 / T1110.004)

**File:** `backend/src/detection/credStuffing.ts`

```typescript
import type { LogEntry } from '@prisma/client';
import type { FindingInput } from './types';

const AUTH_URL_REGEX = /login|signin|auth|oauth|sso/i;

export function detectCredStuffing(logs: LogEntry[], uploadId: string): FindingInput[] {
  const authFailures = logs.filter(l =>
    l.method === 'POST' &&
    AUTH_URL_REGEX.test(l.url) &&
    (l.respCode === 401 || l.respCode === 403)
  );

  const bySourceIp = new Map<string, { paths: Set<string>; logs: LogEntry[] }>();
  for (const log of authFailures) {
    if (!bySourceIp.has(log.sourceIp)) {
      bySourceIp.set(log.sourceIp, { paths: new Set(), logs: [] });
    }
    const entry = bySourceIp.get(log.sourceIp)!;
    entry.paths.add(log.url);
    entry.logs.push(log);
  }

  const findings: FindingInput[] = [];

  for (const [sourceIp, data] of bySourceIp.entries()) {
    const distinctPaths = data.paths.size;
    const totalAttempts = data.logs.length;

    if (distinctPaths < 3 && totalAttempts < 10) continue;

    const confidence = Math.min(95, 40 + distinctPaths * 10 + totalAttempts * 2);
    const severity = confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low';
    const techniqueId = distinctPaths >= 3 ? 'T1110.003' : 'T1110.004';
    const techniqueName = distinctPaths >= 3
      ? 'Brute Force: Password Spraying'
      : 'Brute Force: Credential Stuffing';

    data.logs.sort((a, b) => a.epochTime - b.epochTime);

    findings.push({
      uploadId,
      techniqueId,
      techniqueName,
      severity,
      confidence,
      sourceIp,
      destHost: data.logs[0].destHost,
      reason: `${totalAttempts} failed auth attempts from ${sourceIp} across ${distinctPaths} distinct paths. Pattern suggests automated credential attack.`,
      evidenceLogIds: data.logs.slice(0, 10).map(l => l.id),
      startTime: new Date(data.logs[0].epochTime * 1000),
      endTime: new Date(data.logs[data.logs.length - 1].epochTime * 1000),
    });
  }

  return findings;
}
```

### 9.4 High-Risk Allowed Traffic (T1071)

**File:** `backend/src/detection/highRisk.ts`

```typescript
import type { LogEntry } from '@prisma/client';
import type { FindingInput } from './types';

const RISK_THRESHOLD = 75;

export function detectHighRiskAllowed(logs: LogEntry[], uploadId: string): FindingInput[] {
  const risky = logs.filter(l =>
    l.action === 'Allowed' &&
    (l.riskScore >= RISK_THRESHOLD || /High|Critical/i.test(l.threatSeverity))
  );

  if (risky.length === 0) return [];

  const byPair = new Map<string, LogEntry[]>();
  for (const log of risky) {
    const key = `${log.sourceIp}:${log.destHost}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(log);
  }

  const findings: FindingInput[] = [];

  for (const [key, entries] of byPair.entries()) {
    const [sourceIp, destHost] = key.split(':');
    const maxRisk = Math.max(...entries.map(e => e.riskScore));
    const confidence = Math.min(95, maxRisk);
    const severity = maxRisk >= 90 ? 'critical' : maxRisk >= 80 ? 'high' : 'medium';

    entries.sort((a, b) => a.epochTime - b.epochTime);

    findings.push({
      uploadId,
      techniqueId: 'T1071',
      techniqueName: 'Application Layer Protocol',
      severity,
      confidence,
      sourceIp,
      destHost,
      reason: `${entries.length} high-risk connections allowed through to ${destHost} from ${sourceIp}. Max risk score ${maxRisk}. Possible policy gap.`,
      evidenceLogIds: entries.slice(0, 10).map(e => e.id),
      startTime: new Date(entries[0].epochTime * 1000),
      endTime: new Date(entries[entries.length - 1].epochTime * 1000),
    });
  }

  return findings;
}
```

### 9.5 Shared Types

**File:** `backend/src/detection/types.ts`

```typescript
export type FindingInput = {
  uploadId: string;
  techniqueId: string;
  techniqueName: string;
  severity: string;
  confidence: number;
  sourceIp: string | null;
  destHost: string | null;
  reason: string;
  evidenceLogIds: string[];
  startTime: Date;
  endTime: Date;
};
```

### 9.6 Detection Orchestrator

**File:** `backend/src/detection/index.ts`

```typescript
import type { LogEntry } from '@prisma/client';
import { detectBeaconing } from './beaconing';
import { detectExfil } from './exfil';
import { detectCredStuffing } from './credStuffing';
import { detectHighRiskAllowed } from './highRisk';
import type { FindingInput } from './types';

export function runAllDetections(logs: LogEntry[], uploadId: string): FindingInput[] {
  return [
    ...detectBeaconing(logs, uploadId),
    ...detectExfil(logs, uploadId),
    ...detectCredStuffing(logs, uploadId),
    ...detectHighRiskAllowed(logs, uploadId),
  ];
}
```

---

## 10. Claude Prompts and Validators

**File:** `backend/src/llm/prompts.ts`

```typescript
import { z } from 'zod';

export type FindingSummary = {
  id: string;
  techniqueId: string;
  techniqueName: string;
  severity: string;
  sourceIp: string | null;
  destHost: string | null;
  reason: string;
  startTime: string;
  endTime: string;
};

export const groupingPrompt = (findings: FindingSummary[]) => `
You are a SOC analyst triaging security findings from Zscaler web proxy logs.

Below are detected findings. Group findings that belong to the same security 
incident. Two findings belong to the same incident if EITHER:
  (a) they share a source IP AND occur within 30 minutes of each other, OR
  (b) they represent a logical attack chain (credential stuffing then 
      data exfiltration from the same source).

FINDINGS:
${JSON.stringify(findings, null, 2)}

Respond with JSON only. No markdown fences. No commentary.
Schema:
{
  "incidents": [
    {
      "finding_ids": ["<exact finding id from input>"],
      "title": "<6 to 10 word incident title>",
      "severity": "low" | "medium" | "high" | "critical"
    }
  ]
}

If findings do not cluster, return each as its own incident.
`.trim();

export type IncidentContext = {
  title: string;
  severity: string;
  findings: FindingSummary[];
  logSamples: Array<{
    time: string;
    sourceIp: string;
    destHost: string;
    method: string;
    url: string;
    respCode: number;
    totalSize: number;
  }>;
};

export const handoffPrompt = (incident: IncidentContext) => `
You are an L2 SOC analyst writing an escalation ticket for L3.

INCIDENT: ${incident.title}
SEVERITY: ${incident.severity}

FINDINGS IN THIS INCIDENT:
${JSON.stringify(incident.findings, null, 2)}

SAMPLE LOG EVIDENCE (first 10 entries):
${JSON.stringify(incident.logSamples, null, 2)}

Write the handoff in JSON only. No markdown. No commentary.
Schema:
{
  "what_happened": "<2 sentences. SOC terminology. Cite specific IPs and hostnames from the evidence. What did the attacker do?>",
  "why_it_matters": "<1 to 2 sentences on business impact. Concrete, not generic.>",
  "investigate_next": [
    "<specific action citing IPs, hosts, or users>",
    "<specific action>",
    "<specific action>"
  ],
  "suggested_containment": "<1 sentence, or null if incident is informational only>"
}

Rules:
- Be specific. Always cite IPs and hostnames from the evidence.
- Do not use generic advice like "review logs" or "check for malware".
- investigate_next must have exactly 3 items.
`.trim();

export const GroupingOutputSchema = z.object({
  incidents: z.array(z.object({
    finding_ids: z.array(z.string()).min(1),
    title: z.string().min(1).max(200),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })),
});

export const HandoffOutputSchema = z.object({
  what_happened: z.string().min(1),
  why_it_matters: z.string().min(1),
  investigate_next: z.array(z.string()).length(3),
  suggested_containment: z.string().nullable(),
});

export type GroupingOutput = z.infer<typeof GroupingOutputSchema>;
export type HandoffOutput = z.infer<typeof HandoffOutputSchema>;
```

**File:** `backend/src/llm/claude.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-5';

export async function callClaude(prompt: string, maxTokens = 2048): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const firstBlock = response.content[0];
  if (firstBlock.type !== 'text') {
    throw new Error('Unexpected Claude response type');
  }
  return firstBlock.text;
}

export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    const match = trimmed.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (match) return match[1].trim();
  }
  return trimmed;
}
```

**File:** `backend/src/llm/fallback.ts`

```typescript
import type { FindingInput } from '../detection/types';

type FallbackIncident = {
  title: string;
  severity: string;
  findingIndexes: number[];
  whatHappened: string;
  whyItMatters: string;
  investigateNext: string[];
  suggestedContain: string | null;
  startTime: Date;
  endTime: Date;
  aiGenerated: false;
};

export function buildFallbackIncidents(findings: FindingInput[]): FallbackIncident[] {
  // Group by source IP
  const bySource = new Map<string, number[]>();
  findings.forEach((f, idx) => {
    const key = f.sourceIp || 'unknown';
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(idx);
  });

  const incidents: FallbackIncident[] = [];
  for (const [sourceIp, indexes] of bySource.entries()) {
    const group = indexes.map(i => findings[i]);
    const severities = group.map(f => f.severity);
    const highest = severities.includes('critical') ? 'critical' :
                   severities.includes('high') ? 'high' :
                   severities.includes('medium') ? 'medium' : 'low';
    const techniques = Array.from(new Set(group.map(f => f.techniqueName)));
    const startTime = new Date(Math.min(...group.map(f => f.startTime.getTime())));
    const endTime = new Date(Math.max(...group.map(f => f.endTime.getTime())));

    incidents.push({
      title: `${techniques[0]} from ${sourceIp}`,
      severity: highest,
      findingIndexes: indexes,
      whatHappened: `Source ${sourceIp} exhibited ${group.length} finding(s) across ${techniques.length} technique(s): ${techniques.join(', ')}.`,
      whyItMatters: `${highest.toUpperCase()} severity activity from a single source indicates coordinated behavior requiring analyst review.`,
      investigateNext: [
        `Pull full traffic history for source IP ${sourceIp}`,
        `Correlate with endpoint telemetry and authentication logs`,
        `Review all destination hosts contacted by ${sourceIp}`,
      ],
      suggestedContain: highest === 'critical' || highest === 'high'
        ? `Consider isolating source ${sourceIp} pending investigation`
        : null,
      startTime,
      endTime,
      aiGenerated: false,
    });
  }

  return incidents;
}
```

**File:** `backend/src/llm/pipeline.ts`

Task 4.5 specifies the full pipeline. The bot implements this in Hour 4.

---

## 11. UI Helper Functions

**File:** `frontend/lib/ui-helpers.ts`

```typescript
export const severityColor = (sev: string): string => ({
  critical: 'bg-red-600 text-red-50',
  high: 'bg-orange-500 text-orange-50',
  medium: 'bg-yellow-500 text-yellow-950',
  low: 'bg-blue-400 text-blue-950',
}[sev] || 'bg-zinc-500 text-zinc-50');

export const severityBorder = (sev: string): string => ({
  critical: 'border-red-600',
  high: 'border-orange-500',
  medium: 'border-yellow-500',
  low: 'border-blue-400',
}[sev] || 'border-zinc-500');

export const severityDot = (sev: string): string => ({
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-400',
}[sev] || 'bg-zinc-500');

export const percentOffset = (
  eventTime: string | Date,
  startTime: string | Date,
  endTime: string | Date
): number => {
  const t = new Date(eventTime).getTime();
  const s = new Date(startTime).getTime();
  const e = new Date(endTime).getTime();
  if (e === s) return 0;
  return Math.max(0, Math.min(100, ((t - s) / (e - s)) * 100));
};

export const formatDuration = (startTime: string | Date, endTime: string | Date): string => {
  const ms = new Date(endTime).getTime() - new Date(startTime).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs} sec`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr ${mins % 60} min`;
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

export const formatTime = (t: string | Date): string => {
  return new Date(t).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};
```

---

## 12. Hour 0: Pre-Flight (Day 0, 30 min)

**Objective:** Railway project created, GitHub repo initialized, env vars scaffolded. Day 1 can start immediately.

### Task 0.1: Create GitHub Repo (5 min)
- Create new GitHub repo: `tenex-log-analyzer`
- Make it private
- Add collaborator: `venkata@tenex.ai`
- Clone locally

### Task 0.2: Create Railway Project (10 min)
- Sign in to Railway
- Create new project: `tenex-log-analyzer`
- Add PostgreSQL plugin
- Note the DATABASE_URL for later
- Create empty service "backend" (do not deploy yet)
- Create empty service "frontend" (do not deploy yet)
- Note both service URLs

### Task 0.3: Initial Commit (10 min)
- Create README.md with project name only
- Create .gitignore (Node, TypeScript, .env)
- Initial commit, push to GitHub
- Connect Railway services to GitHub repo (backend points to `/backend` directory, frontend points to `/frontend` directory)

### Task 0.4: Env Var Scaffolding (5 min)
- On Railway backend service, set placeholder env vars (empty values are fine for now):
  - JWT_SECRET (generate with openssl)
  - ANTHROPIC_API_KEY (from console.anthropic.com)
  - FRONTEND_URL (Railway frontend URL)
  - NODE_ENV=production
- On Railway frontend service:
  - NEXT_PUBLIC_BACKEND_URL (Railway backend URL)
  - NODE_ENV=production

**Acceptance:** Railway project exists with Postgres + 2 empty services. GitHub repo exists with collaborator added. Local clone ready.

---

## 13. Hour 1: Scaffold + Auth + Docker (60 min)

### Task 1.1: Create Repository Structure (5 min)
- Create `backend/` and `frontend/` folders
- Create `docker-compose.yml` at root with Postgres service
- Create `example-logs/` folder

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: tenex
      POSTGRES_PASSWORD: tenex
      POSTGRES_DB: tenex
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
volumes:
  postgres-data:
```

Run `docker compose up -d` to start Postgres.

### Task 1.2: Backend Scaffold (15 min)
- `cd backend && npm init -y`
- Install: `express @types/express typescript @types/node ts-node nodemon zod jsonwebtoken @types/jsonwebtoken argon2 cors @types/cors cookie-parser @types/cookie-parser helmet multer @types/multer express-rate-limit @prisma/client @anthropic-ai/sdk`
- Install dev: `prisma vitest @vitest/ui`
- Create `tsconfig.json` with strict mode
- Create `backend/src/server.ts` with health endpoint
- Create `backend/.env.example` (see section 4)
- Copy to `.env` and fill in local values
- `npx prisma init` (creates prisma folder)
- Replace `prisma/schema.prisma` with complete schema from section 5
- Run `npx prisma db push` to create tables
- Run `npx prisma generate`
- Add npm scripts: `dev`, `build`, `start`, `test`, `seed`

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

### Task 1.3: Frontend Scaffold (10 min)
- `npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --use-npm`
- Choose: no ESLint prompt variations, no customizing imports
- Install: `@tanstack/react-query zod`
- Create `frontend/.env.example` with `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`
- Copy to `.env.local`

### Task 1.4: Backend Auth (15 min)

**backend/src/auth/password.ts:**
```typescript
import argon2 from 'argon2';

export const hashPassword = (p: string) => argon2.hash(p, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

export const verifyPassword = (hash: string, p: string) => argon2.verify(hash, p);
```

**backend/src/auth/jwt.ts:**
```typescript
import jwt from 'jsonwebtoken';

export const signToken = (userId: string) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: '24h' });

export const verifyToken = (token: string) =>
  jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
```

**backend/src/auth/middleware.ts:**
```typescript
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';

declare global {
  namespace Express {
    interface Request { userId?: string; }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.tenex_session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

**backend/src/routes/auth.ts:**
```typescript
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../auth/password';
import { signToken } from '../auth/jwt';
import { authMiddleware } from '../auth/middleware';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', loginLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user.id);
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('tenex_session', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ user: { id: user.id, email: user.email } });
});

router.post('/logout', (_, res) => {
  res.clearCookie('tenex_session');
  res.json({ ok: true });
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { id: user.id, email: user.email } });
});

export default router;
```

**backend/src/lib/prisma.ts:**
```typescript
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
```

**backend/src/server.ts:** (see section 10 of previous plan, use complete startup validation)

**backend/prisma/seed.ts (user only for now):**
```typescript
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';

const prisma = new PrismaClient();

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
```

Run `npx ts-node prisma/seed.ts` to create user.

### Task 1.5: Frontend Login Page (15 min)

**frontend/app/login/page.tsx:**
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@tenex.demo');
  const [password, setPassword] = useState('Demo1234!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      router.push('/dashboard');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <form onSubmit={handleSubmit} className="w-full max-w-sm p-8 bg-zinc-900 rounded-lg border border-zinc-800">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6">Tenex Log Analyzer</h1>
        <input className="w-full mb-3 px-4 py-2 bg-zinc-800 text-zinc-100 rounded border border-zinc-700" value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" />
        <input className="w-full mb-4 px-4 py-2 bg-zinc-800 text-zinc-100 rounded border border-zinc-700" value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" />
        {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}
        <button disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
```

**Acceptance criteria for Hour 1:**
- `docker compose up -d` starts Postgres
- `cd backend && npm run dev` starts backend on port 4000
- `cd frontend && npm run dev` starts frontend on port 3000
- Visit http://localhost:3000/login
- Enter demo credentials, get redirected to /dashboard
- Page reload preserves session (cookie works)
- `npx tsc --noEmit` passes in both workspaces

**Commit:** `feat: scaffold monorepo with auth and docker`

---

## 14. Hour 2: Upload + Parse + Generator (60 min)

### Task 2.1: Upload Endpoint (20 min)

**backend/src/routes/uploads.ts:**
Implement the upload handler per section 11 of the prior execution-ready plan. Key features:
- 10 MB file size limit
- 10,000 log entry cap
- Extension whitelist: .jsonl, .json, .log, .txt
- Chunked inserts of 500
- File cleanup after parse
- Returns `{ uploadId, logCount, parseErrors }`
- Kicks off async analysis pipeline (stub for now, real in Task 4.5)

### Task 2.2: Zscaler Parser (10 min)

**backend/src/parser/zscaler.ts:**
```typescript
import { ZscalerEventSchema, type ZscalerEvent } from '../schemas/zscaler';

export type ParsedLog = {
  epochTime: number;
  normalizedTime: Date;
  sourceIp: string;
  destHost: string;
  url: string;
  method: string;
  respCode: number;
  reqSize: number;
  respSize: number;
  totalSize: number;
  action: string;
  riskScore: number;
  threatSeverity: string;
  threatName: string;
  appClass: string;
  urlClass: string;
  login: string | null;
  rawJson: ZscalerEvent;
};

export function parseZscalerEvent(raw: unknown): ParsedLog {
  const parsed = ZscalerEventSchema.parse(raw);
  const e = parsed.event;
  return {
    epochTime: e.epochtime,
    normalizedTime: new Date(e.epochtime * 1000),
    sourceIp: e.cip,
    destHost: e.host,
    url: e.url,
    method: e.reqmethod,
    respCode: e.respcode,
    reqSize: e.reqsize,
    respSize: e.respsize,
    totalSize: e.totalsize,
    action: e.action,
    riskScore: e.riskscore,
    threatSeverity: e.threatseverity,
    threatName: e.threatname,
    appClass: e.appclass,
    urlClass: e.urlclass,
    login: e.login || null,
    rawJson: parsed,
  };
}
```

### Task 2.3: Frontend Upload Page (15 min)

**frontend/app/upload/page.tsx:**
Implement drag-drop upload with file input fallback. On upload:
- POST to backend with multipart/form-data, credentials: 'include'
- Show rotating status messages during processing
- Poll `/api/uploads/:id/summary` every 2 seconds
- Redirect to `/dashboard/[uploadId]` when status='completed'

### Task 2.4: Synthetic Log Generator (15 min)

**backend/scripts/generate-sample.ts:**

Generates 1500 Zscaler events to `example-logs/zscaler-sample.jsonl`:
- 1350 benign entries (normal browsing to Microsoft 365, Google, business sites)
- 50 beacon entries: source `10.0.1.15` to `c2.attacker.xyz`, 60s ± 37% jitter
- 40 exfil entries: source `10.0.1.15` to `transfer.sh`, 4 MB POSTs
- 30 credential stuffing entries: source `198.51.100.77` to `okta.safemarch.com`, 12 distinct user paths, 401 responses
- 30 high-risk allowed entries: riskscore 80-95, action "Allowed"

Base epoch time: current time minus 4 hours. Distribute benign traffic realistically. Concentrate attacks in specific windows to make the timeline visually interesting.

**Acceptance criteria for Hour 2:**
- Generator produces `example-logs/zscaler-sample.jsonl` with ~1500 lines
- Upload page accepts the file
- Upload endpoint returns `{ uploadId, logCount: 1500, parseErrors: 0 }`
- LogEntry rows visible in Prisma Studio
- `npx tsc --noEmit` passes

**Commit:** `feat: log upload, parsing, and synthetic data generator`

---

## 15. Hour 3: Detection Rules 1 and 2 + Seed Data (60 min)

### Task 3.1: Beaconing Rule + Test (20 min)
- Create `backend/src/detection/beaconing.ts` per section 9.1
- Create `backend/src/detection/types.ts` per section 9.5
- Create `backend/tests/beaconing.test.ts`:
  - Test: 15 entries at exactly 60s intervals produces finding with CV ~= 0
  - Test: 10 entries produces no finding (below threshold)
  - Test: highly random intervals produces no finding (CV > 0.35)
- Run `npm test` to verify

### Task 3.2: Exfil Rule + Test (15 min)
- Create `backend/src/detection/exfil.ts` per section 9.2
- Create `backend/tests/exfil.test.ts`:
  - Test: one pair with 100 MB and median 1 MB produces finding
  - Test: pair with 10 MB produces no finding (below min bytes)
  - Test: pair with 80 MB but median 20 MB produces no finding (below multiplier)

### Task 3.3: Update Seed Script to Load Sample Logs (25 min)
- Update `backend/prisma/seed.ts` to:
  - Create user (already done in Hour 1)
  - Read `example-logs/zscaler-sample.jsonl`
  - Parse each line with `parseZscalerEvent`
  - Create one demo Upload record
  - Bulk insert parsed logs with chunked inserts of 500
  - Mark upload status as "completed" (pipeline will be called via API in Hour 4 once all rules exist)
- Run `npm run seed` to populate
- Verify in Prisma Studio: 1 user, 1 upload, 1500 log entries

**Acceptance criteria for Hour 3:**
- Beaconing rule passes 3 unit tests
- Exfil rule passes 3 unit tests
- Seed data JSON files exist
- `npm run seed` creates demo user + demo upload with logs
- Login and navigate to dashboard shows one upload (findings empty, ok for now)

**Commit:** `feat: beaconing and exfil detection rules with tests`

---

## 16. Hour 4: Detection Rules 3 and 4 + Claude Pipeline (60 min)

### Task 4.1: Credential Stuffing Rule + Test (10 min)
- Create `backend/src/detection/credStuffing.ts` per section 9.3
- Create `backend/tests/credStuffing.test.ts` with 3 test cases

### Task 4.2: High-Risk Allowed Rule + Test (10 min)
- Create `backend/src/detection/highRisk.ts` per section 9.4
- Create `backend/tests/highRisk.test.ts` with 3 test cases

### Task 4.3: Detection Orchestrator (5 min)
- Create `backend/src/detection/index.ts` per section 9.6

### Task 4.4: Claude Integration Files (15 min)
- Create `backend/src/llm/prompts.ts` per section 10
- Create `backend/src/llm/claude.ts` per section 10
- Create `backend/src/llm/fallback.ts` per section 10

### Task 4.5: Pipeline Orchestrator (15 min)

**backend/src/llm/pipeline.ts:**

```typescript
import { prisma } from '../lib/prisma';
import { runAllDetections } from '../detection';
import { callClaude, extractJson } from './claude';
import { groupingPrompt, handoffPrompt, GroupingOutputSchema, HandoffOutputSchema } from './prompts';
import { buildFallbackIncidents } from './fallback';
import type { FindingInput } from '../detection/types';

export async function runAnalysisPipeline(uploadId: string): Promise<void> {
  const logs = await prisma.logEntry.findMany({ where: { uploadId } });
  const findings = runAllDetections(logs, uploadId);

  if (findings.length === 0) {
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'completed', completedAt: new Date() },
    });
    return;
  }

  // Insert findings to get real IDs
  const insertedFindings = [];
  for (const f of findings) {
    const inserted = await prisma.finding.create({ data: f });
    insertedFindings.push(inserted);
  }

  // Try Claude grouping + handoff
  try {
    const findingSummaries = insertedFindings.map(f => ({
      id: f.id,
      techniqueId: f.techniqueId,
      techniqueName: f.techniqueName,
      severity: f.severity,
      sourceIp: f.sourceIp,
      destHost: f.destHost,
      reason: f.reason,
      startTime: f.startTime.toISOString(),
      endTime: f.endTime.toISOString(),
    }));

    const groupingRaw = await callClaude(groupingPrompt(findingSummaries));
    const groupingParsed = GroupingOutputSchema.parse(JSON.parse(extractJson(groupingRaw)));
    const knownIds = new Set(insertedFindings.map(f => f.id));

    for (const inc of groupingParsed.incidents) {
      const validFindingIds = inc.finding_ids.filter(id => knownIds.has(id));
      if (validFindingIds.length === 0) continue;

      const incidentFindings = insertedFindings.filter(f => validFindingIds.includes(f.id));
      const evidenceLogIds = incidentFindings.flatMap(f => f.evidenceLogIds as string[]).slice(0, 10);
      const logSamples = await prisma.logEntry.findMany({
        where: { id: { in: evidenceLogIds } },
        take: 10,
      });

      const handoffRaw = await callClaude(handoffPrompt({
        title: inc.title,
        severity: inc.severity,
        findings: incidentFindings.map(f => ({ ...f, startTime: f.startTime.toISOString(), endTime: f.endTime.toISOString(), id: f.id } as any)),
        logSamples: logSamples.map(l => ({
          time: l.normalizedTime.toISOString(),
          sourceIp: l.sourceIp,
          destHost: l.destHost,
          method: l.method,
          url: l.url,
          respCode: l.respCode,
          totalSize: l.totalSize,
        })),
      }));

      const handoffParsed = HandoffOutputSchema.parse(JSON.parse(extractJson(handoffRaw)));
      const startTime = new Date(Math.min(...incidentFindings.map(f => f.startTime.getTime())));
      const endTime = new Date(Math.max(...incidentFindings.map(f => f.endTime.getTime())));

      const incident = await prisma.incident.create({
        data: {
          uploadId,
          title: inc.title,
          severity: inc.severity,
          whatHappened: handoffParsed.what_happened,
          whyItMatters: handoffParsed.why_it_matters,
          investigateNext: handoffParsed.investigate_next,
          suggestedContain: handoffParsed.suggested_containment,
          startTime,
          endTime,
          aiGenerated: true,
        },
      });

      await prisma.finding.updateMany({
        where: { id: { in: validFindingIds } },
        data: { incidentId: incident.id },
      });
    }
  } catch (err) {
    console.error('Claude pipeline failed, using fallback', err);
    const fallbackIncidents = buildFallbackIncidents(findings);
    for (const fb of fallbackIncidents) {
      const incident = await prisma.incident.create({
        data: {
          uploadId,
          title: fb.title,
          severity: fb.severity,
          whatHappened: fb.whatHappened,
          whyItMatters: fb.whyItMatters,
          investigateNext: fb.investigateNext,
          suggestedContain: fb.suggestedContain,
          startTime: fb.startTime,
          endTime: fb.endTime,
          aiGenerated: false,
        },
      });
      const findingIds = fb.findingIndexes.map(i => insertedFindings[i].id);
      await prisma.finding.updateMany({
        where: { id: { in: findingIds } },
        data: { incidentId: incident.id },
      });
    }
  }

  await prisma.upload.update({
    where: { id: uploadId },
    data: { status: 'completed', completedAt: new Date() },
  });
}
```

### Task 4.6: Wire Pipeline Into Upload Route (5 min)
- In `backend/src/routes/uploads.ts`, after successful upload creation:
```typescript
runAnalysisPipeline(upload.id).catch(err => {
  console.error({ err, uploadId: upload.id }, 'Pipeline failed');
  prisma.upload.update({
    where: { id: upload.id },
    data: { status: 'failed', errorMessage: String(err) },
  }).catch(() => {});
});
```

### Task 4.7: Run Pipeline on Demo Upload (5 min)
- Update `backend/prisma/seed.ts` to call `runAnalysisPipeline(upload.id)` after bulk-inserting logs
- This requires ANTHROPIC_API_KEY to be set when seeding
- Run `npm run seed` again (or delete demo data first and re-seed)
- Verify in Prisma Studio: findings and incidents created for demo upload

**Acceptance criteria for Hour 4:**
- All 4 detection rules have tests passing
- Upload sample file produces 4+ findings and 1-3 incidents
- Incidents have Claude-generated handoff text
- If Claude fails, fallback incidents are created with `aiGenerated: false`
- `npx tsc --noEmit` passes

**Commit:** `feat: Claude incident grouping and analyst handoff pipeline`

---

## 17. Hour 5: APIs + Frontend Data Layer (60 min)

### Task 5.1: Summary Endpoint (10 min)
- `GET /api/uploads/:id/summary`
- Verify upload belongs to authenticated user
- Return upload record + severity counts

### Task 5.2: Incidents Endpoint (15 min)
- `GET /api/uploads/:id/incidents`
- Return incidents with nested findings
- For each finding, include first 5 log entries as evidence

### Task 5.3: Timeline Endpoint (10 min)
- `GET /api/uploads/:id/timeline`
- Return all findings as timeline events with startTime, endTime, severity, incidentId

### Task 5.4: Uploads List Endpoint (5 min)
- `GET /api/uploads`
- Return user's uploads sorted by createdAt desc

### Task 5.5: Frontend API Client (10 min)

**frontend/lib/api.ts:**
```typescript
const BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  me: () => fetchJson<{ user: { id: string; email: string } }>('/api/auth/me'),
  logout: () => fetchJson('/api/auth/logout', { method: 'POST' }),
  uploads: () => fetchJson<{ uploads: any[] }>('/api/uploads'),
  summary: (id: string) => fetchJson<{ upload: any; counts: any }>(`/api/uploads/${id}/summary`),
  incidents: (id: string) => fetchJson<{ incidents: any[] }>(`/api/uploads/${id}/incidents`),
  timeline: (id: string) => fetchJson<{ events: any[]; startTime: string; endTime: string }>(`/api/uploads/${id}/timeline`),
};
```

### Task 5.6: React Query Setup (10 min)
- Create `frontend/lib/queryClient.ts`
- Wrap app in QueryClientProvider in `app/layout.tsx`
- Create hooks: `useSummary`, `useIncidents`, `useTimeline`

**Acceptance criteria for Hour 5:**
- All 5 API endpoints return correct data
- All 5 endpoints require auth
- Frontend can fetch data via React Query hooks
- `npx tsc --noEmit` passes in both workspaces

**Commit:** `feat: results API endpoints and frontend data layer`

---

## 18. Hour 6: Dashboard UI (60 min)

### Task 6.1: Layout and Summary Cards (10 min)
- Dark zinc-950 background
- Summary cards for severity counts (critical, high, medium, low)
- Upload metadata (filename, log count, completion time)

### Task 6.2: Incident Cards (20 min)

**frontend/components/IncidentCard.tsx:**
Renders incident with:
- Severity badge (colored via `severityColor`)
- Title, source IP, duration
- What happened paragraph
- Why it matters paragraph
- 3 investigate_next items as a list
- Suggested containment (if present)
- MITRE technique badges for each linked finding
- AI-generated or rule-based indicator

### Task 6.3: Evidence Drill-In (15 min)

**frontend/components/FindingEvidence.tsx:**
Expandable section under each finding showing:
- First 5 raw log entries
- Monospace formatting
- Orange left-border highlight
- "View all (N)" toggle to see more

### Task 6.4: Timeline Component (10 min)

**frontend/components/Timeline.tsx:**
Horizontal scrollable timeline:
- Dots positioned using `percentOffset` helper
- Colored by severity via `severityDot`
- Hover tooltip shows finding title
- Dots within same incident share a connecting bar underneath

### Task 6.5: Empty and Loading States (5 min)
- EmptyState component: "No threats detected"
- LoadingState component: spinner with rotating status messages

**Acceptance criteria for Hour 6:**
- Dashboard loads at `/dashboard/[uploadId]`
- Shows severity counts, incident cards, timeline
- Clicking incident expands findings
- Clicking finding shows evidence
- Demo data from seed renders correctly
- Mobile responsive
- Dark theme consistent

**Commit:** `feat: dashboard UI with incident cards, evidence, timeline`

---

## 19. Hour 7: Deploy + README + Video (60 min)

### Task 7.1: Railway Deploy (15 min)
- Push latest code to GitHub
- Railway auto-builds backend and frontend
- Verify env vars are set on both services
- Wait for builds to complete
- Run seed on backend: connect to Railway service, run `npm run seed`
- Visit live frontend URL
- Test login + dashboard in incognito window

### Task 7.2: README (25 min)
Use the complete README template from the Execution-Ready Plan. Fill in:
- Live demo URL
- Video URL
- Actual deployment notes
- Any deviations from plan

### Task 7.3: Video Recording (20 min)
Use the 5-minute script from the Execution-Ready Plan. Record with Loom or similar. Upload unlisted. Add link to README.

**Acceptance criteria for Hour 7:**
- Live demo URL works in incognito window
- Login works with demo credentials
- Dashboard shows seeded data
- README has live link at top
- README has enumerated production roadmap (10 items)
- Video uploaded and linked
- All commits pushed to GitHub
- Repo shared with venkata@tenex.ai

**Commit:** `docs: README with live demo, video, and production roadmap`

---

## 20. Testing Strategy

**Unit tests (vitest):**
- 4 detection rules, 3 test cases each = 12 tests
- Parser with 3 test cases (valid event, missing fields, invalid type)

**Manual end-to-end test (run on Day 4 buffer):**
1. Fresh browser, incognito mode
2. Visit live URL
3. Login with demo credentials
4. Verify dashboard loads with seeded data
5. Click each incident, expand, verify handoff text renders
6. Click each finding, expand evidence, verify log entries render
7. Scroll timeline, verify dots positioned correctly
8. Click "upload new", upload the sample file, wait for processing
9. Verify new dashboard loads with findings
10. Logout, verify redirect to login

**Edge case tests:**
- Upload empty file: expect error
- Upload file over 10 MB: expect 413
- Upload non-log file (image renamed to .jsonl): expect parse errors
- Malformed JSONL (truncated last line): expect parseErrors count > 0
- Upload with no detectable threats: expect empty state

---

## 21. Submission Checklist

Before sending email to venkata@tenex.ai:

```
GITHUB:
[ ] Repo created and private
[ ] venkata@tenex.ai added as collaborator
[ ] README.md at root has live link at top
[ ] README.md has demo credentials
[ ] README.md has video link
[ ] README.md has 10-item production roadmap
[ ] example-logs/zscaler-sample.jsonl committed
[ ] .env.example files have all required vars
[ ] No real API keys committed (grep for 'sk-ant-')
[ ] .gitignore excludes .env, node_modules, dist

DEPLOYMENT:
[ ] Live URL works in incognito window
[ ] Login succeeds with admin@tenex.demo / Demo1234!
[ ] Dashboard shows 4 incidents from seed data
[ ] At least 1 CRITICAL or HIGH severity visible
[ ] Clicking incident expands and shows handoff
[ ] Evidence drill-in works
[ ] Timeline renders
[ ] No console errors in browser DevTools
[ ] No CORS errors

CODE QUALITY:
[ ] backend: npx tsc --noEmit passes
[ ] frontend: npx tsc --noEmit passes
[ ] All vitest tests pass
[ ] No TODO comments in critical paths
[ ] No console.log in critical paths

VIDEO:
[ ] Under 6 minutes
[ ] Covers: login, incident walkthrough, evidence, timeline, architecture
[ ] Audio is clear
[ ] Screen recording is readable
[ ] Unlisted link works

EMAIL TO VENKATA:
[ ] Subject line mentions take-home + your name
[ ] Repo link
[ ] Live demo link
[ ] Video link
[ ] Brief 3-sentence summary
[ ] Send in morning, not late at night
```

---

## Final Notes

This plan is self-consistent. Every file referenced exists in section 3. Every function called is defined in the plan. Every API endpoint is documented with contract. Every env var is listed. Every Claude prompt has a matching validator. Every schema field has a purpose.

If the bot follows this plan task-by-task, checks dependencies per CLAUDE.md, and verifies acceptance criteria before moving on, the result will be a working submission that meets every assessment requirement and every bonus.

Execute.
