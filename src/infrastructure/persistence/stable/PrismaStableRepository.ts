/**
 * PrismaStableRepository - Prisma implementation for Stable aggregate
 *
 * All queries use `select` (never `include`).
 */
import { prisma } from "@/lib/prisma"
import type {
  IStableRepository,
  Stable,
  StableWithCounts,
  StableSpot,
  StableFilters,
  CreateStableData,
  UpdateStableData,
  CreateStableSpotData,
  UpdateStableSpotData,
} from "./IStableRepository"

const stableSelect = {
  id: true,
  userId: true,
  name: true,
  description: true,
  address: true,
  city: true,
  postalCode: true,
  municipality: true,
  latitude: true,
  longitude: true,
  contactEmail: true,
  contactPhone: true,
  profileImageUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

const spotSelect = {
  id: true,
  stableId: true,
  label: true,
  status: true,
  pricePerMonth: true,
  availableFrom: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const

export class PrismaStableRepository implements IStableRepository {
  async create(data: CreateStableData): Promise<Stable> {
    return prisma.stable.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        municipality: data.municipality,
        latitude: data.latitude,
        longitude: data.longitude,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
      },
      select: stableSelect,
    })
  }

  async findById(id: string): Promise<Stable | null> {
    return prisma.stable.findUnique({
      where: { id },
      select: stableSelect,
    })
  }

  async findByUserId(userId: string): Promise<Stable | null> {
    return prisma.stable.findUnique({
      where: { userId },
      select: stableSelect,
    })
  }

  async updateByUserId(userId: string, data: UpdateStableData): Promise<Stable | null> {
    try {
      return await prisma.stable.update({
        where: { userId },
        data,
        select: stableSelect,
      })
    } catch (error: unknown) {
      // P2025 = Record not found
      if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
        return null
      }
      throw error
    }
  }

  async findPublicById(id: string): Promise<StableWithCounts | null> {
    const stable = await prisma.stable.findUnique({
      where: { id, isActive: true },
      select: {
        ...stableSelect,
        _count: {
          select: {
            spots: true,
          },
        },
      },
    })
    if (!stable) return null

    const availableCount = await prisma.stableSpot.count({
      where: { stableId: id, status: "available" },
    })

    return {
      ...stable,
      _count: {
        spots: stable._count.spots,
        availableSpots: availableCount,
      },
    }
  }

  async findAll(filters: StableFilters): Promise<StableWithCounts[]> {
    const where: Record<string, unknown> = {}

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive
    } else {
      where.isActive = true // Default to active stables
    }

    if (filters.municipality) {
      where.municipality = { equals: filters.municipality, mode: "insensitive" }
    }

    if (filters.city) {
      where.city = { equals: filters.city, mode: "insensitive" }
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ]
    }

    if (filters.hasAvailableSpots) {
      where.spots = { some: { status: "available" } }
    }

    const stables = await prisma.stable.findMany({
      where,
      select: {
        ...stableSelect,
        _count: {
          select: {
            spots: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Get available counts for each stable
    const stableIds = stables.map((s) => s.id)
    const availableCounts = await prisma.stableSpot.groupBy({
      by: ["stableId"],
      where: { stableId: { in: stableIds }, status: "available" },
      _count: true,
    })

    const availableMap = new Map(availableCounts.map((c) => [c.stableId, c._count]))

    return stables.map((s) => ({
      ...s,
      _count: {
        spots: s._count.spots,
        availableSpots: availableMap.get(s.id) ?? 0,
      },
    }))
  }

  // Spots CRUD
  async createSpot(data: CreateStableSpotData): Promise<StableSpot> {
    return prisma.stableSpot.create({
      data: {
        stableId: data.stableId,
        label: data.label,
        status: data.status ?? "available",
        pricePerMonth: data.pricePerMonth,
        availableFrom: data.availableFrom,
        notes: data.notes,
      },
      select: spotSelect,
    })
  }

  async findSpotById(id: string): Promise<StableSpot | null> {
    return prisma.stableSpot.findUnique({
      where: { id },
      select: spotSelect,
    })
  }

  async findSpotsByStableId(stableId: string): Promise<StableSpot[]> {
    return prisma.stableSpot.findMany({
      where: { stableId },
      select: spotSelect,
      orderBy: { createdAt: "asc" },
    })
  }

  async updateSpot(id: string, stableId: string, data: UpdateStableSpotData): Promise<StableSpot | null> {
    try {
      return await prisma.stableSpot.update({
        where: { id, stableId },
        data,
        select: spotSelect,
      })
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
        return null
      }
      throw error
    }
  }

  async deleteSpot(id: string, stableId: string): Promise<boolean> {
    try {
      await prisma.stableSpot.delete({
        where: { id, stableId },
      })
      return true
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
        return false
      }
      throw error
    }
  }

  async countSpots(stableId: string): Promise<{ total: number; available: number }> {
    const [total, available] = await Promise.all([
      prisma.stableSpot.count({ where: { stableId } }),
      prisma.stableSpot.count({ where: { stableId, status: "available" } }),
    ])
    return { total, available }
  }
}
