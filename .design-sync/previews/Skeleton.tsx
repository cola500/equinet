import { Skeleton } from "equinet-ui"

export function CardLoading() {
  return (
    <div className="p-4 max-w-sm space-y-3">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  )
}
