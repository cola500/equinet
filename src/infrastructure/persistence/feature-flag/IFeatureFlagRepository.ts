/**
 * IFeatureFlagRepository - Repository interface for feature flag persistence
 *
 * Replaces Redis-backed feature flag storage with PostgreSQL.
 */

export interface FeatureFlagRecord {
  key: string
  enabled: boolean
  updatedAt: Date
  updatedBy: string | null
}

export interface IFeatureFlagRepository {
  findAll(): Promise<FeatureFlagRecord[]>
  upsert(key: string, enabled: boolean, updatedBy?: string): Promise<FeatureFlagRecord>
  findByKey(key: string): Promise<FeatureFlagRecord | null>
}
