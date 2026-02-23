import { describe, it, expect, beforeEach, vi } from "vitest"
import { ReminderService } from "./ReminderService"

// Mock Prisma
const mockBookingFindMany = vi.fn()
const mockNotificationCount = vi.fn()
const mockHorseServiceIntervalFindUnique = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
    },
    notification: {
      count: (...args: unknown[]) => mockNotificationCount(...args),
    },
    horseServiceInterval: {
      findUnique: (...args: unknown[]) => mockHorseServiceIntervalFindUnique(...args),
    },
  },
}))

const mockNotificationCreate = vi.fn()

vi.mock("@/domain/notification/NotificationService", () => ({
  notificationService: {
    create: (...args: unknown[]) => mockNotificationCreate(...args),
  },
  NotificationType: {
    REMINDER_REBOOK: "reminder_rebook",
  },
}))

const mockSendRebookingReminder = vi.fn()

vi.mock("@/lib/email", () => ({
  sendRebookingReminderNotification: (...args: unknown[]) =>
    mockSendRebookingReminder(...args),
}))

describe("ReminderService", () => {
  let service: ReminderService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ReminderService()
  })

  describe("findDueReminders", () => {
    it("should find completed bookings that are due for rebooking", async () => {
      const completedBookings = [
        {
          id: "booking-1",
          customerId: "customer-1",
          providerId: "provider-1",
          horseId: "horse-1",
          service: {
            id: "service-1",
            name: "Hovslagning",
            recommendedIntervalWeeks: 6,
          },
          provider: {
            businessName: "Smedjan",
          },
          updatedAt: new Date("2025-12-19"), // 6 weeks before 2026-01-30
        },
      ]

      mockBookingFindMany.mockResolvedValue(completedBookings)
      mockHorseServiceIntervalFindUnique.mockResolvedValue(null) // No override
      // No existing reminder for this booking
      mockNotificationCount.mockResolvedValue(0)

      const today = new Date("2026-01-30")
      const result = await service.findDueReminders(today)

      expect(result).toHaveLength(1)
      expect(result[0].bookingId).toBe("booking-1")
      expect(result[0].customerId).toBe("customer-1")
    })

    it("should NOT include bookings that already have a reminder notification", async () => {
      const completedBookings = [
        {
          id: "booking-1",
          customerId: "customer-1",
          providerId: "provider-1",
          horseId: "horse-1",
          service: {
            id: "service-1",
            name: "Hovslagning",
            recommendedIntervalWeeks: 6,
          },
          provider: {
            businessName: "Smedjan",
          },
          updatedAt: new Date("2025-12-19"),
        },
      ]

      mockBookingFindMany.mockResolvedValue(completedBookings)
      mockHorseServiceIntervalFindUnique.mockResolvedValue(null)
      // Already has a reminder
      mockNotificationCount.mockResolvedValue(1)

      const today = new Date("2026-01-30")
      const result = await service.findDueReminders(today)

      expect(result).toHaveLength(0)
    })

    it("should use horse+service-specific override interval when available", async () => {
      const completedBookings = [
        {
          id: "booking-1",
          customerId: "customer-1",
          providerId: "provider-1",
          horseId: "horse-1",
          service: {
            id: "service-1",
            name: "Hovslagning",
            recommendedIntervalWeeks: 8, // Default: 8 weeks
          },
          provider: {
            businessName: "Smedjan",
          },
          updatedAt: new Date("2025-12-30"), // 4.5 weeks before 2026-01-30
        },
      ]

      mockBookingFindMany.mockResolvedValue(completedBookings)
      // Horse+service-specific override: 4 weeks (shorter than default 8)
      mockHorseServiceIntervalFindUnique.mockResolvedValue({
        revisitIntervalWeeks: 4,
      })
      mockNotificationCount.mockResolvedValue(0)

      const today = new Date("2026-01-30")
      const result = await service.findDueReminders(today)

      // Should be due because override says 4 weeks, and it's been ~4.5 weeks
      expect(result).toHaveLength(1)
      expect(result[0].bookingId).toBe("booking-1")

      // Verify findUnique was called with new compound key including serviceId
      expect(mockHorseServiceIntervalFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            horseId_providerId_serviceId: {
              horseId: "horse-1",
              providerId: "provider-1",
              serviceId: "service-1",
            },
          },
        })
      )
    })

    it("should NOT be due when horse+service-specific override extends the interval", async () => {
      const completedBookings = [
        {
          id: "booking-1",
          customerId: "customer-1",
          providerId: "provider-1",
          horseId: "horse-1",
          service: {
            id: "service-1",
            name: "Hovslagning",
            recommendedIntervalWeeks: 4, // Default: 4 weeks
          },
          provider: {
            businessName: "Smedjan",
          },
          updatedAt: new Date("2026-01-02"), // ~4 weeks before 2026-01-30
        },
      ]

      mockBookingFindMany.mockResolvedValue(completedBookings)
      // Horse+service-specific override: 12 weeks (longer than default 4)
      mockHorseServiceIntervalFindUnique.mockResolvedValue({
        revisitIntervalWeeks: 12,
      })
      mockNotificationCount.mockResolvedValue(0)

      const today = new Date("2026-01-30")
      const result = await service.findDueReminders(today)

      // Should NOT be due - override says 12 weeks, only 4 have passed
      expect(result).toHaveLength(0)
    })

    it("should fall back to service default when no horse override exists", async () => {
      const completedBookings = [
        {
          id: "booking-1",
          customerId: "customer-1",
          providerId: "provider-1",
          horseId: "horse-1",
          service: {
            id: "service-1",
            name: "Hovslagning",
            recommendedIntervalWeeks: 6,
          },
          provider: {
            businessName: "Smedjan",
          },
          updatedAt: new Date("2025-12-19"), // 6 weeks before 2026-01-30
        },
      ]

      mockBookingFindMany.mockResolvedValue(completedBookings)
      // No override for this horse
      mockHorseServiceIntervalFindUnique.mockResolvedValue(null)
      mockNotificationCount.mockResolvedValue(0)

      const today = new Date("2026-01-30")
      const result = await service.findDueReminders(today)

      expect(result).toHaveLength(1)
    })

    it("should fall back to service default when booking has no horseId", async () => {
      const completedBookings = [
        {
          id: "booking-1",
          customerId: "customer-1",
          providerId: "provider-1",
          horseId: null, // No horse linked
          service: {
            id: "service-1",
            name: "Massage",
            recommendedIntervalWeeks: 6,
          },
          provider: {
            businessName: "Smedjan",
          },
          updatedAt: new Date("2025-12-19"),
        },
      ]

      mockBookingFindMany.mockResolvedValue(completedBookings)
      mockNotificationCount.mockResolvedValue(0)

      const today = new Date("2026-01-30")
      const result = await service.findDueReminders(today)

      expect(result).toHaveLength(1)
      // Should NOT have tried to look up horse interval
      expect(mockHorseServiceIntervalFindUnique).not.toHaveBeenCalled()
    })

    it("should NOT include bookings where interval is not yet reached", async () => {
      const completedBookings = [
        {
          id: "booking-1",
          customerId: "customer-1",
          providerId: "provider-1",
          horseId: "horse-1",
          service: {
            id: "service-1",
            name: "Hovslagning",
            recommendedIntervalWeeks: 6,
          },
          provider: {
            businessName: "Smedjan",
          },
          // Only 4 weeks ago - too early
          updatedAt: new Date("2026-01-02"),
        },
      ]

      mockBookingFindMany.mockResolvedValue(completedBookings)
      mockHorseServiceIntervalFindUnique.mockResolvedValue(null)

      const today = new Date("2026-01-30")
      const result = await service.findDueReminders(today)

      expect(result).toHaveLength(0)
    })
  })

  describe("sendReminder", () => {
    it("should create in-app notification and send email", async () => {
      mockNotificationCreate.mockResolvedValue({ id: "notif-1" })
      mockSendRebookingReminder.mockResolvedValue({ success: true })

      const reminder = {
        bookingId: "booking-1",
        customerId: "customer-1",
        providerId: "provider-1",
        serviceId: "service-1",
        serviceName: "Hovslagning",
        providerName: "Smedjan",
      }

      await service.sendReminder(reminder)

      expect(mockNotificationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "customer-1",
          type: "reminder_rebook",
          linkUrl: expect.stringContaining("/providers/provider-1"),
        })
      )

      expect(mockSendRebookingReminder).toHaveBeenCalledWith(
        "customer-1",
        expect.objectContaining({
          serviceName: "Hovslagning",
          providerName: "Smedjan",
        })
      )
    })
  })
})
