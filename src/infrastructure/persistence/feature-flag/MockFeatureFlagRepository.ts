import type { IFeatureFlagRepository, FeatureFlagRecord } from "./IFeatureFlagRepository"

export class MockFeatureFlagRepository implements IFeatureFlagRepository {
  private flags: Map<string, FeatureFlagRecord> = new Map()

  async findAll(): Promise<FeatureFlagRecord[]> {
    return Array.from(this.flags.values())
  }

  async upsert(
    key: string,
    enabled: boolean,
    updatedBy?: string
  ): Promise<FeatureFlagRecord> {
    const record: FeatureFlagRecord = {
      key,
      enabled,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    }
    this.flags.set(key, record)
    return record
  }

  async findByKey(key: string): Promise<FeatureFlagRecord | null> {
    return this.flags.get(key) ?? null
  }
}
