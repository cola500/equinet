/**
 * MunicipalityWatchService - Domain service for municipality + service type watches
 *
 * Handles creation/deletion with validation:
 * - Municipality must be valid Swedish municipality
 * - Service type name must be non-empty
 * - Max 10 watches per customer
 */
import { isValidMunicipality } from "@/lib/geo/municipalities"
import type {
  IMunicipalityWatchRepository,
  MunicipalityWatch,
} from "@/infrastructure/persistence/municipality-watch/IMunicipalityWatchRepository"

const MAX_WATCHES_PER_CUSTOMER = 10

type WatchError = "INVALID_MUNICIPALITY" | "INVALID_SERVICE_TYPE" | "MAX_WATCHES_REACHED"

type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export class MunicipalityWatchService {
  constructor(private readonly watchRepo: IMunicipalityWatchRepository) {}

  async addWatch(
    customerId: string,
    municipality: string,
    serviceTypeName: string
  ): Promise<Result<MunicipalityWatch, WatchError>> {
    if (!isValidMunicipality(municipality)) {
      return { ok: false, error: "INVALID_MUNICIPALITY" }
    }

    if (!serviceTypeName || !serviceTypeName.trim()) {
      return { ok: false, error: "INVALID_SERVICE_TYPE" }
    }

    const count = await this.watchRepo.countByCustomerId(customerId)
    if (count >= MAX_WATCHES_PER_CUSTOMER) {
      return { ok: false, error: "MAX_WATCHES_REACHED" }
    }

    const watch = await this.watchRepo.create(customerId, municipality, serviceTypeName.trim())
    return { ok: true, value: watch }
  }

  async removeWatch(id: string, customerId: string): Promise<boolean> {
    return this.watchRepo.delete(id, customerId)
  }

  async getWatches(customerId: string): Promise<MunicipalityWatch[]> {
    return this.watchRepo.findByCustomerId(customerId)
  }
}
