import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

config({ path: ".env.local", override: false })
config({ path: ".env", override: false })

const prisma = new PrismaClient()

async function main() {
  // Simulate exactly what cleanup does
  const providers = await prisma.provider.findMany({
    where: { userId: { in: ["d28ae954-b347-4366-abc5-66c7ccb4259a"] } },
    select: { id: true },
  })
  console.log("providers ok:", providers.length)

  const bookings = await prisma.booking.findMany({
    where: { providerId: { in: ["nonexistent"] } },
    select: { id: true },
  })
  console.log("bookings ok:", bookings.length)

  console.log("prisma.review type:", typeof (prisma as any).review)
  const reviews = await prisma.review.deleteMany({ where: { providerId: { in: ["nonexistent"] } } })
  console.log("review deleteMany ok:", reviews.count)
}

main().catch(console.error).finally(() => prisma.$disconnect())
