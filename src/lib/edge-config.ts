import { get } from "@vercel/edge-config"
import { logger } from "./logger"

export async function readFlagsFromEdgeConfig(): Promise<Record<string, boolean> | null> {
  if (!process.env.EDGE_CONFIG) return null
  try {
    const flags = await get<Record<string, boolean>>("feature_flags")
    return flags ?? null
  } catch (error) {
    logger.warn("Failed to read feature flags from Edge Config, falling back to DB", {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function syncFlagsToEdgeConfig(flags: Record<string, boolean>): Promise<void> {
  const edgeConfigId = process.env.EDGE_CONFIG_ID
  const token = process.env.VERCEL_API_TOKEN
  if (!edgeConfigId || !token) return

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ operation: "upsert", key: "feature_flags", value: flags }],
        }),
      }
    )
    if (!response.ok) {
      logger.warn("Edge Config sync failed", { status: response.status, edgeConfigId })
    }
  } catch (error) {
    logger.warn("Edge Config sync error", {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
