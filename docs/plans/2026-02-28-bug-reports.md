# Bug Reports Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Backend-lagring av buggrapporter + admin-vy for triage (lista, detalj, uppdatera status/prio/kommentar).

**Architecture:** Stodoman med Prisma direkt i routes (inget repository-pattern). Tre user stories: (1) anvandare skapar rapport via refaktorerad BugReportFab, (2) admin listar/filtrerar, (3) admin uppdaterar status/prio/note. TDD for alla API-routes.

**Tech Stack:** Next.js App Router, Prisma, Zod, shadcn/ui, Vitest

---

## Fas 1: Datamodell + Migration

### Task 1.1: Lagg till BugReport i Prisma-schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Lagg till enums och modell**

Lagg till langst ner i `prisma/schema.prisma` (fore eventuell avslutande kommentar):

```prisma
enum BugReportStatus {
  NEW
  INVESTIGATING
  PLANNED
  FIXED
  DISMISSED
}

enum BugReportPriority {
  P0
  P1
  P2
  P3
}

model BugReport {
  id                String             @id @default(uuid())
  title             String
  description       String
  reproductionSteps String?
  pageUrl           String
  userAgent         String?
  platform          String?
  userRole          String             // CUSTOMER, PROVIDER, ADMIN
  status            BugReportStatus    @default(NEW)
  priority          BugReportPriority  @default(P2)
  internalNote      String?

  userId            String?
  user              User?              @relation(fields: [userId], references: [id])

  updatedBy         String?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@index([status])
  @@index([priority])
  @@index([createdAt])
}
```

**Step 2: Lagg till relation pa User-modellen**

I `model User`, lagg till bland relationerna (efter `municipalityWatches`):

```prisma
  bugReports                BugReport[]
```

**Step 3: Kor migration**

Run: `npx prisma migrate dev --name add_bug_report`
Expected: Migration skapas i `prisma/migrations/` och appliceras.

**Step 4: Verifiera**

Run: `npx prisma generate`
Run: `npm run typecheck`
Expected: 0 errors

**Step 5: Commit**

```
git add prisma/
git commit -m "feat: add BugReport model with status and priority enums"
```

---

## Fas 2: API - Skapa buggrapport (POST)

### Task 2.1: Skriv test for POST /api/bug-reports

**Files:**
- Create: `src/app/api/bug-reports/route.test.ts`

**Step 1: Skriv failande tester**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    bugReport: { create: vi.fn() },
  },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { bugReport: vi.fn() },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { POST } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters } from "@/lib/rate-limit"

const mockAuth = vi.mocked(auth)
const mockCreate = vi.mocked(prisma.bugReport.create)
const mockRateLimit = vi.mocked(rateLimiters.bugReport)

const mockSession = {
  user: { id: "user-1", email: "test@test.se", userType: "customer" },
} as never

function createRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/bug-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validBody = {
  title: "Knappen fungerar inte",
  description: "Nar jag klickar pa boka-knappen hander inget",
  reproductionSteps: "1. Ga till leverantorssidan\n2. Klicka boka",
  pageUrl: "/providers/123",
  userAgent: "Mozilla/5.0",
  platform: "MacOS",
}

describe("POST /api/bug-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(mockSession)
    mockRateLimit.mockResolvedValue(true)
    mockCreate.mockResolvedValue({
      id: "bug-1",
      ...validBody,
      userRole: "CUSTOMER",
      userId: "user-1",
      status: "NEW",
      priority: "P2",
      internalNote: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(429)
  })

  it("returns 400 when title is missing", async () => {
    const res = await POST(createRequest({ ...validBody, title: "" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when description is missing", async () => {
    const res = await POST(createRequest({ ...validBody, description: "" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/bug-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 201 with bug report ID on success", async () => {
    const res = await POST(createRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe("bug-1")
    expect(body.status).toBe("NEW")
  })

  it("derives userRole from session userType", async () => {
    await POST(createRequest(validBody))

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userRole: "CUSTOMER",
          userId: "user-1",
        }),
      })
    )
  })

  it("trims title and description", async () => {
    await POST(createRequest({
      ...validBody,
      title: "  Trimma mig  ",
      description: "  Trimma mig  ",
    }))

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Trimma mig",
          description: "Trimma mig",
        }),
      })
    )
  })

  it("returns 500 on database error", async () => {
    mockCreate.mockRejectedValue(new Error("DB down"))
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(500)
  })
})
```

**Step 2: Kor testet, verifiera att det failar**

Run: `npx vitest run src/app/api/bug-reports/route.test.ts`
Expected: FAIL (route.ts finns inte an)

### Task 2.2: Implementera POST /api/bug-reports

**Files:**
- Create: `src/app/api/bug-reports/route.ts`

**Step 1: Implementera routen**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const createBugReportSchema = z.object({
  title: z.string().trim().min(1, "Titel kravs").max(200),
  description: z.string().trim().min(1, "Beskrivning kravs").max(5000),
  reproductionSteps: z.string().trim().max(5000).optional(),
  pageUrl: z.string().max(500),
  userAgent: z.string().max(500).optional(),
  platform: z.string().max(100).optional(),
}).strict()

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.bugReport(
      session.user?.id || clientIp
    )
    if (!isAllowed) {
      return NextResponse.json(
        { error: "For manga forfrагningar. Forsok igen senare." },
        { status: 429 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON" },
        { status: 400 }
      )
    }

    const validated = createBugReportSchema.parse(body)

    const userType = (session.user as { userType?: string })?.userType
    const userRole = userType === "provider"
      ? "PROVIDER"
      : userType === "customer"
        ? "CUSTOMER"
        : "UNKNOWN"

    const bugReport = await prisma.bugReport.create({
      data: {
        title: validated.title,
        description: validated.description,
        reproductionSteps: validated.reproductionSteps || null,
        pageUrl: validated.pageUrl,
        userAgent: validated.userAgent || null,
        platform: validated.platform || null,
        userRole,
        userId: session.user?.id || null,
      },
    })

    logger.info("Bug report created", { bugReportId: bugReport.id })

    return NextResponse.json(
      { id: bugReport.id, status: bugReport.status },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Failed to create bug report", error as Error)
    return NextResponse.json(
      { error: "Kunde inte skapa buggrapport" },
      { status: 500 }
    )
  }
}
```

**Step 2: Lagg till rate limiter**

I `src/lib/rate-limit.ts`, lagg till `bugReport` i Upstash-limiters (efter `subscription`):

```typescript
bugReport: new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: true,
  prefix: "ratelimit:bug-report",
}),
```

Lagg till i in-memory configs:

```typescript
bugReport: { max: 50, window: 60 * 60 * 1000 },
```

Lagg till i `rateLimiters` export:

```typescript
bugReport: async (identifier: string) => checkRateLimit('bugReport', identifier),
```

**Step 3: Kor testerna**

Run: `npx vitest run src/app/api/bug-reports/route.test.ts`
Expected: ALL PASS

**Step 4: Kor typecheck**

Run: `npm run typecheck`
Expected: 0 errors

**Step 5: Commit**

```
git add src/app/api/bug-reports/ src/lib/rate-limit.ts
git commit -m "feat: add POST /api/bug-reports with rate limiting and validation"
```

---

## Fas 3: Admin API - Lista + Detalj + Uppdatera

### Task 3.1: Skriv tester for admin API routes

**Files:**
- Create: `src/app/api/admin/bug-reports/route.test.ts`
- Create: `src/app/api/admin/bug-reports/[id]/route.test.ts`

**Step 1: Skriv test for GET /api/admin/bug-reports (lista)**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    bugReport: { findMany: vi.fn(), count: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), security: vi.fn() },
}))

import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

const mockAuth = vi.mocked(auth)
const mockFindUnique = vi.mocked(prisma.user.findUnique)
const mockFindMany = vi.mocked(prisma.bugReport.findMany)
const mockCount = vi.mocked(prisma.bugReport.count)

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.se", userType: "provider" },
} as never

function createRequest(params = "") {
  return new NextRequest(
    `http://localhost:3000/api/admin/bug-reports${params ? `?${params}` : ""}`,
    { method: "GET" }
  )
}

describe("GET /api/admin/bug-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(mockAdminSession)
    mockFindUnique.mockResolvedValue({ id: "admin-1", isAdmin: true } as never)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )
    const res = await GET(createRequest())
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is not admin", async () => {
    mockFindUnique.mockResolvedValue({ id: "admin-1", isAdmin: false } as never)
    const res = await GET(createRequest())
    expect(res.status).toBe(403)
  })

  it("returns 200 with bug reports list", async () => {
    const mockBugs = [
      { id: "bug-1", title: "Test bug", status: "NEW", priority: "P2", createdAt: new Date() },
    ]
    mockFindMany.mockResolvedValue(mockBugs as never)
    mockCount.mockResolvedValue(1)

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.bugReports).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  it("filters by status query param", async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await GET(createRequest("status=NEW"))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "NEW" }),
      })
    )
  })

  it("returns 500 on database error", async () => {
    mockFindMany.mockRejectedValue(new Error("DB down"))
    const res = await GET(createRequest())
    expect(res.status).toBe(500)
  })
})
```

**Step 2: Skriv test for GET + PATCH /api/admin/bug-reports/[id]**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    bugReport: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), security: vi.fn() },
}))

import { GET, PATCH } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

const mockAuth = vi.mocked(auth)
const mockUserFindUnique = vi.mocked(prisma.user.findUnique)
const mockBugFindUnique = vi.mocked(prisma.bugReport.findUnique)
const mockUpdate = vi.mocked(prisma.bugReport.update)

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.se", userType: "provider" },
} as never

const mockBug = {
  id: "bug-1",
  title: "Test",
  description: "Test desc",
  reproductionSteps: null,
  pageUrl: "/test",
  userAgent: "Mozilla",
  platform: "MacOS",
  userRole: "CUSTOMER",
  status: "NEW",
  priority: "P2",
  internalNote: null,
  userId: "user-1",
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { firstName: "Test", lastName: "User", email: "test@test.se" },
}

const routeContext = { params: Promise.resolve({ id: "bug-1" }) }

function createGetRequest() {
  return new NextRequest(
    "http://localhost:3000/api/admin/bug-reports/bug-1",
    { method: "GET" }
  )
}

function createPatchRequest(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost:3000/api/admin/bug-reports/bug-1",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}

describe("GET /api/admin/bug-reports/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(mockAdminSession)
    mockUserFindUnique.mockResolvedValue({ id: "admin-1", isAdmin: true } as never)
    mockBugFindUnique.mockResolvedValue(mockBug as never)
  })

  it("returns 403 when user is not admin", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "admin-1", isAdmin: false } as never)
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(403)
  })

  it("returns 404 when bug report not found", async () => {
    mockBugFindUnique.mockResolvedValue(null)
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(404)
  })

  it("returns 200 with bug report details", async () => {
    const res = await GET(createGetRequest(), routeContext)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe("bug-1")
    expect(body.title).toBe("Test")
  })
})

describe("PATCH /api/admin/bug-reports/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(mockAdminSession)
    mockUserFindUnique.mockResolvedValue({ id: "admin-1", isAdmin: true } as never)
    mockBugFindUnique.mockResolvedValue(mockBug as never)
    mockUpdate.mockResolvedValue({ ...mockBug, status: "INVESTIGATING" } as never)
  })

  it("returns 403 when user is not admin", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "admin-1", isAdmin: false } as never)
    const res = await PATCH(createPatchRequest({ status: "INVESTIGATING" }), routeContext)
    expect(res.status).toBe(403)
  })

  it("returns 404 when bug report not found", async () => {
    mockBugFindUnique.mockResolvedValue(null)
    const res = await PATCH(createPatchRequest({ status: "INVESTIGATING" }), routeContext)
    expect(res.status).toBe(404)
  })

  it("returns 400 for invalid status", async () => {
    const res = await PATCH(createPatchRequest({ status: "INVALID" }), routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 200 on successful update", async () => {
    const res = await PATCH(
      createPatchRequest({ status: "INVESTIGATING", priority: "P1", internalNote: "Kollar pa detta" }),
      routeContext
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bug-1" },
        data: expect.objectContaining({
          status: "INVESTIGATING",
          priority: "P1",
          internalNote: "Kollar pa detta",
          updatedBy: "admin-1",
        }),
      })
    )
  })

  it("returns 500 on database error", async () => {
    mockUpdate.mockRejectedValue(new Error("DB down"))
    const res = await PATCH(createPatchRequest({ status: "INVESTIGATING" }), routeContext)
    expect(res.status).toBe(500)
  })
})
```

**Step 2: Kor testerna, verifiera att de failar**

Run: `npx vitest run src/app/api/admin/bug-reports/`
Expected: FAIL (route.ts finns inte an)

### Task 3.2: Implementera admin API routes

**Files:**
- Create: `src/app/api/admin/bug-reports/route.ts`
- Create: `src/app/api/admin/bug-reports/[id]/route.ts`

**Step 1: Implementera GET /api/admin/bug-reports (lista)**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    await requireAdmin(session)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const sortBy = searchParams.get("sortBy") || "createdAt"
    const sortOrder = searchParams.get("sortOrder") || "desc"

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }

    const orderBy: Record<string, string> = {}
    if (sortBy === "priority") {
      orderBy.priority = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    const [bugReports, total] = await Promise.all([
      prisma.bugReport.findMany({
        where,
        orderBy,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          userRole: true,
          pageUrl: true,
          createdAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.bugReport.count({ where }),
    ])

    return NextResponse.json({ bugReports, total })
  } catch (error) {
    if (error instanceof Response) return error
    logger.error("Failed to fetch bug reports", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hamta buggrapporter" },
      { status: 500 }
    )
  }
}
```

**Step 2: Implementera GET + PATCH /api/admin/bug-reports/[id]**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth-server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

const updateBugReportSchema = z.object({
  status: z.enum(["NEW", "INVESTIGATING", "PLANNED", "FIXED", "DISMISSED"]).optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  internalNote: z.string().trim().max(5000).optional(),
}).strict()

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    await requireAdmin(session)

    const { id } = await context.params

    const bugReport = await prisma.bugReport.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!bugReport) {
      return NextResponse.json(
        { error: "Buggrapport hittades inte" },
        { status: 404 }
      )
    }

    return NextResponse.json(bugReport)
  } catch (error) {
    if (error instanceof Response) return error
    logger.error("Failed to fetch bug report", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hamta buggrapport" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    const admin = await requireAdmin(session)

    const { id } = await context.params

    const existing = await prisma.bugReport.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Buggrapport hittades inte" },
        { status: 404 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON" },
        { status: 400 }
      )
    }

    const validated = updateBugReportSchema.parse(body)

    const updated = await prisma.bugReport.update({
      where: { id },
      data: {
        ...validated,
        updatedBy: admin.id,
      },
    })

    logger.info("Bug report updated", {
      bugReportId: id,
      changes: Object.keys(validated),
      adminId: admin.id,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Failed to update bug report", error as Error)
    return NextResponse.json(
      { error: "Kunde inte uppdatera buggrapport" },
      { status: 500 }
    )
  }
}
```

**Step 3: Kor alla tester**

Run: `npx vitest run src/app/api/bug-reports/ src/app/api/admin/bug-reports/`
Expected: ALL PASS

**Step 4: Kor typecheck**

Run: `npm run typecheck`
Expected: 0 errors

**Step 5: Commit**

```
git add src/app/api/admin/bug-reports/
git commit -m "feat: add admin bug report API routes (list, detail, update)"
```

---

## Fas 4: Refaktorera BugReportFab

### Task 4.1: Uppdatera BugReportFab att posta till backend

**Files:**
- Modify: `src/components/provider/BugReportFab.tsx`

**Step 1: Refaktorera komponenten**

Ersatt hela innehallet i `BugReportFab.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Bug } from "lucide-react"
import { toast } from "sonner"
import { usePathname } from "next/navigation"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"

export function BugReportFab() {
  const { isAuthenticated } = useAuth()
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [reproductionSteps, setReproductionSteps] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  if (!isAuthenticated) return null

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) {
      toast.error("Titel och beskrivning kravs")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          reproductionSteps: reproductionSteps.trim() || undefined,
          pageUrl: pathname,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Kunde inte skicka rapport")
      }

      const data = await res.json()
      setSubmittedId(data.id)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte skicka rapport"
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setTitle("")
    setDescription("")
    setReproductionSteps("")
    setSubmittedId(null)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Rapportera fel"
        className="fixed right-4 bottom-20 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-colors hover:bg-red-700 md:bottom-6"
      >
        <Bug className="h-5 w-5" />
      </button>

      <Drawer open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {submittedId ? "Tack!" : "Rapportera fel"}
            </DrawerTitle>
            <DrawerDescription>
              {submittedId
                ? "Vi har tagit emot din rapport."
                : "Beskriv vad som gick fel sa undersaker vi det."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 space-y-4">
            {submittedId ? (
              <div className="rounded-md bg-green-50 p-4 text-sm">
                <p className="font-medium text-green-800">
                  Rapport mottagen
                </p>
                <p className="mt-1 text-green-700">
                  Referens-ID: <code className="font-mono text-xs bg-green-100 px-1 py-0.5 rounded">{submittedId}</code>
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="bug-title">Titel *</Label>
                  <Input
                    id="bug-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Kort beskrivning av problemet"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bug-description">Beskrivning *</Label>
                  <textarea
                    id="bug-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Vad hande? Vad forvantade du dig?"
                    rows={3}
                    maxLength={5000}
                    className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bug-steps">
                    Steg for att aterskapa (valfritt)
                  </Label>
                  <textarea
                    id="bug-steps"
                    value={reproductionSteps}
                    onChange={(e) => setReproductionSteps(e.target.value)}
                    placeholder="1. Ga till...\n2. Klicka pa...\n3. Se felet..."
                    rows={3}
                    maxLength={5000}
                    className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          <DrawerFooter>
            {submittedId ? (
              <Button variant="outline" onClick={handleClose}>
                Stang
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim() || !description.trim()}
                >
                  {submitting ? "Skickar..." : "Skicka rapport"}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline">Avbryt</Button>
                </DrawerClose>
              </>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
```

**Step 2: Uppdatera BugReportFab-testerna**

Las och uppdatera `src/components/provider/BugReportFab.test.tsx` -- testerna behover justeras for att matcha nya komponenten (inget offline-mode beroende, nya falt). Befintliga tester som testar offline_mode-gating ska tas bort, och nya tester for titel/beskrivning/submit ska laggas till.

**Step 3: Kor alla tester**

Run: `npx vitest run src/components/provider/BugReportFab.test.tsx`
Expected: ALL PASS

**Step 4: Kor typecheck**

Run: `npm run typecheck`
Expected: 0 errors

**Step 5: Commit**

```
git add src/components/provider/BugReportFab.tsx src/components/provider/BugReportFab.test.tsx
git commit -m "feat: refactor BugReportFab to post to backend with title and receipt"
```

---

## Fas 5: Admin UI

### Task 5.1: Skapa admin bug reports lista

**Files:**
- Create: `src/app/admin/bug-reports/page.tsx`

**Step 1: Implementera listsidan**

Skapa en klientsida med:
- Tabellvy med kolumner: titel, status, prioritet, roll, skapad, rapporterare
- Filtrera pa status via dropdown (Alla, Ny, Under utredning, Planerad, Fixad, Avfardad)
- Sortera pa datum (standard) eller prioritet
- Klickbar rad -> navigera till `/admin/bug-reports/[id]`
- Anvand `useSWR` for datahemtning (konsekvent med resten av appen)
- Status-badges med farger: NEW=blue, INVESTIGATING=amber, PLANNED=purple, FIXED=green, DISMISSED=gray
- Prioritet-badges: P0=red, P1=orange, P2=yellow, P3=gray

### Task 5.2: Skapa admin bug report detaljvy

**Files:**
- Create: `src/app/admin/bug-reports/[id]/page.tsx`

**Step 1: Implementera detaljsidan**

Skapa en klientsida med:
- Alla falt fran bugrapporten (titel, beskrivning, steg, URL, userAgent, platform)
- Redigerbar status (dropdown)
- Redigerbar prioritet (dropdown)
- Redigerbar intern kommentar (textarea)
- Spara-knapp som PATCH:ar till `/api/admin/bug-reports/[id]`
- Toast-bekraftelse vid sparad andring
- Tillbaka-lank till listan

### Task 5.3: Lagg till Buggrapporter i AdminNav

**Files:**
- Modify: `src/components/layout/AdminNav.tsx`

**Step 1: Lagg till nav-item**

Importera `Bug` fran lucide-react och lagg till i `navItems` (efter "Verifieringar"):

```typescript
{ href: "/admin/bug-reports", label: "Buggrapporter", icon: Bug },
```

Lagg till i `mobileMoreItems` (efter "Verifieringar"):

```typescript
{ href: "/admin/bug-reports", label: "Buggar", icon: Bug, matchPrefix: "/admin/bug-reports" },
```

**Step 2: Kor typecheck**

Run: `npm run typecheck`
Expected: 0 errors

**Step 3: Commit**

```
git add src/app/admin/bug-reports/ src/components/layout/AdminNav.tsx
git commit -m "feat: add admin bug reports list and detail pages with triage controls"
```

---

## Fas 6: Verifiering + Cleanup

### Task 6.1: Kor alla tester

Run: `npm run test:run`
Expected: Alla tester grona, inga regressioner

### Task 6.2: Kor typecheck + lint

Run: `npm run typecheck && npm run lint`
Expected: 0 errors, 0 nya varningar

### Task 6.3: Kor production build

Run: `npm run build`
Expected: Build lyckas utan fel

### Task 6.4: Manuell verifiering

1. Starta dev-servern: `npm run dev`
2. Logga in som kund/leverantor
3. Klicka pa bugrapport-FAB (rod knapp)
4. Fyll i titel + beskrivning, skicka
5. Verifiera kvittens med referens-ID
6. Logga in som admin
7. Ga till /admin/bug-reports
8. Verifiera att bugrapporten syns
9. Klicka pa den, uppdatera status + prio + kommentar
10. Verifiera att andringarna sparas

### Task 6.5: Slutlig commit

```
git add -A
git commit -m "chore: verify all tests pass and build succeeds"
```
