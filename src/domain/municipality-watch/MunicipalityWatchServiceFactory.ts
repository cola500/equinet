/**
 * MunicipalityWatchServiceFactory - Creates MunicipalityWatchService with production dependencies
 */
import { MunicipalityWatchService } from "./MunicipalityWatchService"
import { MunicipalityWatchRepository } from "@/infrastructure/persistence/municipality-watch/MunicipalityWatchRepository"

export function createMunicipalityWatchService(): MunicipalityWatchService {
  return new MunicipalityWatchService(new MunicipalityWatchRepository())
}
