import { StableService } from "./StableService"
import { PrismaStableRepository } from "@/infrastructure/persistence/stable/PrismaStableRepository"

export function createStableService(): StableService {
  return new StableService(new PrismaStableRepository())
}
