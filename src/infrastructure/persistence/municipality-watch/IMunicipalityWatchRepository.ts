/**
 * IMunicipalityWatchRepository - Repository interface for MunicipalityWatch aggregate
 *
 * Defines data access operations for municipality + service type watches.
 * Used for route announcement notifications to watchers.
 */
import type { FollowerInfo } from "@/infrastructure/persistence/follow/IFollowRepository"

export interface MunicipalityWatch {
  id: string
  customerId: string
  municipality: string
  serviceTypeName: string
  createdAt: Date
}

export interface IMunicipalityWatchRepository {
  create(customerId: string, municipality: string, serviceTypeName: string): Promise<MunicipalityWatch>
  delete(id: string, customerId: string): Promise<boolean>
  findByCustomerId(customerId: string): Promise<MunicipalityWatch[]>
  countByCustomerId(customerId: string): Promise<number>
  findWatchersForAnnouncement(municipality: string, serviceTypeNames: string[]): Promise<FollowerInfo[]>
}
