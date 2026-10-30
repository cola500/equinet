import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { logger } from "@/lib/logger"
import { optimizeStopOrder, MAX_OPTIMIZE_ORDERS } from "@/lib/geo/route-optimization"
import { z } from "zod"

// Coordinates only: the optimizer needs no names or addresses (data minimization)
const pointSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  })
  .strict()

const optimizeRouteSchema = z
  .object({
    start_location: pointSchema,
    orders: z
      .array(pointSchema)
      .min(2, "Minst 2 beställningar krävs")
      .max(MAX_OPTIMIZE_ORDERS, `Högst ${MAX_OPTIMIZE_ORDERS} beställningar per optimering`),
  })
  .strict()

export const POST = withApiHandler(
  { auth: "provider", featureFlag: "route_planning", schema: optimizeRouteSchema },
  async ({ body }) => {
    const result = optimizeStopOrder(body.start_location, body.orders)

    logger.info("Optimize route success", {
      orderCount: result.num_stops,
      improvementPercent: result.improvement_percent,
    })

    return NextResponse.json(result)
  }
)
