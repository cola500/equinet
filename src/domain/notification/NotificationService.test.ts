import { describe, it, expect, beforeEach, vi } from "vitest"
import { NotificationService, NotificationType } from "./NotificationService"
import type { CreateNotificationInput } from "./NotificationService"

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

const mockLoggerError = vi.fn()

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

const baseInput: CreateNotificationInput = {
  userId: "user-1",
  type: NotificationType.BOOKING_CREATED,
  message: "Ny bokning mottagen",
}

describe("NotificationService", () => {
  let service: NotificationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new NotificationService()
  })

  describe("create()", () => {
    it("should create notification with all fields", async () => {
      const input: CreateNotificationInput = {
        ...baseInput,
        linkUrl: "/provider/bookings",
        metadata: { bookingId: "booking-1" },
      }
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

      const result = await service.create(input)

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

    it("should stringify metadata to JSON", async () => {
      const input: CreateNotificationInput = {
        ...baseInput,
        metadata: { key: "value", nested: "data" },
      }
      mockCreate.mockResolvedValue({} as never)

      await service.create(input)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: '{"key":"value","nested":"data"}',
          }),
        })
      )
    })

    it("should create notification without optional fields", async () => {
      mockCreate.mockResolvedValue({} as never)

      await service.create(baseInput)

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "booking_created",
          message: "Ny bokning mottagen",
          linkUrl: undefined,
          metadata: undefined,
        },
      })
    })
  })

  describe("getForUser()", () => {
    it("should fetch notifications with select (no userId/metadata exposed)", async () => {
      const mockNotifications = [
        {
          id: "n1",
          type: "booking_confirmed",
          message: "Bekräftad",
          isRead: false,
          linkUrl: "/bookings/1",
          createdAt: new Date("2026-01-30"),
        },
      ]
      mockFindMany.mockResolvedValue(mockNotifications)

      const result = await service.getForUser("user-1")

      expect(result).toEqual(mockNotifications)
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          message: true,
          isRead: true,
          linkUrl: true,
          createdAt: true,
        },
      })
    })

    it("should use default limit of 20", async () => {
      mockFindMany.mockResolvedValue([])

      await service.getForUser("user-1")

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 })
      )
    })

    it("should respect custom limit", async () => {
      mockFindMany.mockResolvedValue([])

      await service.getForUser("user-1", { limit: 5 })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      )
    })

    it("should order by createdAt desc", async () => {
      mockFindMany.mockResolvedValue([])

      await service.getForUser("user-1")

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } })
      )
    })
  })

  describe("getUnreadCount()", () => {
    it("should return count of unread notifications", async () => {
      mockCount.mockResolvedValue(7)

      const result = await service.getUnreadCount("user-1")

      expect(result).toBe(7)
      expect(mockCount).toHaveBeenCalledWith({
        where: { userId: "user-1", isRead: false },
      })
    })
  })

  describe("markAsRead()", () => {
    it("should update notification with ownership check (userId in WHERE)", async () => {
      const mockUpdated = { id: "n1", userId: "user-1", isRead: true }
      mockUpdate.mockResolvedValue(mockUpdated)

      const result = await service.markAsRead("n1", "user-1")

      expect(result).toEqual(mockUpdated)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "n1", userId: "user-1" },
        data: { isRead: true },
      })
    })

    it("should propagate Prisma P2025 error for wrong id/user", async () => {
      const prismaError = new Error("Record to update not found.")
      Object.assign(prismaError, { code: "P2025" })
      mockUpdate.mockRejectedValue(prismaError)

      await expect(service.markAsRead("wrong-id", "user-1")).rejects.toThrow(
        "Record to update not found."
      )
    })
  })

  describe("markAllAsRead()", () => {
    it("should mark all unread as read for user", async () => {
      mockUpdateMany.mockResolvedValue({ count: 3 })

      const result = await service.markAllAsRead("user-1")

      expect(result).toEqual({ count: 3 })
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", isRead: false },
        data: { isRead: true },
      })
    })
  })

  describe("createAsync()", () => {
    it("should create notification successfully", async () => {
      mockCreate.mockResolvedValue({} as never)

      await service.createAsync(baseInput)

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "booking_created",
          message: "Ny bokning mottagen",
          linkUrl: undefined,
          metadata: undefined,
        },
      })
    })

    it("should log error and NOT throw on failure", async () => {
      const error = new Error("DB connection lost")
      mockCreate.mockRejectedValue(error)

      // Should resolve without throwing
      await expect(service.createAsync(baseInput)).resolves.toBeUndefined()

      expect(mockLoggerError).toHaveBeenCalled()
    })

    it("should log error with proper context", async () => {
      const error = new Error("timeout")
      mockCreate.mockRejectedValue(error)

      await service.createAsync(baseInput)

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to create notification",
        error
      )
    })
  })
})
