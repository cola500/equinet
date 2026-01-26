"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Availability {
  dayOfWeek: number  // 0=Måndag, 6=Söndag
  startTime: string  // "09:00"
  endTime: string    // "17:00"
  isClosed: boolean
}

interface ProviderHoursProps {
  availability: Availability[]
}

const DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"]

function getTodayDayOfWeek(): number {
  // JavaScript: 0=Söndag, 1=Måndag, etc.
  // Vi använder: 0=Måndag, 6=Söndag
  const jsDay = new Date().getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

export function ProviderHours({ availability }: ProviderHoursProps) {
  const todayIndex = getTodayDayOfWeek()

  // Skapa en map för snabb lookup
  const availabilityMap = new Map<number, Availability>()
  availability.forEach(a => availabilityMap.set(a.dayOfWeek, a))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Öppettider</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {DAYS.map((dayName, index) => {
            const dayAvailability = availabilityMap.get(index)
            const isToday = index === todayIndex
            const isClosed = !dayAvailability || dayAvailability.isClosed

            return (
              <div
                key={index}
                className={`flex justify-between text-sm ${
                  isToday ? "font-semibold" : ""
                }`}
              >
                <span className={isToday ? "text-green-700" : "text-gray-700"}>
                  {dayName}
                  {isToday && " (idag)"}
                </span>
                {isClosed ? (
                  <span className="text-gray-400">Stängt</span>
                ) : (
                  <span className={isToday ? "text-green-700" : "text-gray-900"}>
                    {dayAvailability.startTime} - {dayAvailability.endTime}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
