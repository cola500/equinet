import { describe, it, expect, beforeEach, vi } from "vitest"
import { RouteAnnouncementNotifier } from "./RouteAnnouncementNotifier"
import type { IFollowRepository, FollowerInfo } from "@/infrastructure/persistence/follow/IFollowRepository"

// Mock dependencies
const mockFollowRepo: IFollowRepository = {
  create: vi.fn(),
  delete: vi.fn(),
  findByCustomerAndProvider: vi.fn(),
  findByCustomerIdWithProvider: vi.fn(),
  findFollowersInMunicipality: vi.fn(),
  countByProvider: vi.fn(),
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

function createNotifier() {
  return new RouteAnnouncementNotifier({
    followRepo: mockFollowRepo,
    notificationService: mockNotificationService as any,
    emailService: mockEmailService as any,
    routeOrderLookup: mockRouteOrderLookup,
    deliveryStore: mockDeliveryStore,
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
})
