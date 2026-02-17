"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

interface BookingWeek {
  week: string
  completed: number
  cancelled: number
}

interface RevenueMonth {
  month: string
  revenue: number
}

interface DashboardChartsProps {
  bookingTrend: BookingWeek[]
  revenueTrend: RevenueMonth[]
  isLoading: boolean
}

export function DashboardCharts({
  bookingTrend,
  revenueTrend,
  isLoading,
}: DashboardChartsProps) {
  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        <Card data-testid="chart-skeleton">
          <CardContent className="py-8">
            <div className="h-48 bg-gray-100 animate-pulse rounded" />
          </CardContent>
        </Card>
        <Card data-testid="chart-skeleton">
          <CardContent className="py-8">
            <div className="h-48 bg-gray-100 animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Booking trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bokningar per vecka</CardTitle>
          <CardDescription>Genomförda och avbokade, senaste 8 veckorna</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={bookingTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#16a34a"
                name="Genomförda"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="cancelled"
                stroke="#dc2626"
                name="Avbokade"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Intäkter per månad</CardTitle>
          <CardDescription>Totala intäkter, senaste 6 månaderna</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString("sv-SE")} kr`, "Intäkt"]}
              />
              <Bar dataKey="revenue" fill="#16a34a" radius={[4, 4, 0, 0]} name="Intäkt" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
