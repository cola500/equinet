"use client"

import { format, startOfWeek, endOfWeek, getWeek } from "date-fns"
import { sv } from "date-fns/locale"
import { Button } from "@/components/ui/button"

interface CalendarHeaderProps {
  currentDate: Date
  onPreviousWeek: () => void
  onNextWeek: () => void
  onToday: () => void
}

export function CalendarHeader({
  currentDate,
  onPreviousWeek,
  onNextWeek,
  onToday,
}: CalendarHeaderProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekNumber = getWeek(currentDate, { weekStartsOn: 1 })

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">
          Vecka {weekNumber}
        </h2>
        <span className="text-gray-600">
          {format(weekStart, "d MMM", { locale: sv })} -{" "}
          {format(weekEnd, "d MMM yyyy", { locale: sv })}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPreviousWeek}>
          Föregående
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          Idag
        </Button>
        <Button variant="outline" size="sm" onClick={onNextWeek}>
          Nästa
        </Button>
      </div>
    </div>
  )
}
