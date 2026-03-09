import { Metadata } from "next"
import { notFound } from "next/navigation"
import { createStableService } from "@/domain/stable/StableServiceFactory"
import { createStableSpotService } from "@/domain/stable/StableSpotServiceFactory"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { StableProfileView } from "./StableProfileView"

type PageProps = {
  params: Promise<{ stableId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { stableId } = await params

  if (!(await isFeatureEnabled("stable_profiles"))) {
    return { title: "Stall | Equinet" }
  }

  const service = createStableService()
  const stable = await service.getPublicById(stableId)

  if (!stable) {
    return { title: "Stall hittades inte | Equinet" }
  }

  const description = stable.description
    ? stable.description.slice(0, 160)
    : `${stable.name} - stall${stable.municipality ? ` i ${stable.municipality}` : ""}. ${stable._count.availableSpots} lediga stallplatser.`

  return {
    title: `${stable.name} | Equinet`,
    description,
    openGraph: {
      title: stable.name,
      description,
      type: "website",
    },
  }
}

export default async function StableProfilePage({ params }: PageProps) {
  const { stableId } = await params

  if (!(await isFeatureEnabled("stable_profiles"))) {
    notFound()
  }

  const service = createStableService()
  const stable = await service.getPublicById(stableId)

  if (!stable) {
    notFound()
  }

  const spotService = createStableSpotService()
  const allSpots = await spotService.getSpots(stableId)
  const availableSpots = allSpots.filter((s) => s.status === "available")

  return <StableProfileView stable={stable} availableSpots={availableSpots} />
}
