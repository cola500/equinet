import { Skeleton } from "@/components/ui/skeleton"

export function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header: date navigation + view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-8 rounded-md" />
        ))}
      </div>

      {/* Time slots grid */}
      <div className="space-y-1">
        {Array.from({ length: 8 }).map((_, row) => (
          <div key={row} className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, col) => (
              <Skeleton key={`${row}-${col}`} className="h-12 rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
