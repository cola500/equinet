import { describe, it, expect, vi, beforeEach } from "vitest"
import { BookingReminderService } from "./BookingReminderService"

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findMany: vi.fn() },
    notification: { count: vi.fn() },
  },
}))

vi.mock("@/domain/notification/NotificationService", () => ({
  notificationService: { create: vi.fn() },
  NotificationType: {
    REMINDER_BOOKING_24H: "reminder_booking_24h",
  },
}))

vi.mock("@/lib/email", () => ({
  sendBookingReminderNotification: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { prisma } from "@/lib/prisma"
import { notificationService } from "@/domain/notification/NotificationService"
import { sendBookingReminderNotification } from "@/lib/email"
import { logger } from "@/lib/logger"

const mockFindMany = prisma.booking.findMany as ReturnType<typeof vi.fn>
const mockNotificationCount = prisma.notification.count as ReturnType<typeof vi.fn>
const mockNotificationCreate = notificationService.create as ReturnType<typeof vi.fn>
const mockSendEmail = sendBookingReminderNotification as ReturnType<typeof vi.fn>

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    bookingDate: new Date("2026-02-18T00:00:00.000Z"),
    startTime: "10:00",
    endTime: "11:00",
    customerId: "customer-1",
    providerId: "provider-1",
    service: {
      name: "Hovvård",
    },
    provider: {
      businessName: "Hovslagare AB",
      user: { firstName: "Anna", lastName: "Svensson" },
    },
    customer: {
      email: "kund@example.com",
      firstName: "Erik",
      lastName: "Johansson",
      emailRemindersEnabled: true,
    },
    ...overrides,
  }
}

describe("BookingReminderService", () => {
  let service: BookingReminderService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new BookingReminderService()
    mockNotificationCount.mockResolvedValue(0)
  })

  describe("findDueReminders", () => {
    it("finds confirmed bookings within 24h window", async () => {
      // now = 2026-02-17 08:00 UTC, booking at 2026-02-18 10:00 UTC = 26h away
      const now = new Date("2026-02-17T08:00:00.000Z")
      const booking = makeBooking()
      mockFindMany.mockResolvedValue([booking])

      const reminders = await service.findDueReminders(now)

      expect(reminders).toHaveLength(1)
      expect(reminders[0].bookingId).toBe("booking-1")
      expect(reminders[0].customerEmail).toBe("kund@example.com")
    })

    it("excludes bookings outside the 22-30h window (too far)", async () => {
      // now = 2026-02-16 08:00 UTC, booking at 2026-02-18 10:00 UTC = 50h away
      const now = new Date("2026-02-16T08:00:00.000Z")
      const booking = makeBooking()
      mockFindMany.mockResolvedValue([booking])

      const reminders = await service.findDueReminders(now)

      expect(reminders).toHaveLength(0)
    })

    it("excludes bookings outside the 22-30h window (too close)", async () => {
      // now = 2026-02-18 08:00 UTC, booking at 2026-02-18 10:00 UTC = 2h away
      const now = new Date("2026-02-18T08:00:00.000Z")
      const booking = makeBooking()
      mockFindMany.mockResolvedValue([booking])

      const reminders = await service.findDueReminders(now)

      expect(reminders).toHaveLength(0)
    })

    it("skips ghost users", async () => {
      const booking = makeBooking({
        customer: {
          email: "ghost@ghost.equinet.se",
          firstName: "Ghost",
          lastName: "User",
          emailRemindersEnabled: true,
        },
      })
      const now = new Date("2026-02-17T08:00:00.000Z")
      mockFindMany.mockResolvedValue([booking])

      const reminders = await service.findDueReminders(now)

      expect(reminders).toHaveLength(0)
    })

    it("skips customers with emailRemindersEnabled=false", async () => {
      const booking = makeBooking({
        customer: {
          email: "kund@example.com",
          firstName: "Erik",
          lastName: "Johansson",
          emailRemindersEnabled: false,
        },
      })
      const now = new Date("2026-02-17T08:00:00.000Z")
      mockFindMany.mockResolvedValue([booking])

      const reminders = await service.findDueReminders(now)

      expect(reminders).toHaveLength(0)
    })

    it("deduplicates via Notification table", async () => {
      const booking = makeBooking()
      const now = new Date("2026-02-17T08:00:00.000Z")
      mockFindMany.mockResolvedValue([booking])
      mockNotificationCount.mockResolvedValue(1) // Already reminded

      const reminders = await service.findDueReminders(now)

      expect(reminders).toHaveLength(0)
      expect(mockNotificationCount).toHaveBeenCalledWith({
        where: {
          userId: "customer-1",
          type: "reminder_booking_24h",
          metadata: { contains: "booking-1" },
        },
      })
    })

    it("correctly combines bookingDate + startTime", async () => {
      // bookingDate = 2026-02-18 midnight UTC, startTime = "14:30"
      // Combined = 2026-02-18 14:30 UTC
      // now = 2026-02-17 12:00 UTC -> 26.5h away -> inside window
      const now = new Date("2026-02-17T12:00:00.000Z")
      const booking = makeBooking({ startTime: "14:30" })
      mockFindMany.mockResolvedValue([booking])

      const reminders = await service.findDueReminders(now)

      expect(reminders).toHaveLength(1)
    })
  })

  describe("sendReminder", () => {
    it("creates notification and sends email", async () => {
      const reminder = {
        bookingId: "booking-1",
        customerId: "customer-1",
        customerEmail: "kund@example.com",
        providerId: "provider-1",
        serviceName: "Hovvård",
        providerName: "Hovslagare AB",
        bookingDate: "18 februari 2026",
        startTime: "10:00",
        endTime: "11:00",
      }

      await service.sendReminder(reminder)

      expect(mockNotificationCreate).toHaveBeenCalledWith({
        userId: "customer-1",
        type: "reminder_booking_24h",
        message: "Påminnelse: Du har en bokning för Hovvård hos Hovslagare AB imorgon kl 10:00",
        linkUrl: "/customer/bookings",
        metadata: { bookingId: "booking-1", providerId: "provider-1" },
      })

      expect(mockSendEmail).toHaveBeenCalledWith("booking-1")
    })
  })

  describe("processAll", () => {
    it("returns count of sent reminders", async () => {
      const now = new Date("2026-02-17T08:00:00.000Z")
      const booking1 = makeBooking({ id: "booking-1" })
      const booking2 = makeBooking({ id: "booking-2", customerId: "customer-2" })
      mockFindMany.mockResolvedValue([booking1, booking2])

      const count = await service.processAll(now)

      expect(count).toBe(2)
    })

    it("logs errors per booking and continues", async () => {
      const now = new Date("2026-02-17T08:00:00.000Z")
      const booking1 = makeBooking({ id: "booking-1" })
      const booking2 = makeBooking({ id: "booking-2", customerId: "customer-2" })
      mockFindMany.mockResolvedValue([booking1, booking2])

      // First reminder fails, second succeeds
      mockNotificationCreate
        .mockRejectedValueOnce(new Error("DB down"))
        .mockResolvedValueOnce({})

      const count = await service.processAll(now)

      expect(count).toBe(1)
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to send booking reminder for booking booking-1",
        expect.any(Error)
      )
    })
  })
})
