import { prisma } from "@/lib/prisma"
import type { IFeatureFlagRepository, FeatureFlagRecord } from "./IFeatureFlagRepository"

export class PrismaFeatureFlagRepository implements IFeatureFlagRepository {
  async findAll(): Promise<FeatureFlagRecord[]> {
    const flags = await prisma.featureFlag.findMany({
      select: { key: true, enabled: true, updatedAt: true, updatedBy: true },
      orderBy: { key: "asc" },
    })
    return flags
  }

  async upsert(
    key: string,
    enabled: boolean,
    updatedBy?: string
  ): Promise<FeatureFlagRecord> {
    const flag = await prisma.featureFlag.upsert({
      where: { key },
      update: { enabled, updatedBy: updatedBy ?? null },
      create: { key, enabled, updatedBy: updatedBy ?? null },
      select: { key: true, enabled: true, updatedAt: true, updatedBy: true },
    })
    return flag
  }

  async findByKey(key: string): Promise<FeatureFlagRecord | null> {
    const flag = await prisma.featureFlag.findUnique({
      where: { key },
      select: { key: true, enabled: true, updatedAt: true, updatedBy: true },
    })
    return flag
  }
}

export const featureFlagRepository = new PrismaFeatureFlagRepository()
