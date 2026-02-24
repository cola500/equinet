"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { useBookingFlowContext } from "./BookingFlowContext"

interface RecurringSectionProps {
  idSuffix?: string
}

export function RecurringSection({ idSuffix = "" }: RecurringSectionProps) {
  const recurringEnabled = useFeatureFlag("recurring_bookings")
  const {
    isRecurring,
    setIsRecurring,
    intervalWeeks,
    setIntervalWeeks,
    totalOccurrences,
    setTotalOccurrences,
  } = useBookingFlowContext()

  if (!recurringEnabled) return null

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor={`recurring-toggle${idSuffix}`} className="text-sm font-medium">
            Gör detta återkommande
          </Label>
          <p className="text-xs text-gray-500">
            Boka samma tid med regelbundna intervall
          </p>
        </div>
        <Switch
          id={`recurring-toggle${idSuffix}`}
          checked={isRecurring}
          onCheckedChange={setIsRecurring}
        />
      </div>

      {isRecurring && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm">Intervall</Label>
            <Select
              value={String(intervalWeeks)}
              onValueChange={(v) => setIntervalWeeks(parseInt(v, 10))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Varje vecka</SelectItem>
                <SelectItem value="2">Varannan vecka</SelectItem>
                <SelectItem value="4">Var 4:e vecka</SelectItem>
                <SelectItem value="6">Var 6:e vecka</SelectItem>
                <SelectItem value="8">Var 8:e vecka</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Antal tillfällen</Label>
            <Select
              value={String(totalOccurrences)}
              onValueChange={(v) => setTotalOccurrences(parseInt(v, 10))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 tillfällen</SelectItem>
                <SelectItem value="4">4 tillfällen</SelectItem>
                <SelectItem value="6">6 tillfällen</SelectItem>
                <SelectItem value="8">8 tillfällen</SelectItem>
                <SelectItem value="12">12 tillfällen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
