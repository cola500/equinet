import { StableSpotService } from "./StableSpotService"
import { PrismaStableRepository } from "@/infrastructure/persistence/stable/PrismaStableRepository"

export function createStableSpotService(): StableSpotService {
  return new StableSpotService(new PrismaStableRepository())
}
