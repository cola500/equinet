import { describe, it, expect, beforeEach, vi } from "vitest"
import { RouteAnnouncementNotifier, formatDaysAgo } from "./RouteAnnouncementNotifier"
import type { IFollowRepository, FollowerInfo } from "@/infrastructure/persistence/follow/IFollowRepository"
import type { IMunicipalityWatchRepository } from "@/infrastructure/persistence/municipality-watch/IMunicipalityWatchRepository"
import type { DueForServiceLookup } from "@/domain/due-for-service/DueForServiceLookup"

// Mock dependencies
const mockFollowRepo: IFollowRepository = {
  create: vi.fn(),
  delete: vi.fn(),
  findByCustomerAndProvider: vi.fn(),
  findByCustomerIdWithProvider: vi.fn(),
  findFollowersInMunicipality: vi.fn(),
  countByProvider: vi.fn(),
}

const mockWatchRepo: IMunicipalityWatchRepository = {
  create: vi.fn(),
  delete: vi.fn(),
  findByCustomerId: vi.fn(),
  countByCustomerId: vi.fn(),
  findWatchersForAnnouncement: vi.fn().mockResolvedValue([]),
}

const mockNotificationService = {
  createAsync: vi.fn(),
}

const mockEmailService = {
  send: vi.fn().mockResolvedValue({ success: true }),
}

const mockRouteOrderLookup = {
  findById: vi.fn(),
}

const mockDeliveryStore = {
  exists: vi.fn().mockResolvedValue(false),
  create: vi.fn(),
}

const mockDueForServiceLookup: DueForServiceLookup = {
  getOverdueHorsesForCustomers: vi.fn().mockResolvedValue(new Map()),
}

function createNotifier(opts?: {
  dueForServiceLookup?: DueForServiceLookup
  watchRepo?: IMunicipalityWatchRepository
}) {
  return new RouteAnnouncementNotifier({
    followRepo: mockFollowRepo,
    notificationService: mockNotificationService as never,
    emailService: mockEmailService as never,
    routeOrderLookup: mockRouteOrderLookup,
    deliveryStore: mockDeliveryStore,
    dueForServiceLookup: opts?.dueForServiceLookup,
    watchRepo: opts?.watchRepo,
  })
}

const mockRouteOrder = {
  id: "ro-1",
  municipality: "Alingsås",
  dateFrom: new Date("2026-03-01"),
  dateTo: new Date("2026-03-02"),
  provider: {
    id: "provider-1",
    businessName: "Hovslagare AB",
  },
  services: [
    { name: "Hovslagning" },
    { name: "Hovvård" },
  ],
}

const mockFollowers: FollowerInfo[] = [
  { userId: "customer-1", email: "anna@example.com", firstName: "Anna" },
  { userId: "customer-2", email: "erik@example.com", firstName: "Erik" },
]

describe("RouteAnnouncementNotifier", () => {
  let notifier: RouteAnnouncementNotifier

  beforeEach(() => {
    vi.clearAllMocks()
    notifier = createNotifier()
  })

  it("should no-op when route order not found", async () => {
    mockRouteOrderLookup.findById.mockResolvedValue(null)

    await notifier.notifyFollowersOfNewRoute("nonexistent")

    expect(mockFollowRepo.findFollowersInMunicipality).not.toHaveBeenCalled()
  })

  it("should no-op when route order has no municipality", async () => {
    mockRouteOrderLookup.findById.mockResolvedValue({
      ...mockRouteOrder,
      municipality: null,
    })

    await notifier.notifyFollowersOfNewRoute("ro-1")

    expect(mockFollowRepo.findFollowersInMunicipality).not.toHaveBeenCalled()
  })

  it("should no-op when there are no followers in municipality", async () => {
    mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
    vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([])

    await notifier.notifyFollowersOfNewRoute("ro-1")

    expect(mockNotificationService.createAsync).not.toHaveBeenCalled()
  })

  it("should notify all followers in the municipality", async () => {
    mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
    vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue(mockFollowers)

    await notifier.notifyFollowersOfNewRoute("ro-1")

    // 2 in-app notifications
    expect(mockNotificationService.createAsync).toHaveBeenCalledTimes(2)
    // 2 emails
    expect(mockEmailService.send).toHaveBeenCalledTimes(2)
    // 4 delivery records (2 in_app + 2 email)
    expect(mockDeliveryStore.create).toHaveBeenCalledTimes(4)
  })

  it("should skip already delivered notifications (dedup)", async () => {
    mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
    vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([mockFollowers[0]])
    // Already delivered for this customer
    mockDeliveryStore.exists.mockResolvedValue(true)

    await notifier.notifyFollowersOfNewRoute("ro-1")

    expect(mockNotificationService.createAsync).not.toHaveBeenCalled()
    expect(mockEmailService.send).not.toHaveBeenCalled()
  })

  it("should not let email failure block notification creation", async () => {
    mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
    vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([mockFollowers[0]])
    mockDeliveryStore.exists.mockResolvedValue(false)
    // Email fails
    mockEmailService.send.mockRejectedValue(new Error("SMTP error"))

    await notifier.notifyFollowersOfNewRoute("ro-1")

    // In-app notification should still be created
    expect(mockNotificationService.createAsync).toHaveBeenCalledTimes(1)
    // Delivery for in_app should be recorded
    expect(mockDeliveryStore.create).toHaveBeenCalled()
  })

  it("should include correct notification content", async () => {
    mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
    vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([mockFollowers[0]])

    await notifier.notifyFollowersOfNewRoute("ro-1")

    expect(mockNotificationService.createAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "customer-1",
        type: "route_announcement_new",
        message: expect.stringContaining("Hovslagare AB"),
      })
    )
  })

  // --- Due-for-service personalization tests ---

  describe("with dueForServiceLookup", () => {
    let notifierWithLookup: RouteAnnouncementNotifier

    beforeEach(() => {
      notifierWithLookup = createNotifier({
        dueForServiceLookup: mockDueForServiceLookup,
      })
    })

    it("should send enhanced notification for follower with overdue horse", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([mockFollowers[0]])
      vi.mocked(mockDueForServiceLookup.getOverdueHorsesForCustomers).mockResolvedValue(
        new Map([
          ["customer-1", [{ horseName: "Blansen", serviceName: "Hovvård", daysOverdue: 14 }]],
        ])
      )

      await notifierWithLookup.notifyFollowersOfNewRoute("ro-1")

      expect(mockNotificationService.createAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "customer-1",
          type: "route_announcement_due_horse",
          message: expect.stringContaining("Blansen"),
        })
      )
    })

    it("should send standard notification for follower without overdue horses", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([mockFollowers[0]])
      vi.mocked(mockDueForServiceLookup.getOverdueHorsesForCustomers).mockResolvedValue(
        new Map() // no overdue for anyone
      )

      await notifierWithLookup.notifyFollowersOfNewRoute("ro-1")

      expect(mockNotificationService.createAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "customer-1",
          type: "route_announcement_new",
        })
      )
    })

    it("should send standard notification when dueForServiceLookup is undefined (backward compat)", async () => {
      const notifierNoDue = createNotifier() // no lookup
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([mockFollowers[0]])

      await notifierNoDue.notifyFollowersOfNewRoute("ro-1")

      expect(mockNotificationService.createAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "route_announcement_new",
        })
      )
    })

    it("should pick the most overdue horse when follower has multiple", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([mockFollowers[0]])
      vi.mocked(mockDueForServiceLookup.getOverdueHorsesForCustomers).mockResolvedValue(
        new Map([
          [
            "customer-1",
            [
              { horseName: "Stella", serviceName: "Hovvård", daysOverdue: 28 },
              { horseName: "Blansen", serviceName: "Hovvård", daysOverdue: 14 },
            ],
          ],
        ])
      )

      await notifierWithLookup.notifyFollowersOfNewRoute("ro-1")

      // First in list (most overdue) should be used
      expect(mockNotificationService.createAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Stella"),
          metadata: expect.objectContaining({
            overdueHorseName: "Stella",
          }),
        })
      )
    })

    it("should include overdueHorseName in metadata for enhanced notifications", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([mockFollowers[0]])
      vi.mocked(mockDueForServiceLookup.getOverdueHorsesForCustomers).mockResolvedValue(
        new Map([
          ["customer-1", [{ horseName: "Blansen", serviceName: "Hovvård", daysOverdue: 14 }]],
        ])
      )

      await notifierWithLookup.notifyFollowersOfNewRoute("ro-1")

      expect(mockNotificationService.createAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            overdueHorseName: "Blansen",
          }),
        })
      )
    })

    it("should fallback to standard for ALL followers when lookup throws", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue(mockFollowers)
      vi.mocked(mockDueForServiceLookup.getOverdueHorsesForCustomers).mockRejectedValue(
        new Error("DB connection failed")
      )

      await notifierWithLookup.notifyFollowersOfNewRoute("ro-1")

      // Should still send standard notifications to both
      expect(mockNotificationService.createAsync).toHaveBeenCalledTimes(2)
      for (const call of mockNotificationService.createAsync.mock.calls) {
        expect(call[0].type).toBe("route_announcement_new")
      }
    })

    it("should call batch-fetch exactly once with all customerIds", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue(mockFollowers)

      await notifierWithLookup.notifyFollowersOfNewRoute("ro-1")

      expect(mockDueForServiceLookup.getOverdueHorsesForCustomers).toHaveBeenCalledTimes(1)
      expect(mockDueForServiceLookup.getOverdueHorsesForCustomers).toHaveBeenCalledWith([
        "customer-1",
        "customer-2",
      ])
    })

    it("should use formatDaysAgo in enhanced message (7d -> 1 vecka sedan)", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([mockFollowers[0]])
      vi.mocked(mockDueForServiceLookup.getOverdueHorsesForCustomers).mockResolvedValue(
        new Map([
          ["customer-1", [{ horseName: "Blansen", serviceName: "Hovvård", daysOverdue: 7 }]],
        ])
      )

      await notifierWithLookup.notifyFollowersOfNewRoute("ro-1")

      expect(mockNotificationService.createAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("1 vecka sedan"),
        })
      )
    })

    it("should use different email subject for enhanced vs standard", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue(mockFollowers)
      vi.mocked(mockDueForServiceLookup.getOverdueHorsesForCustomers).mockResolvedValue(
        new Map([
          ["customer-1", [{ horseName: "Blansen", serviceName: "Hovvård", daysOverdue: 14 }]],
          // customer-2 has no overdue
        ])
      )

      await notifierWithLookup.notifyFollowersOfNewRoute("ro-1")

      // customer-1 gets enhanced email subject
      const enhancedEmailCall = mockEmailService.send.mock.calls.find(
        (call: [{ to: string; subject: string }]) => call[0].to === "anna@example.com"
      )
      expect(enhancedEmailCall![0].subject).toContain("Blansen")
      expect(enhancedEmailCall![0].subject).toContain("Hovslagare AB")

      // customer-2 gets standard email subject
      const standardEmailCall = mockEmailService.send.mock.calls.find(
        (call: [{ to: string; subject: string }]) => call[0].to === "erik@example.com"
      )
      expect(standardEmailCall![0].subject).toContain("Ny ruttannons")
    })
  })

  // --- Municipality watch tests ---

  describe("with watchRepo", () => {
    let notifierWithWatch: RouteAnnouncementNotifier

    beforeEach(() => {
      notifierWithWatch = createNotifier({ watchRepo: mockWatchRepo })
      // Reset defaults (clearAllMocks in parent wipes return values)
      mockDeliveryStore.exists.mockResolvedValue(false)
      mockEmailService.send.mockResolvedValue({ success: true })
      vi.mocked(mockWatchRepo.findWatchersForAnnouncement).mockResolvedValue([])
    })

    it("should notify watchers who are not followers", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      // No followers
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([])
      // One watcher
      vi.mocked(mockWatchRepo.findWatchersForAnnouncement).mockResolvedValue([
        { userId: "watcher-1", email: "watcher@example.com", firstName: "Watcher" },
      ])

      await notifierWithWatch.notifyFollowersOfNewRoute("ro-1")

      expect(mockNotificationService.createAsync).toHaveBeenCalledTimes(1)
      expect(mockNotificationService.createAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "watcher-1",
          type: "municipality_watch_match",
          message: expect.stringContaining("Du bevakar"),
        })
      )
    })

    it("should use watcher email template with blue header", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([])
      vi.mocked(mockWatchRepo.findWatchersForAnnouncement).mockResolvedValue([
        { userId: "watcher-1", email: "watcher@example.com", firstName: "Watcher" },
      ])

      await notifierWithWatch.notifyFollowersOfNewRoute("ro-1")

      const emailCall = mockEmailService.send.mock.calls[0][0]
      expect(emailCall.html).toContain("#2563eb") // blue
      expect(emailCall.html).toContain("Du bevakar")
    })

    it("should prefer follower notification when customer is both follower and watcher", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      // customer-1 is a follower
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([
        { userId: "customer-1", email: "anna@example.com", firstName: "Anna" },
      ])
      // customer-1 is also a watcher
      vi.mocked(mockWatchRepo.findWatchersForAnnouncement).mockResolvedValue([
        { userId: "customer-1", email: "anna@example.com", firstName: "Anna" },
      ])

      await notifierWithWatch.notifyFollowersOfNewRoute("ro-1")

      // Should only get ONE notification (follower version), not two
      expect(mockNotificationService.createAsync).toHaveBeenCalledTimes(1)
      expect(mockNotificationService.createAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "route_announcement_new", // follower type, not watch type
        })
      )
    })

    it("should deduplicate: follower gets follower notis, watcher gets watcher notis", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([
        { userId: "follower-1", email: "follower@example.com", firstName: "Follower" },
      ])
      vi.mocked(mockWatchRepo.findWatchersForAnnouncement).mockResolvedValue([
        { userId: "watcher-1", email: "watcher@example.com", firstName: "Watcher" },
      ])

      await notifierWithWatch.notifyFollowersOfNewRoute("ro-1")

      // 2 in-app notifications
      expect(mockNotificationService.createAsync).toHaveBeenCalledTimes(2)
      // 2 emails
      expect(mockEmailService.send).toHaveBeenCalledTimes(2)
    })

    it("should call findWatchersForAnnouncement with correct service names", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([])
      vi.mocked(mockWatchRepo.findWatchersForAnnouncement).mockResolvedValue([])

      await notifierWithWatch.notifyFollowersOfNewRoute("ro-1")

      expect(mockWatchRepo.findWatchersForAnnouncement).toHaveBeenCalledWith(
        "Alingsås",
        ["Hovslagning", "Hovvård"]
      )
    })

    it("should not call watchRepo when municipality is null", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue({
        ...mockRouteOrder,
        municipality: null,
      })

      await notifierWithWatch.notifyFollowersOfNewRoute("ro-1")

      expect(mockWatchRepo.findWatchersForAnnouncement).not.toHaveBeenCalled()
    })

    it("should skip watch notification if dedup store says already delivered", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([])
      vi.mocked(mockWatchRepo.findWatchersForAnnouncement).mockResolvedValue([
        { userId: "watcher-1", email: "watcher@example.com", firstName: "Watcher" },
      ])
      mockDeliveryStore.exists.mockResolvedValue(true) // already delivered

      await notifierWithWatch.notifyFollowersOfNewRoute("ro-1")

      expect(mockNotificationService.createAsync).not.toHaveBeenCalled()
    })

    it("should handle watchRepo error gracefully", async () => {
      mockRouteOrderLookup.findById.mockResolvedValue(mockRouteOrder)
      vi.mocked(mockFollowRepo.findFollowersInMunicipality).mockResolvedValue([mockFollowers[0]])
      vi.mocked(mockWatchRepo.findWatchersForAnnouncement).mockRejectedValue(
        new Error("DB error")
      )

      // Should still notify followers, just skip watchers
      await notifierWithWatch.notifyFollowersOfNewRoute("ro-1")

      expect(mockNotificationService.createAsync).toHaveBeenCalledTimes(1)
    })
  })

  describe("formatDaysAgo", () => {
    it("should return 'idag' for 0 days", () => {
      expect(formatDaysAgo(0)).toBe("idag")
    })

    it("should return 'X dagar sedan' for 1-6 days", () => {
      expect(formatDaysAgo(1)).toBe("1 dag sedan")
      expect(formatDaysAgo(3)).toBe("3 dagar sedan")
      expect(formatDaysAgo(6)).toBe("6 dagar sedan")
    })

    it("should return 'X vecka/veckor sedan' for 7+ days", () => {
      expect(formatDaysAgo(7)).toBe("1 vecka sedan")
      expect(formatDaysAgo(14)).toBe("2 veckor sedan")
      expect(formatDaysAgo(21)).toBe("3 veckor sedan")
    })

    it("should round down weeks", () => {
      expect(formatDaysAgo(10)).toBe("1 vecka sedan")
      expect(formatDaysAgo(13)).toBe("1 vecka sedan")
    })
  })
})
