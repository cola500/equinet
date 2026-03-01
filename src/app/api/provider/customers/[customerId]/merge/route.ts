import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { logger } from "@/lib/logger"
import { z } from "zod"

const mergeSchema = z.object({
  targetEmail: z.string().email("Ogiltig e-postadress"),
}).strict()

type RouteContext = { params: Promise<{ customerId: string }> }

// POST /api/provider/customers/[customerId]/merge
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Åtkomst nekad" },
        { status: 403 }
      )
    }

    if (!(await isFeatureEnabled("customer_invite"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen om en minut." },
        { status: 429 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const parsed = mergeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { customerId } = await context.params
    const providerId = session.user.providerId
    const { targetEmail } = parsed.data

    // IDOR-check: ghost must be in provider's register
    const link = await prisma.providerCustomer.findUnique({
      where: {
        providerId_customerId: { providerId, customerId },
      },
    })

    if (!link) {
      return NextResponse.json(
        { error: "Kunden finns inte i ditt kundregister" },
        { status: 404 }
      )
    }

    // Verify ghost user
    const ghostUser = await prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, email: true, isManualCustomer: true },
    })

    if (!ghostUser || !ghostUser.isManualCustomer) {
      return NextResponse.json(
        { error: "Kunden är inte en manuellt tillagd kund" },
        { status: 409 }
      )
    }

    // Find target real user
    const realUser = await prisma.user.findFirst({
      where: { email: targetEmail, isManualCustomer: false },
      select: { id: true, email: true, isManualCustomer: true },
    })

    if (!realUser) {
      return NextResponse.json(
        { error: "Ingen användare hittades med den e-postadressen" },
        { status: 404 }
      )
    }

    if (ghostUser.id === realUser.id) {
      return NextResponse.json(
        { error: "Kan inte slå ihop en användare med sig själv" },
        { status: 400 }
      )
    }

    // Execute atomic merge transaction
    await prisma.$transaction(async (tx) => {
      // 1. Redirect bookings
      await tx.booking.updateMany({
        where: { customerId },
        data: { customerId: realUser.id },
      })

      // 2. Redirect booking series
      await tx.bookingSeries.updateMany({
        where: { customerId },
        data: { customerId: realUser.id },
      })

      // 3. Redirect reviews
      await tx.review.updateMany({
        where: { customerId },
        data: { customerId: realUser.id },
      })

      // 4. Redirect customer reviews
      await tx.customerReview.updateMany({
        where: { customerId },
        data: { customerId: realUser.id },
      })

      // 5. Redirect horses
      await tx.horse.updateMany({
        where: { ownerId: customerId },
        data: { ownerId: realUser.id },
      })

      // 6. Handle ProviderCustomer (unique constraint)
      const existingLink = await tx.providerCustomer.findUnique({
        where: {
          providerId_customerId: { providerId, customerId: realUser.id },
        },
      })
      // Delete ghost's link (real user may already be linked)
      await tx.providerCustomer.deleteMany({
        where: { customerId },
      })
      // If real user wasn't linked to this provider, create the link
      if (!existingLink) {
        await tx.providerCustomer.create({
          data: { providerId, customerId: realUser.id },
        })
      }

      // 7. Handle Follow (unique constraint)
      const ghostFollows = await tx.follow.findMany({
        where: { customerId },
      })
      for (const follow of ghostFollows) {
        const existingFollow = await tx.follow.findUnique({
          where: {
            customerId_providerId: {
              customerId: realUser.id,
              providerId: follow.providerId,
            },
          },
        })
        if (!existingFollow) {
          await tx.follow.update({
            where: { id: follow.id },
            data: { customerId: realUser.id },
          })
        } else {
          await tx.follow.delete({ where: { id: follow.id } })
        }
      }

      // 8. Delete ghost's notification deliveries
      await tx.notificationDelivery.deleteMany({
        where: { customerId },
      })

      // 9. Delete ghost's municipality watches
      await tx.municipalityWatch.deleteMany({
        where: { customerId },
      })

      // 10. Redirect provider customer notes
      await tx.providerCustomerNote.updateMany({
        where: { customerId },
        data: { customerId: realUser.id },
      })

      // 11. Delete ghost user (cascades: tokens, push subscriptions)
      await tx.user.delete({ where: { id: customerId } })
    })

    logger.security("Ghost user merged", "medium", {
      ghostUserId: customerId,
      mergedIntoUserId: realUser.id,
      requestedByProviderId: providerId,
    })

    return NextResponse.json({
      message: "Kunden har slagits ihop med det riktiga kontot",
      mergedInto: realUser.id,
    })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to merge ghost user",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte slå ihop kunden" },
      { status: 500 }
    )
  }
}
