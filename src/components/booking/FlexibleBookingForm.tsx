"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { format } from "date-fns"
import { useBookingFlowContext } from "./BookingFlowContext"

interface FlexibleBookingFormProps {
  idSuffix?: string
}

export function FlexibleBookingForm({ idSuffix = "" }: FlexibleBookingFormProps) {
  const { flexibleForm, setFlexibleForm } = useBookingFlowContext()

  return (
    <div className="space-y-4" data-testid="flexible-booking-section">
      <div className="space-y-2">
        <Label htmlFor={`dateFrom${idSuffix}`}>Från datum *</Label>
        <Input
          id={`dateFrom${idSuffix}`}
          type="date"
          value={flexibleForm.dateFrom}
          onChange={(e) =>
            setFlexibleForm({ ...flexibleForm, dateFrom: e.target.value })
          }
          min={format(new Date(), "yyyy-MM-dd")}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`dateTo${idSuffix}`}>Till datum *</Label>
        <Input
          id={`dateTo${idSuffix}`}
          type="date"
          value={flexibleForm.dateTo}
          onChange={(e) =>
            setFlexibleForm({ ...flexibleForm, dateTo: e.target.value })
          }
          min={flexibleForm.dateFrom}
          required
        />
        <p className="text-xs text-gray-600">
          Leverantören kan besöka dig när som helst under denna period
        </p>
      </div>
      <div className="space-y-2">
        <Label>Prioritet *</Label>
        <RadioGroup
          value={flexibleForm.priority}
          onValueChange={(value) =>
            setFlexibleForm({ ...flexibleForm, priority: value })
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="normal" id={`priority-normal${idSuffix}`} data-testid="priority-normal" />
            <Label htmlFor={`priority-normal${idSuffix}`} className="font-normal cursor-pointer">
              Normal - Inom den valda perioden
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="urgent" id={`priority-urgent${idSuffix}`} data-testid="priority-urgent" />
            <Label htmlFor={`priority-urgent${idSuffix}`} className="font-normal cursor-pointer">
              Akut - Inom 48 timmar
            </Label>
          </div>
        </RadioGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`numberOfHorses${idSuffix}`}>Antal hästar *</Label>
        <Input
          id={`numberOfHorses${idSuffix}`}
          type="number"
          min="1"
          value={flexibleForm.numberOfHorses}
          onChange={(e) =>
            setFlexibleForm({ ...flexibleForm, numberOfHorses: parseInt(e.target.value) || 1 })
          }
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`contactPhone${idSuffix}`}>Kontakttelefon *</Label>
        <Input
          id={`contactPhone${idSuffix}`}
          type="tel"
          value={flexibleForm.contactPhone}
          onChange={(e) =>
            setFlexibleForm({ ...flexibleForm, contactPhone: e.target.value })
          }
          placeholder="070-123 45 67"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`specialInstructions${idSuffix}`}>Särskilda instruktioner</Label>
        <Textarea
          id={`specialInstructions${idSuffix}`}
          value={flexibleForm.specialInstructions}
          onChange={(e) =>
            setFlexibleForm({ ...flexibleForm, specialInstructions: e.target.value })
          }
          rows={2}
          placeholder="T.ex. portkod, parkering, hästens behov..."
        />
      </div>
    </div>
  )
}
