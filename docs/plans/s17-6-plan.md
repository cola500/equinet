---
title: "S17-6: Edge Config for feature flags -- Implementation Plan"
description: "TDD-plan for att byta feature flag-lasning till Vercel Edge Config"
category: plan
status: wip
last_updated: 2026-04-05
sections:
  - Overview
  - Task 1
  - Task 2
  - Task 3
  - Task 4
  - Task 5
---

# S17-6: Edge Config for Feature Flags -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Byt feature flag read-path fran PostgreSQL (30s cache, ~50ms) till Vercel Edge Config (<1ms) med DB-fallback.

**Architecture:** Ny modul `edge-config.ts` wrapprar `@vercel/edge-config` for reads och Vercel REST API for writes. `feature-flags.ts` anropar Edge Config forst, faller tillbaka till DB. Skriv-path synkar alla flaggor till Edge Config efter varje DB-upsert.

**Tech Stack:** `@vercel/edge-config`, Vercel REST API, Vitest

---

### Task 1: Installera @vercel/edge-config

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Installera paketet**

Run: `npm install @vercel/edge-config`

- [ ] **Step 2: Verifiera installation**

Run: `npm ls @vercel/edge-config`
Expected: Visar installerad version

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @vercel/edge-config for S17-6"
```

---

### Task 2: Skapa edge-config.ts med tester (TDD)

**Files:**
- Create: `src/lib/edge-config.ts`
- Create: `src/lib/edge-config.test.ts`

- [ ] **Step 1: Skriv failing test for readFlagsFromEdgeConfig**

Skapa `src/lib/edge-config.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock @vercel/edge-config BEFORE importing our module
vi.mock("@vercel/edge-config", () => ({
  get: vi.fn(),
}))

import { get as edgeConfigGet } from "@vercel/edge-config"
import { readFlagsFromEdgeConfig, syncFlagsToEdgeConfig } from "./edge-config"

const mockEdgeConfigGet = vi.mocked(edgeConfigGet)

describe("edge-config", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe("readFlagsFromEdgeConfig", () => {
    it("returns flags from Edge Config when available", async () => {
      process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_test"
      const mockFlags = { voice_logging: true, group_bookings: false }
      mockEdgeConfigGet.mockResolvedValue(mockFlags)

      const result = await readFlagsFromEdgeConfig()

      expect(result).toEqual(mockFlags)
      expect(mockEdgeConfigGet).toHaveBeenCalledWith("feature_flags")
    })

    it("returns null when EDGE_CONFIG env var is missing", async () => {
      delete process.env.EDGE_CONFIG

      const result = await readFlagsFromEdgeConfig()

      expect(result).toBeNull()
      expect(mockEdgeConfigGet).not.toHaveBeenCalled()
    })

    it("returns null when Edge Config returns undefined", async () => {
      process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_test"
      mockEdgeConfigGet.mockResolvedValue(undefined)

      const result = await readFlagsFromEdgeConfig()

      expect(result).toBeNull()
    })

    it("returns null on Edge Config error", async () => {
      process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_test"
      mockEdgeConfigGet.mockRejectedValue(new Error("Edge Config unavailable"))

      const result = await readFlagsFromEdgeConfig()

      expect(result).toBeNull()
    })
  })
})
```

Run: `npx vitest run src/lib/edge-config.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 2: Implementera readFlagsFromEdgeConfig**

Skapa `src/lib/edge-config.ts`:

```typescript
import { get } from "@vercel/edge-config"
import { logger } from "./logger"

/**
 * Read feature flags from Vercel Edge Config.
 * Returns null if Edge Config is unavailable or not configured.
 */
export async function readFlagsFromEdgeConfig(): Promise<Record<string, boolean> | null> {
  if (!process.env.EDGE_CONFIG) return null

  try {
    const flags = await get<Record<string, boolean>>("feature_flags")
    return flags ?? null
  } catch (error) {
    logger.warn("Failed to read feature flags from Edge Config, falling back to DB", {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
```

Run: `npx vitest run src/lib/edge-config.test.ts`
Expected: 4 PASS

- [ ] **Step 3: Skriv failing tester for syncFlagsToEdgeConfig**

Lagg till i `src/lib/edge-config.test.ts`:

```typescript
  describe("syncFlagsToEdgeConfig", () => {
    const mockFetch = vi.fn()

    beforeEach(() => {
      vi.stubGlobal("fetch", mockFetch)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it("sends flags to Vercel REST API", async () => {
      process.env.EDGE_CONFIG_ID = "ecfg_test123"
      process.env.VERCEL_API_TOKEN = "token_abc"
      mockFetch.mockResolvedValue({ ok: true })

      const flags = { voice_logging: true, group_bookings: false }
      await syncFlagsToEdgeConfig(flags)

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.vercel.com/v1/edge-config/ecfg_test123/items",
        expect.objectContaining({
          method: "PATCH",
          headers: expect.objectContaining({
            Authorization: "Bearer token_abc",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            items: [{ operation: "upsert", key: "feature_flags", value: flags }],
          }),
        })
      )
    })

    it("skips silently when EDGE_CONFIG_ID is missing", async () => {
      delete process.env.EDGE_CONFIG_ID
      process.env.VERCEL_API_TOKEN = "token_abc"

      await syncFlagsToEdgeConfig({ voice_logging: true })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("skips silently when VERCEL_API_TOKEN is missing", async () => {
      process.env.EDGE_CONFIG_ID = "ecfg_test123"
      delete process.env.VERCEL_API_TOKEN

      await syncFlagsToEdgeConfig({ voice_logging: true })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("logs error but does not throw on API failure", async () => {
      process.env.EDGE_CONFIG_ID = "ecfg_test123"
      process.env.VERCEL_API_TOKEN = "token_abc"
      mockFetch.mockRejectedValue(new Error("Network error"))

      // Should not throw
      await expect(
        syncFlagsToEdgeConfig({ voice_logging: true })
      ).resolves.toBeUndefined()
    })
  })
```

Run: `npx vitest run src/lib/edge-config.test.ts`
Expected: sync-tester FAIL

- [ ] **Step 4: Implementera syncFlagsToEdgeConfig**

Lagg till i `src/lib/edge-config.ts`:

```typescript
/**
 * Sync all feature flags to Vercel Edge Config via REST API.
 * Fire-and-forget: logs errors but never throws.
 * Requires EDGE_CONFIG_ID and VERCEL_API_TOKEN (scoped token, not admin).
 */
export async function syncFlagsToEdgeConfig(
  flags: Record<string, boolean>
): Promise<void> {
  const edgeConfigId = process.env.EDGE_CONFIG_ID
  const token = process.env.VERCEL_API_TOKEN
  if (!edgeConfigId || !token) return

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ operation: "upsert", key: "feature_flags", value: flags }],
        }),
      }
    )
    if (!response.ok) {
      logger.warn("Edge Config sync failed", {
        status: response.status,
        edgeConfigId,
      })
    }
  } catch (error) {
    logger.warn("Edge Config sync error", {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
```

Run: `npx vitest run src/lib/edge-config.test.ts`
Expected: 8 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/edge-config.ts src/lib/edge-config.test.ts
git commit -m "feat: edge-config read/write wrapper with tests (S17-6)"
```

---

### Task 3: Integrera Edge Config i feature-flags.ts (TDD)

**Files:**
- Modify: `src/lib/feature-flags.ts`
- Modify: `src/lib/feature-flags.test.ts`

- [ ] **Step 1: Skriv failing test for Edge Config read-path**

Lagg till mock och tester i `src/lib/feature-flags.test.ts`.

Langst upp, FORE import av feature-flags:

```typescript
vi.mock("./edge-config", () => ({
  readFlagsFromEdgeConfig: vi.fn().mockResolvedValue(null),
  syncFlagsToEdgeConfig: vi.fn().mockResolvedValue(undefined),
}))

import { readFlagsFromEdgeConfig, syncFlagsToEdgeConfig } from "./edge-config"
const mockReadEdgeConfig = vi.mocked(readFlagsFromEdgeConfig)
const mockSyncEdgeConfig = vi.mocked(syncFlagsToEdgeConfig)
```

I `beforeEach`, lagg till:
```typescript
mockReadEdgeConfig.mockResolvedValue(null)
mockSyncEdgeConfig.mockResolvedValue(undefined)
```

Lagg till ny describe-block:

```typescript
  describe("Edge Config integration", () => {
    it("reads from Edge Config when available", async () => {
      mockReadEdgeConfig.mockResolvedValue({
        voice_logging: false,
        group_bookings: true,
      })

      const flags = await getFeatureFlags()

      expect(flags.voice_logging).toBe(false)
      expect(flags.group_bookings).toBe(true)
      // Flags not in Edge Config fall back to code default
      expect(flags.route_planning).toBe(true)
    })

    it("falls back to DB when Edge Config returns null", async () => {
      mockReadEdgeConfig.mockResolvedValue(null)
      await mockRepo.upsert("voice_logging", false)

      const flags = await getFeatureFlags()

      expect(flags.voice_logging).toBe(false)
    })

    it("env var overrides Edge Config", async () => {
      process.env.FEATURE_VOICE_LOGGING = "true"
      mockReadEdgeConfig.mockResolvedValue({ voice_logging: false })

      const flags = await getFeatureFlags()

      expect(flags.voice_logging).toBe(true)
    })

    it("syncs to Edge Config after setFeatureFlagOverride", async () => {
      await setFeatureFlagOverride("group_bookings", "true")

      expect(mockSyncEdgeConfig).toHaveBeenCalledWith(
        expect.objectContaining({ group_bookings: true })
      )
    })

    it("syncs to Edge Config after removeFeatureFlagOverride", async () => {
      await removeFeatureFlagOverride("group_bookings")

      expect(mockSyncEdgeConfig).toHaveBeenCalled()
    })
  })
```

Run: `npx vitest run src/lib/feature-flags.test.ts`
Expected: Edge Config tester FAIL (readFlagsFromEdgeConfig inte anropad an)

- [ ] **Step 2: Implementera Edge Config read-path i getFeatureFlags**

Andra `src/lib/feature-flags.ts`:

Lagg till import langst upp:
```typescript
import { readFlagsFromEdgeConfig, syncFlagsToEdgeConfig } from "./edge-config"
```

Ersatt `getFeatureFlags()` med:

```typescript
export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const keys = Object.keys(FEATURE_FLAGS)
  const result: Record<string, boolean> = {}

  // Try Edge Config first, fall back to DB
  let edgeConfigFlags: Record<string, boolean> | null = null
  let dbOverrides: Record<string, boolean> = {}

  // Edge Config (fast path, no cache needed -- <1ms reads)
  edgeConfigFlags = await readFlagsFromEdgeConfig()

  // DB fallback (with 30s cache)
  if (edgeConfigFlags === null) {
    if (isCacheValid()) {
      dbOverrides = cache!.data
    } else {
      try {
        const repo = getRepository()
        const flags = await repo.findAll()
        for (const flag of flags) {
          dbOverrides[flag.key] = flag.enabled
        }
        cache = { data: dbOverrides, timestamp: Date.now() }
      } catch (error) {
        logger.warn("Failed to fetch feature flags from database, using defaults", {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  for (const key of keys) {
    const flag = FEATURE_FLAGS[key]

    // 1. Env variable (highest priority)
    const envKey = `FEATURE_${key.toUpperCase()}`
    const envValue = process.env[envKey]
    if (envValue !== undefined) {
      result[key] = envValue === "true"
      continue
    }

    // 2. Edge Config override
    if (edgeConfigFlags && key in edgeConfigFlags) {
      result[key] = edgeConfigFlags[key]
      continue
    }

    // 3. Database override
    if (key in dbOverrides) {
      result[key] = dbOverrides[key]
      continue
    }

    // 4. Code default
    result[key] = flag.defaultEnabled
  }

  return result
}
```

Run: `npx vitest run src/lib/feature-flags.test.ts`
Expected: Read-tester PASS, sync-tester FAIL

- [ ] **Step 3: Implementera Edge Config sync i write-path**

I `setFeatureFlagOverride`, lagg till sync efter invalidateCache():

```typescript
export async function setFeatureFlagOverride(
  key: string,
  value: string
): Promise<void> {
  try {
    const repo = getRepository()
    await repo.upsert(key, value === "true")
    invalidateCache()
    // Sync all flags to Edge Config (fire-and-forget)
    const allFlags = await getFeatureFlags()
    syncFlagsToEdgeConfig(allFlags).catch(() => {})
  } catch (error) {
    const message = error instanceof Error ? error.message : "okant fel"
    throw new Error(`Kunde inte uppdatera flaggan ${key}: ${message}`)
  }
}
```

I `removeFeatureFlagOverride`, lagg till sync pa samma satt:

```typescript
export async function removeFeatureFlagOverride(key: string): Promise<void> {
  const flag = FEATURE_FLAGS[key]
  const defaultValue = flag?.defaultEnabled ?? false
  try {
    const repo = getRepository()
    await repo.upsert(key, defaultValue)
    invalidateCache()
    // Sync all flags to Edge Config (fire-and-forget)
    const allFlags = await getFeatureFlags()
    syncFlagsToEdgeConfig(allFlags).catch(() => {})
  } catch (error) {
    const message = error instanceof Error ? error.message : "okant fel"
    throw new Error(`Kunde inte uppdatera flaggan ${key}: ${message}`)
  }
}
```

Run: `npx vitest run src/lib/feature-flags.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/feature-flags.ts src/lib/feature-flags.test.ts
git commit -m "feat: integrate Edge Config read/write in feature-flags (S17-6)"
```

---

### Task 4: Verifiera alla quality gates

**Files:** Inga andringar

- [ ] **Step 1: Kor typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 2: Kor alla tester**

Run: `npm run test:run`
Expected: Alla ~3968 tester PASS

- [ ] **Step 3: Kor lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Kor check:all**

Run: `npm run check:all`
Expected: 4/4 gates grona

---

### Task 5: Done-fil, status-uppdatering och merge

**Files:**
- Create: `docs/done/s17-6-done.md`
- Modify: `docs/sprints/status.md`

- [ ] **Step 1: Skriv done-fil**

Skapa `docs/done/s17-6-done.md` med:
- Acceptanskriterier bockade
- Definition of Done bockade
- Reviews korda (tech-architect + code-reviewer)
- Avvikelser (Edge Config kravs pa Vercel -- inget lokalt)
- Lardomar

- [ ] **Step 2: Uppdatera status.md**

S17-6 -> done + commit-hash

- [ ] **Step 3: Committa BADA i samma commit**

```bash
git add docs/done/s17-6-done.md docs/sprints/status.md
git commit -m "docs: S17-6 done-fil och status uppdaterad"
```

- [ ] **Step 4: Merga till main**

```bash
git push -u origin feature/s17-6-edge-config
git checkout main && git pull origin main
git merge feature/s17-6-edge-config --no-ff -m "Merge feature/s17-6: Edge Config for feature flags"
git push origin main
git branch -d feature/s17-6-edge-config
git push origin --delete feature/s17-6-edge-config
```

- [ ] **Step 5: Setup Edge Config pa Vercel**

Manuellt steg (Johan):
1. Vercel Dashboard -> Storage -> Edge Config -> Create Store
2. Koppla till equinet-projektet (auto-injectar EDGE_CONFIG env var)
3. Skapa scoped API-token: Settings -> Tokens -> Create -> scope: edge-config
4. Lagg till i Vercel env vars: `EDGE_CONFIG_ID`, `VERCEL_API_TOKEN`
5. Redeploya
6. Toggla en flagga i admin -> verifiera i Edge Config Dashboard att vardet synkades
