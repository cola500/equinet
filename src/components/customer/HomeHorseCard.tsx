"use client"

import Link from "next/link"
import Image from "next/image"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DueStatusBadge } from "@/components/customer/DueStatusBadge"
import { getHorseBookings, type BookingLike } from "@/lib/customer-home"
import type { DueForServiceResult } from "@/domain/due-for-service/DueForServiceCalculator"

export interface HomeHorse {
  id: string
  name: string
  breed: string | null
  birthYear: number | null
  photoUrl: string | null
}

function fmt(date: string): string {
  return format(new Date(date), "d MMM", { locale: sv })
}

/** Read-only horse card for /hem: status, last/next visit and an action. */
export function HomeHorseCard({
  horse,
  dueItems,
  bookings,
}: {
  horse: HomeHorse
  dueItems: DueForServiceResult[]
  bookings: BookingLike[]
}) {
  const currentYear = new Date().getFullYear()
  const meta = [horse.breed, horse.birthYear ? `${currentYear - horse.birthYear} år` : null]
    .filter(Boolean)
    .join(" · ")
  const { last, next } = getHorseBookings(bookings, horse.id)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {horse.photoUrl ? (
            <Image
              src={horse.photoUrl}
              alt={horse.name}
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary"
              aria-hidden
            >
              {horse.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{horse.name}</span>
              <DueStatusBadge dueItems={dueItems} horseId={horse.id} />
            </div>
            <p className="text-sm text-gray-600">{meta || "Ingen extra info"}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="mb-4 space-y-1 text-sm border-t pt-3">
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Senast</dt>
            <dd className="text-right">{last ? `${last.service} · ${fmt(last.date)}` : "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Nästa</dt>
            <dd className="text-right">
              {next ? `${next.service} · ${fmt(next.date)}` : <span className="text-gray-400">Inget inbokat</span>}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {!next && (
            <Button asChild variant="outline" size="sm" className="min-h-[44px] sm:min-h-0">
              <Link href="/providers">Boka</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="min-h-[44px] sm:min-h-0">
            <Link href={`/customer/horses/${horse.id}`}>Visa häst</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
