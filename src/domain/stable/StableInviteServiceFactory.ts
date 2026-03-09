import { StableInviteService } from "./StableInviteService"
import { PrismaStableInviteRepository } from "@/infrastructure/persistence/stable-invite/PrismaStableInviteRepository"

export function createStableInviteService(): StableInviteService {
  return new StableInviteService(new PrismaStableInviteRepository())
}
