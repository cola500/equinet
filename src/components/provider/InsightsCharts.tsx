"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Info } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts"

// --- Types ---

interface ServiceBreakdownItem {
  serviceName: string
  count: number
  revenue: number
}

interface TimeHeatmapItem {
  day: string
  dayIndex: number
  hour: number
  count: number
}

interface RetentionMonth {
  month: string
  newCustomers: number
  returningCustomers: number
}

interface KPIs {
  cancellationRate: number
  noShowRate: number
  averageBookingValue: number
  uniqueCustomers: number
  manualBookingRate: number
}

interface InsightsChartsProps {
  serviceBreakdown: ServiceBreakdownItem[]
  timeHeatmap: TimeHeatmapItem[]
  customerRetention: RetentionMonth[]
  kpis: KPIs
  isLoading: boolean
}

// --- Info Popover ---

function InfoPopover({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Mer information"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="text-sm text-gray-600 max-w-[280px]">
        {text}
      </PopoverContent>
    </Popover>
  )
}

// --- KPI Cards ---

function KPICard({ label, value, unit, color, className, info }: { label: string; value: number | string; unit?: string; color?: string; className?: string; info?: string }) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-1">
          <p className="text-sm text-gray-500">{label}</p>
          {info && <InfoPopover text={info} />}
        </div>
        <p className={`text-2xl font-bold ${color || "text-gray-900"}`}>
          {value}{unit}
        </p>
      </CardContent>
    </Card>
  )
}

// --- Heatmap ---

const DAY_ORDER = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"]
const DAY_INDEX_MAP: Record<string, number> = { "Sön": 0, "Mån": 1, "Tis": 2, "Ons": 3, "Tor": 4, "Fre": 5, "Lör": 6 }

function getHeatColor(count: number, max: number): string {
  if (count === 0) return "bg-gray-100"
  const ratio = count / max
  if (ratio > 0.75) return "bg-green-600 text-white"
  if (ratio > 0.5) return "bg-green-400 text-white"
  if (ratio > 0.25) return "bg-green-300"
  return "bg-green-100"
}

function TimeHeatmapGrid({ data }: { data: TimeHeatmapItem[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        Inte tillräckligt med data för att visa tidsanalys.
      </p>
    )
  }

  // Find hour range
  const hours = data.map((d) => d.hour)
  const minHour = Math.min(...hours)
  const maxHour = Math.max(...hours)
  const hourRange = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i)

  // Build lookup
  const lookup = new Map<string, number>()
  let maxCount = 1
  for (const item of data) {
    const dayLabel = item.day
    const key = `${dayLabel}-${item.hour}`
    lookup.set(key, item.count)
    if (item.count > maxCount) maxCount = item.count
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px]">
        {/* Header row */}
        <div className="grid gap-0.5 sm:gap-1" style={{ gridTemplateColumns: `40px repeat(${hourRange.length}, 1fr)` }}>
          <div />
          {hourRange.map((h) => (
            <div key={h} className="text-[10px] sm:text-xs text-gray-500 text-center">
              {String(h).padStart(2, "0")}
            </div>
          ))}
        </div>

        {/* Day rows */}
        {DAY_ORDER.map((day) => (
          <div
            key={day}
            className="grid gap-0.5 sm:gap-1 mt-1"
            style={{ gridTemplateColumns: `40px repeat(${hourRange.length}, 1fr)` }}
          >
            <div className="text-[10px] sm:text-xs text-gray-600 flex items-center">{day}</div>
            {hourRange.map((h) => {
              const count = lookup.get(`${day}-${h}`) || 0
              return (
                <div
                  key={h}
                  className={`h-7 rounded text-xs flex items-center justify-center ${getHeatColor(count, maxCount)}`}
                  title={`${day} ${String(h).padStart(2, "0")}:00 - ${count} bokningar`}
                >
                  {count > 0 ? count : ""}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Main component ---

export function InsightsCharts({
  serviceBreakdown,
  timeHeatmap,
  customerRetention,
  kpis,
  isLoading,
}: InsightsChartsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} data-testid="kpi-skeleton">
              <CardContent className="pt-6">
                <div className="h-12 bg-gray-100 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} data-testid="chart-skeleton">
              <CardContent className="py-8">
                <div className="h-48 bg-gray-100 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Transform heatmap dayIndex -> Swedish day names
  const heatmapWithLabels = timeHeatmap.map((item) => {
    // dayIndex from API: 0=Sunday, 1=Monday...6=Saturday
    const dayFromIndex = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"]
    return { ...item, day: dayFromIndex[item.dayIndex] ?? item.day }
  })

  const BAR_COLORS = ["#16a34a", "#22c55e", "#4ade80", "#86efac", "#bbf7d0"]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <KPICard label="Avbokningsgrad" value={kpis.cancellationRate} unit="%" color={kpis.cancellationRate > 20 ? "text-red-600" : undefined} info="Andel bokningar som avbokades av totalt antal bokningar i perioden." />
        <KPICard label="No-show-grad" value={kpis.noShowRate} unit="%" color={kpis.noShowRate > 10 ? "text-amber-600" : undefined} info="Andel bekräftade bokningar där kunden inte dök upp." />
        <KPICard label="Snittbokningsvärde" value={`${kpis.averageBookingValue.toLocaleString("sv-SE")} kr`} info="Genomsnittligt pris per genomförd bokning i perioden." />
        <KPICard label="Unika kunder" value={kpis.uniqueCustomers} info="Antal kunder med minst en bokning i perioden." />
        <KPICard label="Manuella bokningar" value={kpis.manualBookingRate} unit="%" className="col-span-2 sm:col-span-1" info="Andel bokningar skapade manuellt av dig, jämfört med kundens självbokning." />
      </div>

      {/* Charts grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Service breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">Populäraste tjänster</CardTitle>
              <InfoPopover text="Baserat på genomförda bokningar. Visar antal och intäkt per tjänst." />
            </div>
            <CardDescription>Genomförda bokningar och intäkt per tjänst</CardDescription>
          </CardHeader>
          <CardContent>
            {serviceBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Inga genomförda bokningar i perioden.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, serviceBreakdown.length * 50)}>
                <BarChart data={serviceBreakdown} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="serviceName"
                    tick={{ fontSize: 11 }}
                    width={100}
                    tickFormatter={(value: string) => value.length > 15 ? `${value.slice(0, 15)}...` : value}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "revenue") return [`${Number(value).toLocaleString("sv-SE")} kr`, "Intäkt"]
                      return [value, "Antal"]
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" name="Antal" fill="#16a34a" radius={[0, 4, 4, 0]}>
                    {serviceBreakdown.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Time heatmap */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">Populäraste tider</CardTitle>
              <InfoPopover text="Visar alla bokningar (inte bara genomförda). Mörkare färg = fler bokningar." />
            </div>
            <CardDescription>Antal bokningar per dag och timme</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeHeatmapGrid data={heatmapWithLabels} />
          </CardContent>
        </Card>

        {/* Customer retention */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">Kundretention</CardTitle>
              <InfoPopover text="Ny kund = första bokningen någonsin. Återkommande = hade en bokning innan perioden." />
            </div>
            <CardDescription>Nya vs återkommande kunder per månad</CardDescription>
          </CardHeader>
          <CardContent>
            {customerRetention.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Inte tillräckligt med data för att visa kundretention.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={customerRetention}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="newCustomers"
                    stroke="#3b82f6"
                    name="Nya kunder"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="returningCustomers"
                    stroke="#16a34a"
                    name="Återkommande"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
