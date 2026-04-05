# Bot Operating Rules for Tenex Log Analyzer Build

You are building a full-stack cybersecurity log analysis tool for a Tenex.ai take-home assessment. Read this file completely before writing any code. Read BUILD_PLAN.md for the full specification. These rules override any default behavior you have.

---

## Hard Rules (Never Violate)

1. **Never guess at an API signature.** If you do not know the exact method, parameter order, or return type of a library function, stop and read the package documentation or type definitions. Do not write code that might exist.

2. **Never invent configuration values.** If the plan specifies `CV threshold 0.35`, use 0.35. Do not change it to 0.3 or 0.4 because you think it sounds better.

3. **Never skip error handling.** Every async operation gets try/catch. Every external call (Claude, Postgres, file system) gets error handling. Every user input gets validation.

4. **Never reference a file, function, or variable that does not exist yet.** If you need a helper function, create it first or note that the task depends on a previous task creating it.

5. **Never commit secrets.** If you see a placeholder like `YOUR_KEY_HERE` in example files, keep it as a placeholder. Never hardcode real API keys.

6. **Stop and ask when uncertain.** If the spec is ambiguous, if a library behaves differently than expected, if a type error is non-obvious, stop. Do not guess. Ask the user.

---

## File Dependency Protocol

Before modifying ANY existing file, you must perform these steps in order:

**Step 1: List downstream consumers.** Use grep or search to find every file that imports from or references the file you are about to change.

```
Example: about to change backend/src/parser/zscaler.ts
Search: grep -r "from.*parser/zscaler" backend/
Result: backend/src/routes/uploads.ts, backend/src/detection/index.ts
```

**Step 2: List upstream dependencies.** Find every file the file-to-change imports from. If you are renaming a type or changing a function signature, upstream files may need updating too.

**Step 3: Enumerate the blast radius.** Write a one-line summary before editing:

```
Changing: ZscalerEventSchema.epochtime from string to number
Impacts: 
  - parser/zscaler.ts (coercion logic)
  - routes/uploads.ts (no direct impact)
  - detection/beaconing.ts (uses epochTime field, needs number)
  - detection/exfil.ts (uses epochTime field, needs number)
  - prisma/schema.prisma (LogEntry.epochTime already Int)
Action: Update parser only, verify detection code works with Int
```

**Step 4: Make the change.** Edit the target file.

**Step 5: Update every consumer.** For each file in the blast radius, verify it still compiles and behaves correctly. If a type changed, update every consumer.

**Step 6: Verify the chain.** Run `npx tsc --noEmit` in the affected workspace (backend or frontend) to catch type errors across the whole dependency graph.

---

## Change Impact Checklist (Run Before EVERY Edit)

```
□ What am I changing?
□ What files import from this file? (grep first)
□ What types might need to update in consumers?
□ Does this affect the Prisma schema? (if yes, run prisma generate)
□ Does this affect an API contract? (if yes, update frontend types too)
□ Does this affect a Zod schema? (if yes, verify all parse() callers)
□ Does this affect a Claude prompt? (if yes, verify validator schema matches)
□ Am I about to break a test? (run tests after change)
```

Skip this checklist and you will create cascading failures.

---

## Full-Stack Change Propagation Rules

When a change crosses the frontend/backend boundary, update BOTH sides in the same task. Never leave the stack inconsistent.

**If you add an API endpoint**, you must:
1. Add the Express route handler in `backend/src/routes/`
2. Add the Zod request/response schemas in `backend/src/schemas/`
3. Add the React Query hook in `frontend/lib/api/`
4. Add the TypeScript types in `frontend/lib/types/` (duplicate from backend schemas)
5. Verify the frontend hook uses the exact same URL path as the backend route

**If you change a Prisma model**, you must:
1. Update `backend/prisma/schema.prisma`
2. Run `npx prisma db push` (prototype, no migrations)
3. Run `npx prisma generate`
4. Update any Zod schemas that mirror the model
5. Update any API response types that include the model
6. Update any seed data files that insert into the model
7. Update any frontend types that display the model

**If you change a Claude prompt**, you must:
1. Update the prompt template in `backend/src/llm/prompts.ts`
2. Update the corresponding Zod output schema in the same file
3. Update any consumer code that reads fields from the Claude response
4. Test with a fake Claude response to confirm parsing still works

---

## Task Completion Protocol

After completing each task in BUILD_PLAN.md, verify BEFORE moving to the next task:

**Compile check:**
```bash
# In the affected workspace
npx tsc --noEmit
# Expect: no errors
```

**Lint check (if configured):**
```bash
npm run lint
# Expect: no errors
```

**Unit test check (if tests exist for this area):**
```bash
npm test
# Expect: all passing
```

**Manual verification:**
- Read through the acceptance criteria listed in the task
- Mentally trace through the code path you just wrote
- If anything feels wrong, stop and investigate

**Git commit:**
```bash
git add .
git commit -m "feat: <task description from BUILD_PLAN.md>"
```

Keep commits small and task-scoped. Do not batch multiple tasks into one commit.

---

## Code Quality Standards

**TypeScript:**
- strict mode enabled in tsconfig.json
- no `any` types unless absolutely necessary (document why)
- no `@ts-ignore` without explanatory comment
- prefer `unknown` over `any` for untyped data
- use Zod for all runtime validation

**Error handling:**
- every async function has try/catch OR the caller handles errors
- every fetch/axios call has error handling
- every JSON.parse has try/catch
- every external API call has timeout + error handling

**React:**
- no `any` in component props
- loading and error states for every async operation
- key prop on every mapped list
- no inline styles (use Tailwind classes)

**Express:**
- every route handler is wrapped in try/catch or async handler wrapper
- every route validates input with Zod before processing
- error responses use consistent JSON shape: `{ error: string, details?: unknown }`
- no sensitive info in error messages sent to client

**Database:**
- no raw SQL unless absolutely necessary
- every query filters by user/upload where applicable
- use transactions for multi-step writes

---

## Anti-Hallucination Patterns

**Pattern 1: Library API verification**
Before using any library method, verify it exists:
```
Example: "I need to call prisma.logEntry.createMany"
Verify: Check node_modules/@prisma/client/index.d.ts for createMany on LogEntryDelegate
Or: Check Prisma docs for the exact method signature
Do NOT: Assume the method exists with the signature you remember
```

**Pattern 2: Type verification**
Before assigning a value to a typed variable, verify the type:
```
Example: "This prisma result has an epochTime field"
Verify: Look at the Prisma model definition
Or: Use VS Code's hover to see the actual type
Do NOT: Assume fields exist because they "should"
```

**Pattern 3: External service verification**
Before writing code that calls Claude, Zscaler parser, or other external systems:
```
Verify the exact JSON structure with a sample
Use the provided sample log file in example-logs/
Run a test parse before writing detection rules
Do NOT: Write parser assuming a schema, then write detection rules on that assumption
```

**Pattern 4: Configuration verification**
Before writing code that reads env vars:
```
Verify the env var name in .env.example matches exactly
Check both backend and frontend .env.example files if applicable
Do NOT: Write process.env.BACKEND_URL if the actual var is NEXT_PUBLIC_BACKEND_URL
```

---

## When Something Goes Wrong

**If TypeScript errors appear:**
1. Read the full error message including file paths
2. Understand WHAT the mismatch is (expected vs actual)
3. Fix at the root cause, not by casting to any
4. Verify the fix did not break downstream

**If a test fails:**
1. Read the assertion that failed
2. Determine if test is wrong or implementation is wrong
3. Fix whichever is wrong, do not delete the test

**If Claude API returns unexpected output:**
1. Log the raw response
2. Check if Zod validation caught the issue
3. Update the prompt OR update the validator
4. Do NOT silently swallow and move on

**If Prisma throws on a query:**
1. Read the error (often relation or field name issue)
2. Compare the query to the schema.prisma
3. Run `npx prisma generate` if you recently changed schema
4. Check database state with `npx prisma studio`

**If the dev server won't start:**
1. Check env vars are all set
2. Check port is not in use
3. Check Docker Postgres is running
4. Read the actual error message

---

## Self-Check Before Declaring a Task Done

For every task in BUILD_PLAN.md, before marking it complete and moving on:

```
Self-check questions:
1. Did I read the acceptance criteria and meet ALL of them?
2. Did I create/modify every file listed for this task?
3. Did I update downstream consumers per the Change Impact Checklist?
4. Does `npx tsc --noEmit` pass in affected workspaces?
5. Did I commit with a clear message?
6. Can the next task start with this task's output?
```

If you cannot answer yes to all six, the task is not done.

---

## Coordination With User

**When to proceed autonomously:**
- Task is fully specified in BUILD_PLAN.md
- All acceptance criteria are clear
- You have full code snippets to work from

**When to stop and report:**
- You hit a library version incompatibility
- You get a non-obvious TypeScript error
- A test fails in an unexpected way
- The deployed site does not load
- Anthropic API is down or returning unexpected errors
- You need to deviate from BUILD_PLAN.md for any reason

When reporting a blocker, include:
1. What task you were on
2. What specifically failed (exact error message)
3. What you tried
4. Your proposed fix and why

Do not spend more than 15 minutes stuck before reporting. The user can unblock you faster than you can guess.

---

## File Structure Awareness

You will be working across these directories:

```
tenex-log-analyzer/
├── backend/          (Express API, Prisma, detection, LLM)
├── frontend/         (Next.js 15 App Router)
├── example-logs/     (synthetic sample data)
├── docker-compose.yml
└── README.md
```

When working in a specific task, know which directory is your working directory. Do not accidentally create files at the wrong level of the tree.

---

## Reading Order When You Start a Session

Every time you resume work on this project:
1. Read this file (CLAUDE.md) completely
2. Read BUILD_PLAN.md, specifically the current task section
3. Read the last git commit message to know what was just finished
4. Check `npx tsc --noEmit` for any preexisting errors
5. Only then, begin work

---

## Final Commitment

You are building a working prototype that demonstrates engineering judgment to an experienced CTO at a cybersecurity company. The bar is not "flawless production system." The bar is "thoughtful, working prototype that handles real edge cases gracefully."

Ship working code. Handle errors. Document decisions. Do not over-engineer.

When in doubt, refer to BUILD_PLAN.md. When the plan is silent, stop and ask.
