"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBookingFlowContext } from "./BookingFlowContext"

interface HorseSelectorProps {
  idSuffix?: string
}

export function HorseSelector({ idSuffix = "" }: HorseSelectorProps) {
  const { bookingForm, setBookingForm, customerHorses } = useBookingFlowContext()

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`horse-select${idSuffix}`}>Häst</Label>
        {customerHorses.length > 0 ? (
          <>
            <Select
              value={bookingForm.horseId}
              onValueChange={(value) => {
                if (value === "__manual__") {
                  setBookingForm({
                    ...bookingForm,
                    horseId: "",
                    horseName: "",
                    horseInfo: "",
                  })
                } else {
                  const horse = customerHorses.find((h) => h.id === value)
                  setBookingForm({
                    ...bookingForm,
                    horseId: value,
                    horseName: horse?.name || "",
                    horseInfo: horse?.specialNeeds || "",
                  })
                }
              }}
            >
              <SelectTrigger id={`horse-select${idSuffix}`}>
                <SelectValue placeholder="Välj häst..." />
              </SelectTrigger>
              <SelectContent>
                {customerHorses.map((horse) => (
                  <SelectItem key={horse.id} value={horse.id}>
                    {horse.name}
                    {horse.breed && ` (${horse.breed})`}
                  </SelectItem>
                ))}
                <SelectItem value="__manual__">
                  Annan häst (ange manuellt)
                </SelectItem>
              </SelectContent>
            </Select>
            {bookingForm.horseId && bookingForm.horseId !== "__manual__" && bookingForm.horseInfo && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                {bookingForm.horseInfo}
              </p>
            )}
          </>
        ) : (
          <Input
            id={`horseName${idSuffix}`}
            value={bookingForm.horseName}
            onChange={(e) =>
              setBookingForm({ ...bookingForm, horseName: e.target.value })
            }
            placeholder="Hästens namn"
          />
        )}
        {customerHorses.length > 0 && !bookingForm.horseId && (
          <Input
            id={`horseName-manual${idSuffix}`}
            value={bookingForm.horseName}
            onChange={(e) =>
              setBookingForm({ ...bookingForm, horseName: e.target.value })
            }
            placeholder="Hästens namn"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`customerNotes${idSuffix}`}>Övriga kommentarer</Label>
        <Textarea
          id={`customerNotes${idSuffix}`}
          value={bookingForm.customerNotes}
          onChange={(e) =>
            setBookingForm({
              ...bookingForm,
              customerNotes: e.target.value,
            })
          }
          rows={2}
        />
      </div>
    </>
  )
}
