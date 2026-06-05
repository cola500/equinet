"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useAuth } from "@/hooks/useAuth"
import { useHorses } from "@/hooks/useHorses"
import { useDueForService } from "@/hooks/useDueForService"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { HorseCardSkeleton } from "@/components/loading/HorseCardSkeleton"
import { HomeStatusLine } from "@/components/customer/HomeStatusLine"
import { HomeHorseCard } from "@/components/customer/HomeHorseCard"
import { CustomerHomeEmpty } from "@/components/customer/CustomerHomeEmpty"
import { getNextBooking, deriveHomeStatus, sortHorsesByDue, type BookingLike } from "@/lib/customer-home"

/**
 * Horse owner's home. Logged-in customers land here (not the public search) so
 * they see how their horses are doing first. Builds only on existing hooks.
 */
export default function CustomerHomePage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isCustomer } = useAuth()
  const { horses, isLoading, mutate } = useHorses()
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

  return (
    <CustomerLayout>
      <h1 className="font-heading text-3xl md:text-4xl mb-6">
        Hej{firstName ? ` ${firstName}` : ""}
      </h1>

      {isLoading ? (
        <HorseCardSkeleton count={2} />
      ) : horses.length === 0 ? (
        <CustomerHomeEmpty onAdded={() => mutate()} />
      ) : (
        <>
          <HomeStatusLine status={homeStatus} />
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Mina hästar
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortHorsesByDue(horses, dueItems).map((horse) => (
              <HomeHorseCard
                key={horse.id}
                horse={horse}
                dueItems={dueItems}
                bookings={bookings}
              />
            ))}
          </div>
        </>
      )}
    </CustomerLayout>
  )
}
