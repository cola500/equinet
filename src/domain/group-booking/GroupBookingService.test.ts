import { describe, it, expect, beforeEach, vi } from "vitest"
import { GroupBookingService } from "./GroupBookingService"
import { prisma } from "@/lib/prisma"

const TEST_UUIDS = {
  groupRequest: "11111111-1111-4111-8111-111111111111",
  provider: "22222222-2222-4222-8222-222222222222",
  providerUser: "33333333-3333-4333-8333-333333333333",
  service: "44444444-4444-4444-8444-444444444444",
  participant1: "55555555-5555-4555-8555-555555555555",
  participant2: "66666666-6666-4666-8666-666666666666",
  user1: "77777777-7777-4777-8777-777777777777",
  user2: "88888888-8888-4888-8888-888888888888",
  booking1: "99999999-9999-4999-8999-999999999999",
  booking2: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupBookingRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    groupBookingParticipant: {
      update: vi.fn(),
    },
    booking: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock("@/domain/notification/NotificationService", () => ({
  notificationService: {
    createAsync: vi.fn(),
  },
  NotificationType: {
    GROUP_BOOKING_MATCHED: "group_booking_matched",
  },
}))

describe("GroupBookingService", () => {
  let service: GroupBookingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new GroupBookingService()
  })

  const mockGroupRequest = {
    id: TEST_UUIDS.groupRequest,
    status: "open",
    serviceType: "hovslagning",
    participants: [
      {
        id: TEST_UUIDS.participant1,
        userId: TEST_UUIDS.user1,
        status: "joined",
        horseName: "Blansen",
        horseInfo: null,
        horseId: null,
        notes: null,
        user: { id: TEST_UUIDS.user1, firstName: "Anna" },
      },
      {
        id: TEST_UUIDS.participant2,
        userId: TEST_UUIDS.user2,
        status: "joined",
        horseName: "Firfansen",
        horseInfo: null,
        horseId: null,
        notes: null,
        user: { id: TEST_UUIDS.user2, firstName: "Erik" },
      },
    ],
  }

  it("should create bookings for all participants in sequential time slots", async () => {
    vi.mocked(prisma.groupBookingRequest.findFirst).mockResolvedValue(
      mockGroupRequest as any
    )

    let bookingCount = 0
    // @ts-expect-error - Vitest type instantiation depth limitation
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const tx = {
        booking: {
          create: vi.fn().mockImplementation(async (args: any) => {
            bookingCount++
            return {
              id: bookingCount === 1 ? TEST_UUIDS.booking1 : TEST_UUIDS.booking2,
              ...args.data,
            }
          }),
        },
        groupBookingParticipant: {
          update: vi.fn().mockResolvedValue({}),
        },
        groupBookingRequest: {
          update: vi.fn().mockResolvedValue({}),
        },
      }
      return await callback(tx)
    })

    const result = await service.matchRequest({
      groupBookingRequestId: TEST_UUIDS.groupRequest,
      providerId: TEST_UUIDS.provider,
      providerUserId: TEST_UUIDS.providerUser,
      serviceId: TEST_UUIDS.service,
      bookingDate: new Date("2026-02-15"),
      startTime: "10:00",
      serviceDurationMinutes: 60,
    })

    expect(result.success).toBe(true)
    expect(result.bookingsCreated).toBe(2)
    expect(result.errors).toHaveLength(0)
  })

  it("should return error when group request not found", async () => {
    vi.mocked(prisma.groupBookingRequest.findFirst).mockResolvedValue(null)

    const result = await service.matchRequest({
      groupBookingRequestId: TEST_UUIDS.groupRequest,
      providerId: TEST_UUIDS.provider,
      providerUserId: TEST_UUIDS.providerUser,
      serviceId: TEST_UUIDS.service,
      bookingDate: new Date("2026-02-15"),
      startTime: "10:00",
      serviceDurationMinutes: 60,
    })

    expect(result.success).toBe(false)
    expect(result.errors[0]).toContain("hittades inte")
  })

  it("should return error when no active participants", async () => {
    vi.mocked(prisma.groupBookingRequest.findFirst).mockResolvedValue({
      ...mockGroupRequest,
      participants: [],
    } as any)

    const result = await service.matchRequest({
      groupBookingRequestId: TEST_UUIDS.groupRequest,
      providerId: TEST_UUIDS.provider,
      providerUserId: TEST_UUIDS.providerUser,
      serviceId: TEST_UUIDS.service,
      bookingDate: new Date("2026-02-15"),
      startTime: "10:00",
      serviceDurationMinutes: 60,
    })

    expect(result.success).toBe(false)
    expect(result.errors[0]).toContain("Inga aktiva")
  })
})
