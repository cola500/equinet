---
title: "S4-3: Due-for-service native iOS"
description: "Migrera besoksplanering fran WebView till native SwiftUI"
category: plan
status: active
last_updated: 2026-04-01
sections:
  - Feature Inventory
  - Tasks
---

# S4-3: Due-for-service native iOS -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrera besoksplaneringsskarmen fran WebView till native SwiftUI sa att leverantörer ser vilka hästar som snart behover besok -- direkt i native-appen.

**Architecture:** Ny `/api/native/due-for-service` route med Bearer JWT-auth ateranvander samma Prisma-queries och domankalkylator som befintlig provider-route. Swift ViewModel med DI-protokoll hamtar data via APIClient. SwiftUI-vy med filterknappar, sammanfattningskort och lista. Kopplas in i NativeMoreView via `navigationDestination`.

**Tech Stack:** Next.js API route (TypeScript), Swift/SwiftUI, Vitest, XCTest

---

## Feature Inventory

| Feature | Webb | Native | Beslut |
|---------|------|--------|--------|
| Hast-lista med agarnamn | Ja | Ja | Native |
| Status-badge (Forsenad/Inom 2 veckor/Ej aktuell) | Ja | Ja | Native |
| Dagar till/sedan forfallodatum | Ja | Ja | Native |
| Senaste service-datum | Ja | Ja | Native |
| Intervall i veckor | Ja | Ja | Native |
| Nasta forfallodatum | Ja | Ja | Native |
| Sammanfattningskort (antal forsenade/upcoming) | Ja | Ja | Native |
| Filterknappar (Alla/Forsenade/Inom 2 veckor) | Ja | Ja | Native |
| Boka-knapp -> kalender | Ja | Nej | Skip (kravs WebView-navigering, laggs till senare) |
| Offline error state | Ja | Nej | Skip (native hanterar natverksfel generellt) |
| Pull-to-refresh | Nej | Ja | Native (bonus) |
| Loading spinner | Ja | Ja | Native |
| Empty state | Ja | Ja | Native |
| Feature flag gating | Ja | Ja | Native (redan i NativeMoreView menyitem) |

**Auth-verifiering:** Befintlig `/api/provider/due-for-service` använder session-auth via `withApiHandler`. Native-appen har bara Bearer JWT. Darfor behovs ny `/api/native/due-for-service` med `authFromMobileToken`.

---

## Files

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/app/api/native/due-for-service/route.ts` | Native API med Bearer JWT-auth |
| Create | `src/app/api/native/due-for-service/route.test.ts` | API route-tester |
| Create | `ios/Equinet/Equinet/DueForServiceModels.swift` | Codable structs |
| Create | `ios/Equinet/Equinet/DueForServiceViewModel.swift` | ViewModel med DI |
| Create | `ios/Equinet/Equinet/NativeDueForServiceView.swift` | SwiftUI-vy |
| Create | `ios/Equinet/EquinetTests/DueForServiceViewModelTests.swift` | ViewModel XCTest |
| Modify | `ios/Equinet/Equinet/APIClient.swift` | Lagg till `fetchDueForService()` |
| Modify | `ios/Equinet/Equinet/NativeMoreView.swift` | Native routing for besoksplanering |

---

## Task 1: API Route -- RED (tester forst)

**Files:**
- Create: `src/app/api/native/due-for-service/route.test.ts`

- [ ] **Step 1: Skapa testfil med mockar och auth-tester**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/mobile-auth", () => ({
  authFromMobileToken: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    booking: { findMany: vi.fn() },
    horseServiceInterval: { findMany: vi.fn() },
    customerHorseServiceInterval: { findMany: vi.fn() },
  },
}))

import { GET } from "./route"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { prisma } from "@/lib/prisma"

const TEST_UUIDS = {
  userId: "a0000000-0000-4000-a000-000000000001",
  provider: "a0000000-0000-4000-a000-000000000002",
  horse1: "a0000000-0000-4000-a000-000000000003",
  horse2: "a0000000-0000-4000-a000-000000000004",
  customer1: "a0000000-0000-4000-a000-000000000005",
  service1: "a0000000-0000-4000-a000-000000000006",
}

const makeRequest = (params = "") =>
  new NextRequest(`http://localhost:3000/api/native/due-for-service${params}`)

describe("GET /api/native/due-for-service", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(authFromMobileToken).mockResolvedValue({
      userId: TEST_UUIDS.userId,
      tokenId: "token-1",
    })

    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
    } as never)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.horseServiceInterval.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerHorseServiceInterval.findMany).mockResolvedValue([])
  })

  it("returns 401 when no token", async () => {
    vi.mocked(authFromMobileToken).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 404 when feature flag disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)
    const res = await GET(makeRequest())
    expect(res.status).toBe(404)
  })

  it("returns 404 when provider not found", async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(404)
  })

  it("returns empty items for provider with no bookings", async () => {
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.items).toEqual([])
  })

  it("returns items sorted by urgency (overdue first)", async () => {
    const now = new Date()
    const tenWeeksAgo = new Date(now)
    tenWeeksAgo.setDate(tenWeeksAgo.getDate() - 70)
    const threeWeeksAgo = new Date(now)
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        bookingDate: tenWeeksAgo,
        horse: { id: TEST_UUIDS.horse1, name: "Blansen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
      {
        horseId: TEST_UUIDS.horse2,
        serviceId: TEST_UUIDS.service1,
        bookingDate: threeWeeksAgo,
        horse: { id: TEST_UUIDS.horse2, name: "Pransen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(data.items).toHaveLength(2)
    expect(data.items[0].horseName).toBe("Blansen")
    expect(data.items[0].status).toBe("overdue")
    expect(data.items[0].ownerName).toBe("Anna Svensson")
    expect(data.items[1].horseName).toBe("Pransen")
  })

  it("filters by overdue only", async () => {
    const now = new Date()
    const tenWeeksAgo = new Date(now)
    tenWeeksAgo.setDate(tenWeeksAgo.getDate() - 70)
    const threeWeeksAgo = new Date(now)
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        bookingDate: tenWeeksAgo,
        horse: { id: TEST_UUIDS.horse1, name: "Blansen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
      {
        horseId: TEST_UUIDS.horse2,
        serviceId: TEST_UUIDS.service1,
        bookingDate: threeWeeksAgo,
        horse: { id: TEST_UUIDS.horse2, name: "Pransen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const res = await GET(makeRequest("?filter=overdue"))
    const data = await res.json()

    expect(data.items).toHaveLength(1)
    expect(data.items[0].horseName).toBe("Blansen")
  })

  it("deduplicates by horse+service, keeping latest booking", async () => {
    const now = new Date()
    const tenWeeksAgo = new Date(now)
    tenWeeksAgo.setDate(tenWeeksAgo.getDate() - 70)
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        bookingDate: tenWeeksAgo,
        horse: { id: TEST_UUIDS.horse1, name: "Blansen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
      {
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        bookingDate: twoWeeksAgo,
        horse: { id: TEST_UUIDS.horse1, name: "Blansen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(data.items).toHaveLength(1)
    expect(data.items[0].status).toBe("ok")
  })
})
```

- [ ] **Step 2: Kor testerna och verifiera att de failar**

```bash
npx vitest run src/app/api/native/due-for-service/route.test.ts
```

Expected: FAIL -- `route.ts` existerar inte an.

- [ ] **Step 3: Commit RED-tester**

```bash
git add src/app/api/native/due-for-service/route.test.ts
git commit -m "test(red): add native due-for-service API route tests"
```

---

## Task 2: API Route -- GREEN (implementation)

**Files:**
- Create: `src/app/api/native/due-for-service/route.ts`

- [ ] **Step 1: Implementera route med Bearer JWT-auth**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
  calculateDueStatus,
  resolveInterval,
  type DueForServiceResult,
} from "@/domain/due-for-service/DueForServiceCalculator"
import { RateLimitServiceError } from "@/lib/rate-limit"

interface NativeDueForServiceItem extends DueForServiceResult {
  ownerName: string
}

export async function GET(request: NextRequest) {
  try {
    // 1. Auth (Bearer JWT)
    const tokenAuth = await authFromMobileToken(request)
    if (!tokenAuth) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    const clientIP = getClientIP(request)
    try {
      await rateLimiters.api(clientIP)
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjansten ar tillfalligt otillganglig" },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: "For manga forfragninga" },
        { status: 429 }
      )
    }

    // 3. Feature flag
    if (!(await isFeatureEnabled("due_for_service"))) {
      return NextResponse.json({ error: "Ej tillganglig" }, { status: 404 })
    }

    // 4. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: tokenAuth.userId },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantorsprofil hittades inte" },
        { status: 404 }
      )
    }

    const filter = request.nextUrl.searchParams.get("filter") || "all"

    // 5. Fetch completed bookings with horses and services
    const bookings = await prisma.booking.findMany({
      where: {
        providerId: provider.id,
        status: "completed",
        horseId: { not: null },
      },
      select: {
        horseId: true,
        serviceId: true,
        bookingDate: true,
        horse: { select: { id: true, name: true } },
        customer: { select: { firstName: true, lastName: true } },
        service: {
          select: { id: true, name: true, recommendedIntervalWeeks: true },
        },
      },
      orderBy: { bookingDate: "desc" },
    })

    // 6. Fetch interval overrides
    const overrides = await prisma.horseServiceInterval.findMany({
      where: { providerId: provider.id },
      select: { horseId: true, serviceId: true, revisitIntervalWeeks: true },
    })

    const overrideMap = new Map(
      overrides.map((o) => [`${o.horseId}:${o.serviceId}`, o.revisitIntervalWeeks])
    )

    // 7. Fetch customer-set intervals
    const horseIds = [
      ...new Set(bookings.map((b) => b.horseId).filter(Boolean)),
    ] as string[]
    const customerIntervals =
      horseIds.length > 0
        ? await prisma.customerHorseServiceInterval.findMany({
            where: { horseId: { in: horseIds } },
            select: { horseId: true, serviceId: true, intervalWeeks: true },
          })
        : []

    const customerIntervalMap = new Map(
      customerIntervals.map((ci) => [
        `${ci.horseId}:${ci.serviceId}`,
        ci.intervalWeeks,
      ])
    )

    // 8. Deduplicate: keep only latest booking per (horseId, serviceId)
    const latestBookingMap = new Map<string, (typeof bookings)[0]>()
    for (const booking of bookings) {
      if (!booking.horseId || !booking.horse) continue
      const key = `${booking.horseId}:${booking.serviceId}`
      const existing = latestBookingMap.get(key)
      if (
        !existing ||
        new Date(booking.bookingDate) > new Date(existing.bookingDate)
      ) {
        latestBookingMap.set(key, booking)
      }
    }

    // 9. Calculate status
    const now = new Date()
    const items: NativeDueForServiceItem[] = []

    for (const booking of latestBookingMap.values()) {
      const intervalWeeks = resolveInterval(
        booking.service.recommendedIntervalWeeks,
        overrideMap.get(`${booking.horseId!}:${booking.serviceId}`) ?? null,
        customerIntervalMap.get(`${booking.horseId!}:${booking.serviceId}`) ??
          null
      )

      if (intervalWeeks === null) continue

      const result = calculateDueStatus(
        {
          horseId: booking.horse!.id,
          horseName: booking.horse!.name,
          serviceId: booking.service.id,
          serviceName: booking.service.name,
          lastServiceDate: new Date(booking.bookingDate),
          intervalWeeks,
        },
        now
      )

      items.push({
        ...result,
        ownerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      })
    }

    // 10. Filter
    let filteredItems: NativeDueForServiceItem[] = items
    if (filter === "overdue") {
      filteredItems = items.filter((i) => i.status === "overdue")
    } else if (filter === "upcoming") {
      filteredItems = items.filter((i) => i.status === "upcoming")
    }

    // 11. Sort by urgency
    filteredItems.sort((a, b) => a.daysUntilDue - b.daysUntilDue)

    return NextResponse.json({ items: filteredItems })
  } catch (error) {
    logger.error("Native due-for-service error:", error)
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Kor testerna och verifiera att de passerar**

```bash
npx vitest run src/app/api/native/due-for-service/route.test.ts
```

Expected: PASS (alla 7 tester)

- [ ] **Step 3: Kor typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit GREEN**

```bash
git add src/app/api/native/due-for-service/route.ts
git commit -m "feat: add native due-for-service API route with Bearer JWT auth"
```

---

## Task 3: Swift Codable Models

**Files:**
- Create: `ios/Equinet/Equinet/DueForServiceModels.swift`

- [ ] **Step 1: Skapa models som matchar API-response**

```swift
import Foundation

// MARK: - API Response

struct DueForServiceResponse: Codable, Sendable {
    let items: [DueForServiceItem]
}

// MARK: - Item

struct DueForServiceItem: Codable, Identifiable, Sendable {
    let horseId: String
    let horseName: String
    let serviceId: String
    let serviceName: String
    let lastServiceDate: String      // ISO 8601
    let daysSinceService: Int
    let intervalWeeks: Int
    let dueDate: String              // ISO 8601
    let daysUntilDue: Int
    let status: DueStatus
    let ownerName: String

    var id: String { "\(horseId):\(serviceId)" }

    var formattedLastServiceDate: String {
        Self.displayFormatter.string(from: Self.isoDate(lastServiceDate) ?? Date())
    }

    var formattedDueDate: String {
        Self.displayFormatter.string(from: Self.isoDate(dueDate) ?? Date())
    }

    var urgencyText: String {
        if daysUntilDue < 0 {
            let days = abs(daysUntilDue)
            return "\(days) \(days == 1 ? "dag" : "dagar") forsenad"
        } else if daysUntilDue == 0 {
            return "Idag"
        } else {
            return "om \(daysUntilDue) \(daysUntilDue == 1 ? "dag" : "dagar")"
        }
    }

    // MARK: - Static formatters (performance: reuse)

    private static let displayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "d MMM yyyy"
        return f
    }()

    private static func isoDate(_ string: String) -> Date? {
        try? Date(string, strategy: .iso8601)
    }
}

// MARK: - Hashable

extension DueForServiceItem: Hashable {
    func hash(into hasher: inout Hasher) {
        hasher.combine(horseId)
        hasher.combine(serviceId)
    }

    static func == (lhs: DueForServiceItem, rhs: DueForServiceItem) -> Bool {
        lhs.horseId == rhs.horseId && lhs.serviceId == rhs.serviceId
    }
}

// MARK: - Status enum

enum DueStatus: String, Codable, Sendable {
    case overdue
    case upcoming
    case ok

    /// Fallback for unknown values from API
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)
        self = DueStatus(rawValue: value) ?? .ok
    }

    var label: String {
        switch self {
        case .overdue: "Forsenad"
        case .upcoming: "Inom 2 veckor"
        case .ok: "Ej aktuell"
        }
    }
}

// MARK: - Filter enum

enum DueForServiceFilter: String, CaseIterable, Sendable {
    case all
    case overdue
    case upcoming

    var label: String {
        switch self {
        case .all: "Alla"
        case .overdue: "Forsenade"
        case .upcoming: "Inom 2 veckor"
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ios/Equinet/Equinet/DueForServiceModels.swift
git commit -m "feat(ios): add DueForServiceModels with Codable structs"
```

---

## Task 4: APIClient -- lagg till fetchDueForService

**Files:**
- Modify: `ios/Equinet/Equinet/APIClient.swift`

- [ ] **Step 1: Lagg till metod i APIClient**

Lagg till langst ner bland publika metoder, ovanfor `// MARK: - Private`:

```swift
// MARK: - Due for Service

func fetchDueForService(filter: DueForServiceFilter = .all) async throws -> [DueForServiceItem] {
    var path = "/api/native/due-for-service"
    if filter != .all {
        path += "?filter=\(filter.rawValue)"
    }
    let response: DueForServiceResponse = try await authenticatedRequest(
        path: path,
        responseType: DueForServiceResponse.self
    )
    return response.items
}
```

- [ ] **Step 2: Verifiera att projektet bygger**

```bash
xcodebuild build -project ios/Equinet/Equinet.xcodeproj -scheme Equinet \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -quiet 2>&1 | tail -5
```

Expected: BUILD SUCCEEDED

- [ ] **Step 3: Commit**

```bash
git add ios/Equinet/Equinet/APIClient.swift
git commit -m "feat(ios): add fetchDueForService to APIClient"
```

---

## Task 5: ViewModel -- RED (tester forst)

**Files:**
- Create: `ios/Equinet/EquinetTests/DueForServiceViewModelTests.swift`

- [ ] **Step 1: Skapa testfil med MockFetcher och tester**

```swift
import XCTest
@testable import Equinet

@MainActor
final class MockDueForServiceFetcher: DueForServiceDataFetching {
    var itemsToReturn: [DueForServiceItem] = []
    var shouldThrow = false

    func fetchDueForService(filter: DueForServiceFilter) async throws -> [DueForServiceItem] {
        if shouldThrow { throw APIError.serverError(500) }
        return itemsToReturn
    }
}

@MainActor
final class DueForServiceViewModelTests: XCTestCase {

    private var mockFetcher: MockDueForServiceFetcher!
    private var viewModel: DueForServiceViewModel!

    override func setUp() {
        super.setUp()
        mockFetcher = MockDueForServiceFetcher()
        viewModel = DueForServiceViewModel(fetcher: mockFetcher)
    }

    // MARK: - Helpers

    private func makeItem(
        horseId: String = "h1",
        horseName: String = "Blansen",
        serviceName: String = "Hovslagning",
        daysUntilDue: Int = -5,
        status: DueStatus = .overdue,
        ownerName: String = "Anna Svensson"
    ) -> DueForServiceItem {
        DueForServiceItem(
            horseId: horseId,
            horseName: horseName,
            serviceId: "s1",
            serviceName: serviceName,
            lastServiceDate: "2026-01-01T00:00:00.000Z",
            daysSinceService: 90,
            intervalWeeks: 6,
            dueDate: "2026-02-12T00:00:00.000Z",
            daysUntilDue: daysUntilDue,
            status: status,
            ownerName: ownerName
        )
    }

    // MARK: - Tests

    func testLoadItemsSetsItemsOnSuccess() async {
        mockFetcher.itemsToReturn = [makeItem()]
        await viewModel.loadItems()

        XCTAssertEqual(viewModel.items.count, 1)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
    }

    func testLoadItemsSetsErrorOnFailure() async {
        mockFetcher.shouldThrow = true
        await viewModel.loadItems()

        XCTAssertTrue(viewModel.items.isEmpty)
        XCTAssertNotNil(viewModel.error)
        XCTAssertFalse(viewModel.isLoading)
    }

    func testLoadItemsKeepsOldDataOnRefreshFailure() async {
        mockFetcher.itemsToReturn = [makeItem()]
        await viewModel.loadItems()
        XCTAssertEqual(viewModel.items.count, 1)

        mockFetcher.shouldThrow = true
        await viewModel.loadItems()

        // Should keep old data and not show error
        XCTAssertEqual(viewModel.items.count, 1)
        XCTAssertNil(viewModel.error)
    }

    func testFilteredItemsReturnsAllByDefault() async {
        mockFetcher.itemsToReturn = [
            makeItem(horseId: "h1", status: .overdue),
            makeItem(horseId: "h2", status: .upcoming, daysUntilDue: 5),
            makeItem(horseId: "h3", status: .ok, daysUntilDue: 20),
        ]
        await viewModel.loadItems()

        XCTAssertEqual(viewModel.filteredItems.count, 3)
    }

    func testFilteredItemsByOverdue() async {
        mockFetcher.itemsToReturn = [
            makeItem(horseId: "h1", status: .overdue),
            makeItem(horseId: "h2", status: .upcoming, daysUntilDue: 5),
        ]
        await viewModel.loadItems()

        viewModel.selectedFilter = .overdue
        XCTAssertEqual(viewModel.filteredItems.count, 1)
        XCTAssertEqual(viewModel.filteredItems[0].status, .overdue)
    }

    func testFilteredItemsByUpcoming() async {
        mockFetcher.itemsToReturn = [
            makeItem(horseId: "h1", status: .overdue),
            makeItem(horseId: "h2", status: .upcoming, daysUntilDue: 5),
        ]
        await viewModel.loadItems()

        viewModel.selectedFilter = .upcoming
        XCTAssertEqual(viewModel.filteredItems.count, 1)
        XCTAssertEqual(viewModel.filteredItems[0].status, .upcoming)
    }

    func testOverdueCount() async {
        mockFetcher.itemsToReturn = [
            makeItem(horseId: "h1", status: .overdue),
            makeItem(horseId: "h2", status: .overdue, daysUntilDue: -10),
            makeItem(horseId: "h3", status: .upcoming, daysUntilDue: 5),
        ]
        await viewModel.loadItems()

        XCTAssertEqual(viewModel.overdueCount, 2)
    }

    func testUpcomingCount() async {
        mockFetcher.itemsToReturn = [
            makeItem(horseId: "h1", status: .overdue),
            makeItem(horseId: "h2", status: .upcoming, daysUntilDue: 5),
            makeItem(horseId: "h3", status: .upcoming, daysUntilDue: 10),
        ]
        await viewModel.loadItems()

        XCTAssertEqual(viewModel.upcomingCount, 2)
    }

    func testRefreshReloadsData() async {
        mockFetcher.itemsToReturn = [makeItem()]
        await viewModel.loadItems()
        XCTAssertEqual(viewModel.items.count, 1)

        mockFetcher.itemsToReturn = [makeItem(horseId: "h1"), makeItem(horseId: "h2")]
        await viewModel.refresh()

        XCTAssertEqual(viewModel.items.count, 2)
    }
}
```

- [ ] **Step 2: Kor tester -- verifiera att de failar**

```bash
xcodebuild test -project ios/Equinet/Equinet.xcodeproj -scheme Equinet \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -only-testing:EquinetTests/DueForServiceViewModelTests \
  2>&1 | grep -E "(Executed|failed|error:)"
```

Expected: FAIL -- `DueForServiceDataFetching` och `DueForServiceViewModel` existerar inte an.

- [ ] **Step 3: Commit RED**

```bash
git add ios/Equinet/EquinetTests/DueForServiceViewModelTests.swift
git commit -m "test(red/ios): add DueForServiceViewModel tests"
```

---

## Task 6: ViewModel -- GREEN (implementation)

**Files:**
- Create: `ios/Equinet/Equinet/DueForServiceViewModel.swift`

- [ ] **Step 1: Skapa ViewModel med DI-protokoll**

```swift
import Foundation
import OSLog

// MARK: - DI Protocol

@MainActor
protocol DueForServiceDataFetching: Sendable {
    func fetchDueForService(filter: DueForServiceFilter) async throws -> [DueForServiceItem]
}

// MARK: - Production Adapter

struct APIDueForServiceFetcher: DueForServiceDataFetching {
    func fetchDueForService(filter: DueForServiceFilter) async throws -> [DueForServiceItem] {
        try await APIClient.shared.fetchDueForService(filter: filter)
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class DueForServiceViewModel {
    private let fetcher: DueForServiceDataFetching

    var items: [DueForServiceItem] = []
    var selectedFilter: DueForServiceFilter = .all
    private(set) var isLoading = false
    private(set) var error: String?

    init(fetcher: DueForServiceDataFetching? = nil) {
        self.fetcher = fetcher ?? APIDueForServiceFetcher()
    }

    // MARK: - Computed

    var filteredItems: [DueForServiceItem] {
        switch selectedFilter {
        case .all: items
        case .overdue: items.filter { $0.status == .overdue }
        case .upcoming: items.filter { $0.status == .upcoming }
        }
    }

    var overdueCount: Int {
        items.filter { $0.status == .overdue }.count
    }

    var upcomingCount: Int {
        items.filter { $0.status == .upcoming }.count
    }

    // MARK: - Actions

    func loadItems() async {
        isLoading = items.isEmpty
        error = nil

        do {
            let fetched = try await fetcher.fetchDueForService(filter: .all)
            items = fetched
            isLoading = false
        } catch {
            isLoading = false
            if items.isEmpty {
                self.error = "Kunde inte hamta besoksplanering"
            }
            AppLogger.network.error("Failed to fetch due-for-service: \(error.localizedDescription)")
        }
    }

    func refresh() async {
        do {
            let fetched = try await fetcher.fetchDueForService(filter: .all)
            items = fetched
        } catch {
            AppLogger.network.error("Failed to refresh due-for-service: \(error.localizedDescription)")
        }
    }
}
```

- [ ] **Step 2: Kor tester -- verifiera att de passerar**

```bash
xcodebuild test -project ios/Equinet/Equinet.xcodeproj -scheme Equinet \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -only-testing:EquinetTests/DueForServiceViewModelTests \
  2>&1 | grep -E "(Executed|failed)"
```

Expected: PASS (alla 8 tester)

- [ ] **Step 3: Commit GREEN**

```bash
git add ios/Equinet/Equinet/DueForServiceViewModel.swift
git commit -m "feat(ios): add DueForServiceViewModel with DI"
```

---

## Task 7: SwiftUI View

**Files:**
- Create: `ios/Equinet/Equinet/NativeDueForServiceView.swift`

- [ ] **Step 1: Skapa vyn med sammanfattningskort, filterknappar och lista**

```swift
import SwiftUI
import OSLog

struct NativeDueForServiceView: View {
    @Bindable var viewModel: DueForServiceViewModel

    var body: some View {
        content
            .navigationTitle("Besoksplanering")
            .task {
                await viewModel.loadItems()
            }
            .refreshable {
                await viewModel.refresh()
            }
            .sensoryFeedback(.success, trigger: viewModel.items.count)
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            VStack {
                Spacer()
                ProgressView("Laddar besoksplanering...")
                Spacer()
            }
        } else if let error = viewModel.error {
            errorView(error)
        } else if viewModel.items.isEmpty {
            emptyState
        } else {
            itemList
        }
    }

    // MARK: - Summary Cards

    private var summaryCards: some View {
        HStack(spacing: 12) {
            SummaryCard(
                count: viewModel.overdueCount,
                label: "Forsenade",
                systemImage: "exclamationmark.triangle.fill",
                color: .red
            )
            SummaryCard(
                count: viewModel.upcomingCount,
                label: "Inom 2 veckor",
                systemImage: "clock.fill",
                color: .orange
            )
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }

    // MARK: - Filter

    private var filterPicker: some View {
        Picker("Filter", selection: $viewModel.selectedFilter) {
            ForEach(DueForServiceFilter.allCases, id: \.self) { filter in
                Text(filter.label).tag(filter)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    // MARK: - List

    private var itemList: some View {
        ScrollView {
            VStack(spacing: 0) {
                summaryCards
                filterPicker

                if viewModel.filteredItems.isEmpty {
                    Text("Inga hastar matchar filtret.")
                        .foregroundStyle(.secondary)
                        .padding(.top, 40)
                } else {
                    LazyVStack(spacing: 0) {
                        ForEach(viewModel.filteredItems) { item in
                            DueForServiceRow(item: item)
                            Divider()
                                .padding(.leading, 16)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "clock.badge.checkmark")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("Inga hastar behover besok just nu")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Hastar dyker upp har efter avslutade bokningar med tjanster som har aterbesoksintervall.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    // MARK: - Actions

    private func retry() {
        Task { await viewModel.loadItems() }
    }

    // MARK: - Error

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text(message)
                .foregroundStyle(.secondary)
            Button("Forsok igen", action: retry)
                .buttonStyle(.bordered)
            Spacer()
        }
    }
}

// MARK: - Row

private struct DueForServiceRow: View {
    let item: DueForServiceItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Horse name + status badge
            HStack {
                Text(item.horseName)
                    .font(.headline)
                Spacer()
                statusBadge
            }

            // Owner
            Text(item.ownerName)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            // Service + interval
            HStack {
                Label(item.serviceName, systemImage: "stethoscope")
                    .font(.subheadline)
                Spacer()
                Text("var \(item.intervalWeeks):e vecka")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Dates
            HStack {
                Label("Senast: \(item.formattedLastServiceDate)", systemImage: "calendar")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(item.urgencyText)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(urgencyColor)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.horseName), \(item.serviceName), \(item.urgencyText)")
    }

    private var statusBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: statusIcon)
                .font(.caption2)
            Text(item.status.label)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(badgeBackground)
        .clipShape(.capsule)
    }

    private var statusIcon: String {
        switch item.status {
        case .overdue: "exclamationmark.triangle.fill"
        case .upcoming: "clock.fill"
        case .ok: "checkmark.circle.fill"
        }
    }

    private var badgeBackground: Color {
        switch item.status {
        case .overdue: .red.opacity(0.15)
        case .upcoming: .orange.opacity(0.15)
        case .ok: .green.opacity(0.15)
        }
    }

    private var urgencyColor: Color {
        switch item.status {
        case .overdue: .red
        case .upcoming: .orange
        case .ok: .green
        }
    }
}

// MARK: - Summary Card

private struct SummaryCard: View {
    let count: Int
    let label: String
    let systemImage: String
    let color: Color

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .foregroundStyle(color)
                .font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(count)")
                    .font(.title2)
                    .fontWeight(.bold)
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(12)
        .background(Color(.systemBackground))
        .clipShape(.rect(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(count) \(label)")
    }
}
```

- [ ] **Step 2: Verifiera att projektet bygger**

```bash
xcodebuild build -project ios/Equinet/Equinet.xcodeproj -scheme Equinet \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -quiet 2>&1 | tail -5
```

Expected: BUILD SUCCEEDED

- [ ] **Step 3: Commit**

```bash
git add ios/Equinet/Equinet/NativeDueForServiceView.swift
git commit -m "feat(ios): add NativeDueForServiceView with summary cards, filter, list"
```

---

## Task 8: Koppla in i NativeMoreView

**Files:**
- Modify: `ios/Equinet/Equinet/NativeMoreView.swift`

- [ ] **Step 1: Lagg till ViewModel-property**

I NativeMoreView struct, lagg till bredvid befintliga ViewModels (t.ex. `servicesViewModel`, `customersViewModel`):

```swift
@State private var dueForServiceViewModel = DueForServiceViewModel()
```

- [ ] **Step 2: Lagg till native routing i navigationDestination**

I `.navigationDestination(for: MoreMenuItem.self)` blocket, lagg till FORE else-fallback (MoreWebView):

```swift
} else if item.path == "/provider/due-for-service" {
    NativeDueForServiceView(viewModel: dueForServiceViewModel)
```

- [ ] **Step 3: Verifiera att projektet bygger**

```bash
xcodebuild build -project ios/Equinet/Equinet.xcodeproj -scheme Equinet \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -quiet 2>&1 | tail -5
```

Expected: BUILD SUCCEEDED

- [ ] **Step 4: Commit**

```bash
git add ios/Equinet/Equinet/NativeMoreView.swift
git commit -m "feat(ios): wire NativeDueForServiceView into NativeMoreView navigation"
```

---

## Task 9: Verifiering

- [ ] **Step 1: Kor webb-tester (Niva 1)**

```bash
npx vitest run src/app/api/native/due-for-service && npm run typecheck
```

Expected: PASS

- [ ] **Step 2: Kor iOS-tester (Niva 1)**

```bash
xcodebuild test -project ios/Equinet/Equinet.xcodeproj -scheme Equinet \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -only-testing:EquinetTests/DueForServiceViewModelTests \
  2>&1 | grep -E "(Executed|failed)" | tail -1
```

Expected: PASS (alla 8 tester)

- [ ] **Step 3: Visuell verifiering med mobile-mcp**

Starta dev-servern (`npm run dev`), bygg iOS-appen i simulatorn, navigera till Mer -> Besoksplanering, ta screenshot, verifiera:
- Sammanfattningskort visas (antal forsenade + upcoming)
- Filterknappar fungerar
- Lista visar hastnamn, agarnamn, tjänst, status-badge, datum
- Pull-to-refresh fungerar
- Empty state visas korrekt (om inga hästar)

- [ ] **Step 4: Skriv done-dokument**

Skapa `docs/done/s4-3-done.md` med acceptanskriterier, DoD, avvikelser, lardomar.

- [ ] **Step 5: Uppdatera status.md och pusha**

Uppdatera story-status till `review_requested`, pusha feature branch.
