"use client"

import { format, startOfWeek, endOfWeek, getWeek, addDays } from "date-fns"
import { sv } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, CalendarRange, Grid3X3 } from "lucide-react"

export type ViewMode = "day" | "3-day" | "week" | "month"

interface CalendarHeaderProps {
  currentDate: Date
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  onPrevious?: () => void
  onNext?: () => void
  onToday: () => void
  // Legacy props for backwards compatibility
  onPreviousWeek?: () => void
  onNextWeek?: () => void
}

export function CalendarHeader({
  currentDate,
  viewMode = "week",
  onViewModeChange,
  onPrevious,
  onNext,
  onToday,
  // Legacy props
  onPreviousWeek,
  onNextWeek,
}: CalendarHeaderProps) {
  // Use new props if available, fallback to legacy
  const handlePrevious = onPrevious || onPreviousWeek || (() => {})
  const handleNext = onNext || onNextWeek || (() => {})
  const showViewToggle = !!onViewModeChange
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekNumber = getWeek(currentDate, { weekStartsOn: 1 })

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Vy-toggle och navigation */}
      <div className="flex items-center justify-between">
        {/* Titel */}
        <div className="flex items-center gap-2 md:gap-4">
          {viewMode === "month" ? (
            <h2 className="text-lg md:text-xl font-semibold capitalize">
              {format(currentDate, "MMMM yyyy", { locale: sv })}
            </h2>
          ) : viewMode === "week" ? (
            <>
              <h2 className="text-lg md:text-xl font-semibold">
                Vecka {weekNumber}
              </h2>
              <span className="hidden sm:inline text-gray-600 text-sm">
                {format(weekStart, "d MMM", { locale: sv })} -{" "}
                {format(weekEnd, "d MMM yyyy", { locale: sv })}
              </span>
            </>
          ) : viewMode === "3-day" ? (
            <h2 className="text-lg md:text-xl font-semibold">
              {format(currentDate, "d", { locale: sv })}-{format(addDays(currentDate, 2), "d MMM", { locale: sv })}
            </h2>
          ) : (
            <h2 className="text-lg md:text-xl font-semibold">
              {format(currentDate, "EEEE d MMMM", { locale: sv })}
            </h2>
          )}
        </div>

        {/* Vy-toggle knappar - bara om callback finns */}
        {showViewToggle && (
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1">
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange?.("day")}
              className="h-8 px-2"
              title="Dagvy"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Dag</span>
            </Button>
            <Button
              variant={viewMode === "3-day" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange?.("3-day")}
              className="h-8 px-2"
              title="3-dagarsvy"
            >
              <CalendarRange className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">3 dagar</span>
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange?.("week")}
              className="h-8 px-2"
              title="Veckovy"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Vecka</span>
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange?.("month")}
              className="h-8 px-2"
              title="Månadsvy"
            >
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Månad</span>
            </Button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          className="h-10 px-3"
          aria-label={
            viewMode === "month"
              ? "Föregående månad"
              : viewMode === "week"
                ? "Föregående vecka"
                : viewMode === "3-day"
                  ? "Föregående 3 dagar"
                  : "Föregående dag"
          }
        >
          <ChevronLeft className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Föregående</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="h-10 px-4"
        >
          Idag
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          className="h-10 px-3"
          aria-label={
            viewMode === "month"
              ? "Nästa månad"
              : viewMode === "week"
                ? "Nästa vecka"
                : viewMode === "3-day"
                  ? "Nästa 3 dagar"
                  : "Nästa dag"
          }
        >
          <span className="hidden sm:inline">Nästa</span>
          <ChevronRight className="h-4 w-4 sm:ml-1" />
        </Button>
      </div>
    </div>
  )
}
