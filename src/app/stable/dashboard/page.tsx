"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { clientLogger } from "@/lib/client-logger"

interface SpotCounts {
  total: number
  available: number
}

interface Invite {
  usedAt: string | null
  expiresAt: string
}

interface InviteCounts {
  pending: number
  accepted: number
}

function countInviteStatuses(invites: Invite[]): InviteCounts {
  let pending = 0
  let accepted = 0
  const now = new Date()
  for (const inv of invites) {
    if (inv.usedAt) {
      accepted++
    } else if (new Date(inv.expiresAt) >= now) {
      pending++
    }
  }
  return { pending, accepted }
}

export default function StableDashboardPage() {
  const { isStableOwner } = useAuth()
  const [spotCounts, setSpotCounts] = useState<SpotCounts | null>(null)
  const [inviteCounts, setInviteCounts] = useState<InviteCounts | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    if (!isStableOwner) return

    async function fetchData() {
      try {
        const [spotsRes, invitesRes] = await Promise.all([
          fetch("/api/stable/spots"),
          fetch("/api/stable/invites"),
        ])
        if (spotsRes.ok) {
          const data = await spotsRes.json()
          setSpotCounts(data._count)
        }
        if (invitesRes.ok) {
          const invites: Invite[] = await invitesRes.json()
          setInviteCounts(countInviteStatuses(invites))
        }
      } catch (err) {
        clientLogger.error("Failed to fetch dashboard data", err)
      } finally {
        setIsLoadingData(false)
      }
    }

    fetchData()
  }, [isStableOwner])

  if (!isStableOwner) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Skapa din stallprofil</h1>
        <p className="text-gray-600 mb-6">
          Har du ett stall? Skapa en profil för att publicera lediga stallplatser
          och bjuda in dina inackorderingar till Equinet.
        </p>
        <Link href="/stable/profile">
          <Button>Skapa stallprofil</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Stallöversikt</h1>
      <nav aria-label="Stallöversikt">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/stable/spots"
            className="p-6 bg-white rounded-lg border hover:border-primary transition-colors"
          >
            <h2 className="font-semibold mb-1">Stallplatser</h2>
            <p className="text-sm text-gray-500">
              {isLoadingData
                ? <span className="inline-block h-4 w-24 bg-gray-200 animate-pulse rounded" />
                : spotCounts
                  ? `${spotCounts.available} av ${spotCounts.total} lediga`
                  : "Hantera dina stallplatser"}
            </p>
          </Link>
          <Link
            href="/stable/invites"
            className="p-6 bg-white rounded-lg border hover:border-primary transition-colors"
          >
            <h2 className="font-semibold mb-1">Inbjudningar</h2>
            <p className="text-sm text-gray-500">
              {isLoadingData
                ? <span className="inline-block h-4 w-32 bg-gray-200 animate-pulse rounded" />
                : inviteCounts
                  ? `${inviteCounts.pending} väntande, ${inviteCounts.accepted} accepterade`
                  : "Bjud in hästägare"}
            </p>
          </Link>
          <Link
            href="/stable/profile"
            className="p-6 bg-white rounded-lg border hover:border-primary transition-colors"
          >
            <h2 className="font-semibold mb-1">Stallprofil</h2>
            <p className="text-sm text-gray-500">Redigera stallprofil</p>
          </Link>
        </div>
      </nav>
    </div>
  )
}
