import { describe, it, expect, beforeEach, vi } from "vitest"
import { NotificationService, NotificationType } from "./NotificationService"

// Mock Prisma
const mockCreate = vi.fn()
const mockFindMany = vi.fn()
const mockUpdate = vi.fn()
const mockUpdateMany = vi.fn()
const mockCount = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}))

describe("NotificationService", () => {
  let service: NotificationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new NotificationService()
  })

  describe("create", () => {
    it("should create a notification with all fields", async () => {
      const mockNotification = {
        id: "notif-1",
        userId: "user-1",
        type: "booking_created",
        message: "Ny bokning mottagen",
        isRead: false,
        linkUrl: "/provider/bookings",
        metadata: JSON.stringify({ bookingId: "booking-1" }),
        createdAt: new Date(),
      }
      mockCreate.mockResolvedValue(mockNotification)

      const result = await service.create({
        userId: "user-1",
        type: NotificationType.BOOKING_CREATED,
        message: "Ny bokning mottagen",
        linkUrl: "/provider/bookings",
        metadata: { bookingId: "booking-1" },
      })

      expect(result).toEqual(mockNotification)
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "booking_created",
          message: "Ny bokning mottagen",
          linkUrl: "/provider/bookings",
          metadata: JSON.stringify({ bookingId: "booking-1" }),
        },
      })
    })

    it("should create a notification without optional fields", async () => {
      const mockNotification = {
        id: "notif-2",
        userId: "user-1",
        type: "booking_confirmed",
        message: "Din bokning har bekräftats",
        isRead: false,
        linkUrl: null,
        metadata: null,
        createdAt: new Date(),
      }
      mockCreate.mockResolvedValue(mockNotification)

      const result = await service.create({
        userId: "user-1",
        type: NotificationType.BOOKING_CONFIRMED,
        message: "Din bokning har bekräftats",
      })

      expect(result).toEqual(mockNotification)
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "booking_confirmed",
          message: "Din bokning har bekräftats",
          linkUrl: undefined,
          metadata: undefined,
        },
      })
    })
  })

  describe("getForUser", () => {
    it("should return notifications for a user ordered by creation date", async () => {
      const mockNotifications = [
        { id: "n1", message: "First", createdAt: new Date("2026-01-30") },
        { id: "n2", message: "Second", createdAt: new Date("2026-01-29") },
      ]
      mockFindMany.mockResolvedValue(mockNotifications)

      const result = await service.getForUser("user-1", { limit: 20 })

      expect(result).toEqual(mockNotifications)
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    })

    it("should default to 20 notifications", async () => {
      mockFindMany.mockResolvedValue([])

      await service.getForUser("user-1")

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    })
  })

  describe("getUnreadCount", () => {
    it("should return count of unread notifications", async () => {
      mockCount.mockResolvedValue(5)

      const result = await service.getUnreadCount("user-1")

      expect(result).toBe(5)
      expect(mockCount).toHaveBeenCalledWith({
        where: { userId: "user-1", isRead: false },
      })
    })
  })

  describe("markAsRead", () => {
    it("should mark a single notification as read with ownership check", async () => {
      const mockNotification = { id: "n1", userId: "user-1", isRead: true }
      mockUpdate.mockResolvedValue(mockNotification)

      const result = await service.markAsRead("n1", "user-1")

      expect(result).toEqual(mockNotification)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "n1", userId: "user-1" },
        data: { isRead: true },
      })
    })
  })

  describe("markAllAsRead", () => {
    it("should mark all unread notifications as read for a user", async () => {
      mockUpdateMany.mockResolvedValue({ count: 3 })

      const result = await service.markAllAsRead("user-1")

      expect(result).toEqual({ count: 3 })
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", isRead: false },
        data: { isRead: true },
      })
    })
  })
})
