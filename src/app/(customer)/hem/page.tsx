"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import useSWR from "swr"
import { useAuth } from "@/hooks/useAuth"
import { useHorses } from "@/hooks/useHorses"
import { useDueForService } from "@/hooks/useDueForService"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { HorseCardSkeleton } from "@/components/loading/HorseCardSkeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HomeStatusLine } from "@/components/customer/HomeStatusLine"
import { getNextBooking, deriveHomeStatus, type BookingLike } from "@/lib/customer-home"

/**
 * Horse owner's home. Logged-in customers land here (not the public search) so
 * they see how their horses are doing first. Builds only on existing hooks.
 */
export default function CustomerHomePage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isCustomer } = useAuth()
  const { horses, isLoading } = useHorses()
  const { items: dueItems } = useDueForService()
  const { data: bookings = [] } = useSWR<BookingLike[]>("/api/bookings")
  const firstName = user?.name?.split(" ")[0] ?? ""
  const homeStatus = deriveHomeStatus(dueItems, getNextBooking(bookings))

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  if (authLoading || !isCustomer) {
    return (
      <CustomerLayout>
        <HorseCardSkeleton count={2} />
      </CustomerLayout>
    )
  }

  const currentYear = new Date().getFullYear()

  return (
    <CustomerLayout>
      <h1 className="font-heading text-3xl md:text-4xl mb-6">
        Hej{firstName ? ` ${firstName}` : ""}
      </h1>

      {isLoading ? (
        <HorseCardSkeleton count={2} />
      ) : (
        <>
          {horses.length > 0 && <HomeStatusLine status={homeStatus} />}
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Mina hästar
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {horses.map((horse) => (
              <Card key={horse.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{horse.name}</CardTitle>
                  <CardDescription>
                    {[
                      horse.breed,
                      horse.birthYear ? `${currentYear - horse.birthYear} år` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Ingen extra info"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/customer/horses/${horse.id}`}>
                    <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0">
                      Visa häst
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </CustomerLayout>
  )
}
