import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface NotificationSkeletonProps {
  count?: number
}

function NotificationSkeletonItem() {
  return (
    <Card>
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-3">
          <Skeleton className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function NotificationSkeleton({ count = 5 }: NotificationSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <NotificationSkeletonItem key={i} />
      ))}
    </div>
  )
}
