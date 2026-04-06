# Tenex Log Analyzer

AI-powered SOC triage tool that analyzes Zscaler web proxy logs, detects threats using deterministic rules, and generates analyst-ready incident reports with Claude.

**Live Demo:** [https://tenex-log-analyzer-frontend-production.up.railway.app](https://tenex-log-analyzer-frontend-production.up.railway.app/)

**Demo Credentials:** username: `admin@tenex.demo` & password: `Demo1234!`

**Video Walkthrough:** PLACEHOLDER_VIDEO_URL

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

---

## Detection Rules

**Beaconing (MITRE T1071.001).** Identifies automated callback patterns by measuring the regularity of connections between source-destination pairs. For each pair with 15 or more connections, the rule computes the coefficient of variation (CV) of inter-connection intervals. A CV below 0.35 indicates machine-like regularity rather than human browsing. The confidence score scales inversely with CV, so perfectly regular 60-second beacons score near 95% while slightly jittered patterns score lower.

**Data Exfiltration (MITRE T1041).** Flags abnormally large outbound data transfers. The rule computes total bytes transferred per source-destination pair, then compares each pair against the median across all pairs. A finding is raised when a pair exceeds both 50 MB total and 10x the median volume. This dual threshold prevents false positives from legitimate large downloads while catching true outliers like a host uploading 160 MB to a file-sharing service.

**Credential Stuffing and Password Spraying (MITRE T1110.003 / T1110.004).** Detects automated authentication attacks by identifying clusters of failed login attempts. The rule filters for POST requests to authentication endpoints (URLs matching login, signin, auth, oauth, or sso) that return 401 or 403. When a single source IP generates failures across 3 or more distinct paths, it is classified as password spraying. When failures concentrate on a single path but exceed 10 attempts, it is classified as credential stuffing.

**High-Risk Allowed Traffic (MITRE T1071).** Catches policy gaps where high-risk connections were permitted through the proxy. The rule flags any connection with a Zscaler risk score of 75 or above, or a threat severity of High or Critical, that has an action of Allowed. These represent connections that the proxy evaluated as dangerous but did not block, indicating a potential security policy misconfiguration.

---

## How AI Is Used

Claude is used exclusively in Stages 2 and 3 of the pipeline. It does not perform detection. This design separates deterministic analysis (which must be reproducible and testable) from narrative generation (which benefits from language understanding).

The grouping prompt instructs Claude to cluster findings by shared source IP within a 30-minute window or by logical attack chain. The handoff prompt instructs Claude to write concise SOC-style escalation tickets that cite specific evidence. Both prompts enforce JSON-only output with Zod schema validation. If Claude returns malformed output or is unavailable, the fallback module groups findings by source IP and generates template-based tickets without AI.

The model used is `claude-sonnet-4-5`. Each upload triggers one grouping call and one handoff call per incident, typically 2-6 API calls total.

---

## Local Setup

These instructions work on macOS, Linux, and Windows (WSL). You need [Node.js 22+](https://nodejs.org/), [Docker](https://www.docker.com/products/docker-desktop/), and [Git](https://git-scm.com/).

### Step 1: Clone the repository

```bash
git clone https://github.com/vinaybudideti/tenex-log-analyzer.git
cd tenex-log-analyzer
```

### Step 2: Start the database

Make sure Docker is running, then start PostgreSQL:

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
| `DATABASE_URL` | Keep the default (`postgresql://tenex:tenex@localhost:5433/tenex?schema=public`) |
| `JWT_SECRET` | Run `openssl rand -hex 32` and paste the output |
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

The first command creates a synthetic Zscaler log file with 1,500 events including beacon traffic, data exfiltration, credential attacks, and high-risk connections. The second command creates a demo user and loads the sample data.

### Step 5: Start the backend

```bash
npm run dev
```

The backend starts on `http://localhost:4000`. Leave this terminal running.

Verify it works:

```bash
curl http://localhost:4000/api/health
```

You should see `{"ok":true}`.

### Step 6: Set up the frontend

Open a new terminal:

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
3. Log in with `admin@tenex.demo` / `Demo1234!`
4. Click the demo upload to see the incident dashboard
5. Or click "Upload New" to upload your own Zscaler log file

### Running tests

```bash
cd backend
npm test
```

This runs 12 unit tests across the four detection rules.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | At least 32 characters. Used to sign auth tokens |
| `ANTHROPIC_API_KEY` | Yes | Claude API key from console.anthropic.com |
| `FRONTEND_URL` | Yes | Frontend origin for CORS (`http://localhost:3000` locally) |
| `PORT` | No | Server port (default: 4000) |
| `NODE_ENV` | No | `development` or `production` |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Backend API URL (`http://localhost:4000` locally) |

---

## Architecture

```
Browser (Next.js 15)
  |
  |-- POST /api/auth/login -----> Express 5 API
  |-- POST /api/uploads --------> Multer -> Zscaler Parser -> Postgres
  |                                  |
  |                                  v
  |                            Detection Rules (4)
  |                                  |
  |                                  v
  |                            Claude Grouping (Stage 2)
  |                                  |
  |                                  v
  |                            Claude Handoff (Stage 3)
  |                                  |
  |                                  v
  |-- GET /api/uploads/:id/* ---> Incidents + Findings + Evidence
  |
  v
Dashboard: Severity Cards, Incident Cards, Evidence Drill-in, Timeline
```

The frontend is a Next.js 15 app with React Query for data fetching. The backend is an Express 5 API with Prisma ORM connected to PostgreSQL. Authentication uses JWT tokens sent as Bearer headers. File uploads are processed synchronously (parse + insert), then the analysis pipeline runs asynchronously (detect + group + handoff).

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
