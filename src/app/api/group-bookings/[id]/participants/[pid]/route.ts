import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { logger } from "@/lib/logger"
import { createGroupBookingService } from "@/domain/group-booking/GroupBookingService"
import { mapGroupBookingErrorToStatus } from "@/domain/group-booking/mapGroupBookingErrorToStatus"

type RouteParams = { params: Promise<{ id: string; pid: string }> }

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id, pid } = await params

    const service = createGroupBookingService()
    const result = await service.removeParticipant({
      groupBookingId: id,
      participantId: pid,
      userId: session.user.id,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapGroupBookingErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value)
  } catch (err: unknown) {
    if (err instanceof Response) {
      return err
    }

    logger.error("Failed to remove participant", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Failed to remove participant" },
      { status: 500 }
    )
  }
}
