# Tenex Log Analyzer

AI-powered SOC triage tool that analyzes Zscaler web proxy logs, detects threats using deterministic rules, and generates analyst-ready incident reports with Claude.

**Live Demo:** [https://tenex-log-analyzer-frontend-production.up.railway.app](https://tenex-log-analyzer-frontend-production.up.railway.app/)

**Demo Credentials:** username: `admin@tenex.demo` & password: `Demo1234!`

**Video Walkthrough:** [PLACEHOLDER_VIDEO_URL](https://drive.google.com/file/d/11yESIXgRyzb_KGWMEl6Eq2MLF1QUsBjr/view?usp=sharing)

---

## Table of Contents

- [What This Does](#what-this-does)
- [How It Works](#how-it-works)
- [Detection Rules](#detection-rules)
- [How AI Is Used](#how-ai-is-used)
- [Example Log Files for Testing](#example-log-files-for-testing)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Production Roadmap](#production-roadmap)
- [Tech Stack](#tech-stack)

---

## What This Does

Upload a Zscaler JSONL log file and get a fully triaged incident dashboard in under 30 seconds. The tool parses up to 10,000 log entries, runs four deterministic detection rules to identify threats, then uses Claude to group related findings into incidents and write L2 analyst handoff tickets with specific IPs, hostnames, and recommended next steps.

The dashboard shows severity-ranked incident cards with expandable evidence, a timeline visualization of when threats occurred, and AI-generated containment recommendations. Every detection is backed by raw log evidence that analysts can drill into.

---

## How It Works

The analysis pipeline has three stages:

**Stage 1 -- Deterministic Detection.** Four detection rules scan every log entry. Each rule is a pure function with unit tests, no AI involved. Rules produce findings with technique IDs (MITRE ATT&CK), confidence scores, and evidence pointers. This stage is fast, reproducible, and auditable.

**Stage 2 -- AI Incident Grouping.** Claude receives all findings and groups them into incidents. Two findings belong to the same incident if they share a source IP within 30 minutes or represent a logical attack chain (for example, credential stuffing followed by data exfiltration from the same host). Claude assigns each incident a title and severity.

**Stage 3 -- AI Analyst Handoff.** For each incident, Claude writes an escalation ticket citing specific IPs, hostnames, and timestamps from the evidence. Each ticket includes what happened, why it matters, three concrete investigation steps, and a containment recommendation. If Claude is unavailable, a deterministic fallback generates basic tickets grouped by source IP.

```
Upload (.jsonl) --> Parse & Store --> Detect (4 rules) --> Group (Claude) --> Handoff (Claude) --> Dashboard
                                          |                     |                  |
                                     Findings             Incidents          AI Analyst
                                   (deterministic)      (AI-grouped)         Tickets
```

---

## Detection Rules

Each rule is a pure TypeScript function with unit tests. No AI is involved in detection.

### Beaconing (MITRE T1071.001)

Identifies automated callback patterns by measuring the regularity of connections between source-destination pairs. For each pair with 15 or more connections, the rule computes the coefficient of variation (CV) of inter-connection intervals. A CV below 0.35 indicates machine-like regularity rather than human browsing. The confidence score scales inversely with CV, so perfectly regular 60-second beacons score near 95% while slightly jittered patterns score lower.

### Data Exfiltration (MITRE T1041)

Flags abnormally large outbound data transfers. The rule computes total bytes transferred per source-destination pair, then compares each pair against the median across all pairs. A finding is raised when a pair exceeds both 50 MB total and 10x the median volume. This dual threshold prevents false positives from legitimate large downloads while catching true outliers like a host uploading 160 MB to a file-sharing service.

### Credential Stuffing and Password Spraying (MITRE T1110.003 / T1110.004)

Detects automated authentication attacks by identifying clusters of failed login attempts. The rule filters for POST requests to authentication endpoints (URLs matching login, signin, auth, oauth, or sso) that return 401 or 403. When a single source IP generates failures across 3 or more distinct paths, it is classified as password spraying. When failures concentrate on a single path but exceed 10 attempts, it is classified as credential stuffing.

### High-Risk Allowed Traffic (MITRE T1071)

Catches policy gaps where high-risk connections were permitted through the proxy. The rule flags any connection with a Zscaler risk score of 75 or above, or a threat severity of High or Critical, that has an action of Allowed. These represent connections that the proxy evaluated as dangerous but did not block, indicating a potential security policy misconfiguration.

---

## How AI Is Used

Claude is used exclusively in Stages 2 and 3 of the pipeline. **It does not perform detection.** This design separates deterministic analysis (which must be reproducible and testable) from narrative generation (which benefits from language understanding).

| Stage | What Claude Does | Input | Output | Fallback if Claude Fails |
|---|---|---|---|---|
| Stage 2: Grouping | Clusters related findings into incidents | All findings as JSON | Incident groups with titles and severity | Group by source IP deterministically |
| Stage 3: Handoff | Writes L2 analyst escalation tickets | Incident + evidence logs | What happened, why it matters, 3 next steps, containment | Template-based tickets with source IP |

**Prompts and validation:**
- The grouping prompt instructs Claude to cluster findings by shared source IP within a 30-minute window or by logical attack chain.
- The handoff prompt instructs Claude to write concise SOC-style escalation tickets that cite specific evidence.
- Both prompts enforce JSON-only output validated against Zod schemas.
- If Claude returns malformed output or is unavailable, the fallback module groups findings by source IP and generates template-based tickets without AI.

**Model:** `claude-sonnet-4-5` via the Anthropic SDK. Each upload triggers one grouping call and one handoff call per incident, typically 2-6 API calls total.

---

## Example Log Files for Testing

Two synthetic Zscaler log files are included in the repository for testing. You can upload either file through the web interface after logging in.

| File | Location | Events | Attack Scenarios |
|---|---|---|---|
| Sample v1 | `example-logs/zscaler-sample.jsonl` | 1,500 | Beacon to `c2.attacker.xyz`, exfil to `transfer.sh`, password spray on `okta.safemarch.com`, high-risk allowed traffic |
| Sample v2 | `example-logs/zscaler-sample-v2.jsonl` | 1,500 | Beacon to `c2.evilbeacon.net`, exfil to `upload.anonfiles.io`, password spray on `auth.corpacme.net`, high-risk allowed traffic |

Both files contain 1,350 benign entries (normal business browsing) mixed with 150 malicious entries that trigger all four detection rules. The attack traffic is concentrated in specific time windows to produce a visually interesting timeline.

**To generate fresh sample data:**

```bash
cd backend
npm run generate-sample       # creates example-logs/zscaler-sample.jsonl
npm run generate-sample-v2    # creates example-logs/zscaler-sample-v2.jsonl
```

---

## Local Setup

These instructions work on **macOS**, **Linux**, and **Windows (WSL)**. You need three things installed:

- [Node.js 22+](https://nodejs.org/) (run `node --version` to check)
- [Docker](https://www.docker.com/products/docker-desktop/) (run `docker --version` to check)
- [Git](https://git-scm.com/) (run `git --version` to check)

### Step 1: Clone the repository

```bash
git clone https://github.com/vinaybudideti/tenex-log-analyzer.git
cd tenex-log-analyzer
```

### Step 2: Start the database

Make sure Docker Desktop is running, then start PostgreSQL:

```bash
docker compose up -d
```

This starts a Postgres 16 container on port 5433. If you already have Postgres on port 5432, there is no conflict.

Verify it is running:

```bash
docker compose ps
```

You should see a container named `tenex-log-analyzer-postgres-1` with status `Up`.

### Step 3: Set up the backend

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` in a text editor and fill in your values:

| Variable | What to put |
|---|---|
| `DATABASE_URL` | Keep the default: `postgresql://tenex:tenex@localhost:5433/tenex?schema=public` |
| `JWT_SECRET` | Run `openssl rand -hex 32` in your terminal and paste the output |
| `ANTHROPIC_API_KEY` | Your API key from [console.anthropic.com](https://console.anthropic.com) |
| `FRONTEND_URL` | Keep `http://localhost:3000` |
| `PORT` | Keep `4000` |
| `NODE_ENV` | Keep `development` |

Then install dependencies and set up the database:

```bash
npm install
npx prisma db push
npx prisma generate
```

### Step 4: Generate sample data and seed the database

```bash
npm run generate-sample
npm run seed
```

The first command creates a synthetic Zscaler log file with 1,500 events including beacon traffic, data exfiltration, credential attacks, and high-risk connections. The second command creates a demo user (`admin@tenex.demo` / `Demo1234!`) and loads the sample data into the database.

### Step 5: Start the backend

```bash
npm run dev
```

The backend starts on `http://localhost:4000`. **Leave this terminal running.**

Verify it works by opening a new terminal and running:

```bash
curl http://localhost:4000/api/health
```

You should see `{"ok":true}`.

### Step 6: Set up the frontend

Open a **new terminal window** (keep the backend terminal running):

```bash
cd frontend
cp .env.example .env.local
npm install
```

The default `.env.local` already points to `http://localhost:4000` so no edits are needed.

### Step 7: Start the frontend

```bash
npm run dev
```

The frontend starts on `http://localhost:3000`.

### Step 8: Open the app

1. Go to [http://localhost:3000](http://localhost:3000) in your browser
2. You will be redirected to the login page
3. Log in with username `admin@tenex.demo` and password `Demo1234!`
4. Click the demo upload card to see the incident dashboard with 5 AI-analyzed incidents
5. Or click **Upload New** to upload your own Zscaler log file (try `example-logs/zscaler-sample-v2.jsonl`)

### Running tests

```bash
cd backend
npm test
```

This runs 12 unit tests across the four detection rules (3 tests per rule).

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | At least 32 characters. Used to sign authentication tokens |
| `ANTHROPIC_API_KEY` | Yes | Claude API key from [console.anthropic.com](https://console.anthropic.com) |
| `FRONTEND_URL` | Yes | Frontend origin for CORS. Use `http://localhost:3000` locally |
| `PORT` | No | Server port. Default: `4000` |
| `NODE_ENV` | No | `development` or `production` |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Backend API URL. Use `http://localhost:4000` locally |

---

## API Endpoints

All endpoints return JSON. Authentication is via Bearer token in the `Authorization` header.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | No | Login with email + password. Returns JWT token |
| `POST` | `/api/auth/logout` | Yes | Clears session |
| `GET` | `/api/auth/me` | Yes | Returns current user |
| `POST` | `/api/uploads` | Yes | Upload a log file (multipart/form-data) |
| `GET` | `/api/uploads` | Yes | List user's uploads |
| `GET` | `/api/uploads/:id/summary` | Yes | Upload metadata + severity counts |
| `GET` | `/api/uploads/:id/incidents` | Yes | Incidents with nested findings and evidence |
| `GET` | `/api/uploads/:id/timeline` | Yes | Timeline events for visualization |
| `GET` | `/api/health` | No | Health check |

---

## Architecture

```
+------------------+         +------------------+         +------------------+
|                  |  REST   |                  |  SQL    |                  |
|   Next.js 15     +-------->+   Express 5      +-------->+  PostgreSQL 16   |
|   (Frontend)     |  API    |   (Backend)      |  Prisma |  (Database)      |
|                  |<--------+                  |<--------+                  |
+------------------+         +--------+---------+         +------------------+
                                      |
                                      | Anthropic SDK
                                      v
                             +------------------+
                             |                  |
                             |  Claude Sonnet   |
                             |  (AI Analysis)   |
                             |                  |
                             +------------------+
```

**Frontend (Next.js 15):** React 19 with App Router, TypeScript, Tailwind CSS 4 for styling, React Query 5 for server state management. Pages: login, upload (drag-drop with real-time polling), dashboard (uploads list), and dashboard/[uploadId] (incident analysis with severity cards, incident cards, evidence drill-in, timeline).

**Backend (Express 5):** TypeScript with strict mode, Prisma 7 ORM for database access, Zod 4 for request/response validation, multer for file uploads. Four deterministic detection rules produce findings, then Claude groups and writes analyst handoffs. JWT authentication with Bearer tokens and argon2id password hashing.

**Database (PostgreSQL 16):** Five tables: User, Upload, LogEntry, Finding, Incident. Indexed on uploadId, sourceIp, severity, and timestamps for fast queries. LogEntry stores the full raw JSON for evidence drill-in.

**AI (Claude Sonnet 4.5):** Called via the Anthropic SDK for incident grouping and analyst handoff generation. Prompts enforce JSON-only output validated against Zod schemas. Deterministic fallback generates basic incidents if Claude is unavailable.

---

## Project Structure

```
tenex-log-analyzer/
├── backend/
│   ├── src/
│   │   ├── auth/            # JWT, argon2id password, middleware
│   │   ├── detection/       # 4 detection rules + orchestrator
│   │   │   ├── beaconing.ts
│   │   │   ├── exfil.ts
│   │   │   ├── credStuffing.ts
│   │   │   ├── highRisk.ts
│   │   │   └── index.ts     # runAllDetections()
│   │   ├── llm/             # Claude integration
│   │   │   ├── claude.ts    # API client
│   │   │   ├── prompts.ts   # Grouping + handoff prompts
│   │   │   ├── fallback.ts  # Deterministic fallback
│   │   │   └── pipeline.ts  # 3-stage orchestrator
│   │   ├── parser/          # Zscaler log parser
│   │   ├── routes/          # Express route handlers
│   │   ├── schemas/         # Zod validation schemas
│   │   ├── lib/prisma.ts    # Centralized DB client
│   │   └── server.ts        # Express app entry point
│   ├── tests/               # Vitest unit tests (12 tests)
│   ├── prisma/              # Schema + seed script
│   └── scripts/             # Sample data generators
├── frontend/
│   ├── app/                 # Next.js App Router pages
│   │   ├── login/           # Authentication
│   │   ├── upload/          # File upload with polling
│   │   └── dashboard/       # Uploads list + incident analysis
│   ├── components/          # Reusable UI components
│   │   ├── IncidentCard.tsx
│   │   ├── FindingEvidence.tsx
│   │   ├── Timeline.tsx
│   │   ├── SeverityBadge.tsx
│   │   ├── EmptyState.tsx
│   │   └── LoadingState.tsx
│   └── lib/                 # API client, hooks, types, helpers
├── example-logs/            # Sample log files for testing
│   ├── zscaler-sample.jsonl
│   └── zscaler-sample-v2.jsonl
└── docker-compose.yml       # Local PostgreSQL
```

---

## Production Roadmap

If this prototype were heading toward production, these are the changes I would prioritize:

1. **Prompt injection defense.** The current Claude prompts include raw log data. A malicious log entry could contain instructions that manipulate Claude's output. Production would need input sanitization, output validation beyond schema checks, and possibly a separate validation pass on Claude's responses.

2. **Multi-tenant isolation with row-level security.** The app currently filters by userId in application code. Production would add Postgres RLS policies so that even a bug in the application layer cannot leak data across tenants.

3. **Background job queue.** The analysis pipeline currently runs in-process after the upload response. A production system would use BullMQ or a similar queue so that pipeline failures do not affect the API server, jobs can be retried, and multiple workers can process uploads concurrently.

4. **Circuit breaker on Claude.** If the Anthropic API is degraded, the current code falls back after a timeout on each request. A circuit breaker would detect repeated failures and switch to fallback mode immediately, reducing latency for users during outages.

5. **Detection baselining.** The current detection thresholds (CV 0.35, 50 MB, 10x multiplier) are static. A production system would learn per-organization baselines from historical data, reducing false positives for environments with legitimately high transfer volumes or regular automated processes.

6. **Expanded MITRE coverage.** Four detection rules cover beaconing, exfiltration, credential attacks, and policy gaps. Production would add DNS tunneling (T1071.004), lateral movement via proxy (T1090), and domain generation algorithm detection.

7. **Evidence search and pivoting.** Analysts need to pivot from an incident to all related log entries, not just the first 5. Production would add full-text search across log entries, IP-based pivoting, and time-range filtering.

8. **Structured output retries.** When Claude returns JSON that fails Zod validation, the current code falls back to deterministic incidents. Production would retry with the validation error appended to the prompt, giving Claude a chance to correct its output before falling back.

9. **Login brute force protection.** The current rate limiter throttles by IP. Production would add account lockout after N failed attempts, CAPTCHA on repeated failures, and alerting on credential attack patterns targeting the application itself.

10. **Audit log.** Every login, upload, and analysis should be logged to an immutable audit trail for compliance and incident response.

11. **Trust proxy configuration.** The Express server runs behind Railway's reverse proxy. Production would configure `app.set('trust proxy', 1)` so that rate limiting and IP logging use the real client IP from `X-Forwarded-For` instead of the proxy's IP.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4, React Query 5 |
| Backend | Express 5, TypeScript, Prisma 7, Zod 4 |
| Database | PostgreSQL 16 |
| AI | Claude Sonnet 4.5 via Anthropic SDK |
| Auth | JWT with Bearer tokens, argon2id password hashing |
| Testing | Vitest (12 unit tests across 4 detection rules) |
| Deployment | Railway (Docker), GitHub |
