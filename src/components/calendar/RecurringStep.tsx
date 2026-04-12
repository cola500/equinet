"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface RecurringStepProps {
  isOnline: boolean
  isRecurring: boolean
  onIsRecurringChange: (value: boolean) => void
  intervalWeeks: number
  onIntervalWeeksChange: (weeks: number) => void
  totalOccurrences: number
  onTotalOccurrencesChange: (count: number) => void
}

export function RecurringStep({
  isOnline,
  isRecurring,
  onIsRecurringChange,
  intervalWeeks,
  onIntervalWeeksChange,
  totalOccurrences,
  onTotalOccurrencesChange,
}: RecurringStepProps) {
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="manual-recurring" className="text-sm font-medium">
            Gör detta återkommande
          </Label>
          <p className="text-xs text-gray-500">
            Skapa flera bokningar med regelbundna intervall
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Switch
            id="manual-recurring"
            checked={isRecurring}
            onCheckedChange={onIsRecurringChange}
            disabled={!isOnline}
          />
          {!isOnline && (
            <span className="text-xs text-gray-500">Kräver internetanslutning</span>
          )}
        </div>
      </div>

      {isRecurring && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Intervall</Label>
            <select
              value={intervalWeeks}
              onChange={(e) => onIntervalWeeksChange(parseInt(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mt-1"
            >
              <option value={1}>Varje vecka</option>
              <option value={2}>Varannan vecka</option>
              <option value={4}>Var 4:e vecka</option>
              <option value={6}>Var 6:e vecka</option>
              <option value={8}>Var 8:e vecka</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Antal tillfällen</Label>
            <select
              value={totalOccurrences}
              onChange={(e) => onTotalOccurrencesChange(parseInt(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mt-1"
            >
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={6}>6</option>
              <option value={8}>8</option>
              <option value={12}>12</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
