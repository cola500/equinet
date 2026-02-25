import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_OPTIONS, CATEGORY_MAP, type TimelineItem } from "@/app/customer/horses/[id]/types"

interface TimelineSectionProps {
  timeline: TimelineItem[]
  isLoading: boolean
  activeFilter: string | null
  onFilterChange: (filter: string | null) => void
}

export function TimelineSection({ timeline, isLoading, activeFilter, onFilterChange }: TimelineSectionProps) {
  return (
    <>
      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => onFilterChange(null)}
          className={`px-3 py-1 touch-target rounded-full text-sm border transition-colors ${
            activeFilter === null
              ? "bg-green-600 text-white border-green-600"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Alla
        </button>
        {CATEGORY_OPTIONS.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onFilterChange(activeFilter === cat.value ? null : cat.value)}
            className={`px-3 py-1 touch-target rounded-full text-sm border transition-colors ${
              activeFilter === cat.value
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
          <p className="mt-2 text-gray-600">Laddar historik...</p>
        </div>
      ) : timeline.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 mb-2">Ingen historik att visa ännu.</p>
            <p className="text-sm text-gray-500">Anteckningar och genomförda bokningar visas här.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {timeline.map((item) => (
              <TimelineCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function TimelineCard({ item }: { item: TimelineItem }) {
  const date = new Date(item.date)
  const dateStr = date.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  if (item.type === "booking") {
    return (
      <div className="relative pl-10">
        <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-gray-600">{item.providerName}</p>
                {item.notes && <p className="text-sm text-gray-500 mt-1">{item.notes}</p>}
              </div>
              <div className="sm:text-right">
                <p className="text-sm text-gray-500">{dateStr}</p>
                <Badge variant="outline" className="mt-1 bg-green-50 text-green-700 border-green-200">
                  Bokning
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const cat = item.category ? CATEGORY_MAP[item.category] : null
  const dotColors: Record<string, string> = {
    veterinary: "bg-blue-500",
    farrier: "bg-orange-500",
    general: "bg-gray-400",
    injury: "bg-red-500",
    medication: "bg-purple-500",
  }

  return (
    <div className="relative pl-10">
      <div
        className={`absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 border-white ${
          item.category ? dotColors[item.category] || "bg-gray-400" : "bg-gray-400"
        }`}
      />
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">{item.title}</p>
              {item.content && <p className="text-sm text-gray-600 mt-1">{item.content}</p>}
              {item.authorName && <p className="text-xs text-gray-400 mt-1">Av {item.authorName}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-gray-500">{dateStr}</p>
              {cat && (
                <Badge variant="outline" className={`mt-1 ${cat.color}`}>
                  {cat.label}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
