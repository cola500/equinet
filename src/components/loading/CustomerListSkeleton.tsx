import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface CustomerListSkeletonProps {
  count?: number
}

function CustomerListSkeletonItem() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CustomerListSkeleton({ count = 5 }: CustomerListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CustomerListSkeletonItem key={i} />
      ))}
    </div>
  )
}
