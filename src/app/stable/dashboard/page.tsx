"use client"

import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function StableDashboardPage() {
  const { isStableOwner } = useAuth()

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/stable/spots"
          className="p-6 bg-white rounded-lg border hover:border-primary transition-colors"
        >
          <h2 className="font-semibold mb-1">Stallplatser</h2>
          <p className="text-sm text-gray-500">Hantera dina stallplatser</p>
        </Link>
        <Link
          href="/stable/invites"
          className="p-6 bg-white rounded-lg border hover:border-primary transition-colors"
        >
          <h2 className="font-semibold mb-1">Inbjudningar</h2>
          <p className="text-sm text-gray-500">Bjud in hästägare</p>
        </Link>
        <Link
          href="/stable/profile"
          className="p-6 bg-white rounded-lg border hover:border-primary transition-colors"
        >
          <h2 className="font-semibold mb-1">Min profil</h2>
          <p className="text-sm text-gray-500">Redigera stallprofil</p>
        </Link>
      </div>
    </div>
  )
}
