import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface GenericListSkeletonProps {
  count?: number
  showSearch?: boolean
}

function GenericListSkeletonItem() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
      </CardContent>
    </Card>
  )
}

export function GenericListSkeleton({ count = 4, showSearch = true }: GenericListSkeletonProps) {
  return (
    <div className="space-y-4">
      {showSearch && (
        <Skeleton className="h-10 w-full rounded-md" />
      )}
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <GenericListSkeletonItem key={i} />
        ))}
      </div>
    </div>
  )
}
