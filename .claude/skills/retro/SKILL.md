---
name: retro
description: Create a retrospective and update project documentation after a completed story
argument-hint: "[story description, e.g. 'leverantorsanteckningar pa bokningar']"
---

Create a retrospective for: **$ARGUMENTS**

Analyze the session, write a retro document, and update relevant project documentation.

## 1. Analyze the session

Run these in parallel to gather data:

- `git diff main --stat` -- files changed (count and names)
- `git diff main --name-only` -- just file names for categorization
- `git log main..HEAD --oneline` -- commits in this session (if on feature branch), OR `git log --oneline -10` if on main
- `npm run test:run -- --reporter=dot 2>&1 | tail -5` -- total test count
- Search for new migration directories: `ls -la prisma/migrations/ | tail -5`

From this data, extract:
- Number of changed/new files
- Number of new tests (compare with previous count if known, or count test files in diff)
- New migrations
- Which layers were touched (Schema, API, Domain, Repository, UI, Types, etc.)

## 2. Create the retrospective

Create a new file: `docs/retrospectives/YYYY-MM-DD-<slug>.md`

Where `<slug>` is a kebab-case summary derived from `$ARGUMENTS` (e.g. "leverantorsanteckningar" or "customer-registry").

Use this template (based on 21 existing retros in the project):

```markdown
# Retrospektiv: <Title from $ARGUMENTS>

**Datum:** YYYY-MM-DD
**Scope:** <kort beskrivning av vad som byggdes>

---

## Resultat

- X andrade filer, Y nya filer, Z nya migrationer
- N nya tester (alla TDD, alla grona)
- TOTAL totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| ... | ... | ... |

## Vad gick bra

### 1. <Insikt>
<Forklaring>

### 2. <Insikt>
<Forklaring>

## Vad kan forbattras

### 1. <Forbattring>
<Forklaring>

**Prioritet:** HOG/MEDEL/LAG -- <motivering>

## Patterns att spara

### <Pattern-namn>
<Beskrivning av monstret och hur det ateranvands>

## 5 Whys (Root-Cause Analysis)

For the 2-3 most significant problems encountered during the session, ask "why?" five
times to find the root cause. Skip this section if the session had no notable problems.

### Problem: <kort beskrivning>
1. Varfor? <forsta svaret>
2. Varfor? <djupare orsak>
3. Varfor? <annu djupare>
4. Varfor? <nara grundorsaken>
5. Varfor? <grundorsak>

**Atgard:** <systemforbattring, inte bara en fix>
**Status:** Implementerad / Att gora / Parkerad

## Larandeeffekt

**Nyckelinsikt:** <Viktigaste lardomen fran sessionen>
```

Fill in each section based on the analysis from step 1. Be specific:
- "Vad som byggdes" should list every layer touched with specific file names
- "Vad gick bra" should highlight 2-4 concrete wins (TDD catches, pattern reuse, etc.)
- "Vad kan forbattras" should be honest about shortcuts or tech debt
- "Patterns att spara" should document reusable patterns for future sessions
- "5 Whys" should dig into 2-3 notable problems to find root causes and systemic fixes. Skip if no significant problems occurred. The goal is system improvements (process, tooling, documentation), not just one-off fixes.

## 3. Assess which docs need updating

Review the changes and determine which files are relevant. Do NOT update files that aren't affected.

**Checklist -- update ONLY if relevant:**

| File | Update when... | Section to update |
|------|---------------|-------------------|
| `docs/api/*.md` | New or changed API routes | Add endpoint to relevant domain file + index in `docs/API.md` |
| `CLAUDE.md` | New patterns, gotchas, or key learnings | "Key Learnings" section at the bottom |
| `docs/DATABASE-ARCHITECTURE.md` | Schema changes (new tables, fields, relations) | Relevant schema section |
| `README.md` | New user-facing features | Features list or description |
| `docs/ANVANDARDOKUMENTATION.md` | New or changed user-facing functionality | Relevant feature section |

**Decision criteria:**
- Schema changed? -> DATABASE-ARCHITECTURE.md
- New API endpoints? -> `docs/api/<domain>.md` + index row in `docs/API.md`
- New patterns or gotchas discovered? -> CLAUDE.md "Key Learnings"
- New user-visible feature? -> README.md
- Changed how users interact with a feature? -> docs/ANVANDARDOKUMENTATION.md

Read each file before editing to find the exact section to update. Make minimal, targeted edits.

## 4. Update selected docs

For each file identified in step 3:

### CLAUDE.md
- Add new patterns to "Key Learnings -> Utvecklingsmonster" (or appropriate subsection)
- Add new gotchas to "Key Learnings -> Operationella fallor" if discovered
- Keep entries concise (1-2 lines each)

### docs/api/*.md (API-dokumentation)
- Add new endpoints to the relevant domain file in `docs/api/` (auth, bookings, customers, horses, providers, admin, group-bookings, routes, voice-and-ai)
- Add a row to the endpoint-index table in `docs/API.md`
- Include method, path, auth requirement, request/response shape

### docs/DATABASE-ARCHITECTURE.md
- Document new tables, fields, or relations
- Follow the existing format in the file

### README.md
- Update features list if a new user-facing feature was added
- Keep it brief -- one line per feature

### docs/ANVANDARDOKUMENTATION.md
- Update when user-facing functionality changes (new features, changed flows, new settings)
- Add new sections or update existing ones to describe the feature from the user's perspective
- Keep language non-technical -- this is for end users, not developers

## 5. Update MEMORY.md

Always update `/Users/johanlindengard/.claude/projects/-Users-johanlindengard-Development-equinet/memory/MEMORY.md`:

- Add a new session summary under "Senaste sessioner" with today's date
- Include: story count, test count, key files, patterns learned
- Keep previous sessions but trim old ones if approaching 200 lines
- Update "Projekt-overview" test count if it changed significantly

## Important

- Run `npm run typecheck` at the end to verify no docs broke anything
- Do NOT create empty sections -- skip sections that have nothing meaningful to add
- Be honest in "Vad kan forbattras" -- acknowledge shortcuts and tech debt
- Keep the retro concise but specific -- data over opinions
