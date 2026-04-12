import Link from "next/link"
import { Button } from "@/components/ui/button"
import { HorseIcon } from "@/components/icons/HorseIcon"
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react"
import type { CustomerHorse } from "./types"

interface CustomerHorsesSectionProps {
  customerId: string
  horses: CustomerHorse[]
  horsesLoading: boolean
  onAddHorse: (customerId: string) => void
  onEditHorse: (horse: CustomerHorse, customerId: string) => void
  onDeleteHorse: (horse: CustomerHorse, customerId: string) => void
}

export function CustomerHorsesSection({
  customerId,
  horses,
  horsesLoading,
  onAddHorse,
  onEditHorse,
  onDeleteHorse,
}: CustomerHorsesSectionProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
          <HorseIcon className="h-3 w-3" />
          Hästar
          {horses.length > 0 && (
            <span className="text-gray-400">
              ({horses.length})
            </span>
          )}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddHorse(customerId)}
          className="h-7 text-xs text-primary hover:text-primary/80"
        >
          <Plus className="h-3 w-3 mr-1" />
          Lägg till häst
        </Button>
      </div>

      {horsesLoading ? (
        <div className="text-center py-3">
          <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
        </div>
      ) : horses.length > 0 ? (
        <div className="space-y-2">
          {horses.map((horse) => (
            <div
              key={horse.id}
              className="flex items-center justify-between bg-white p-2 rounded-md border text-sm"
            >
              <Link
                href={`/provider/horse-timeline/${horse.id}`}
                className="flex items-center gap-2 hover:text-green-700 transition-colors min-w-0 flex-1"
              >
                <HorseIcon className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium">{horse.name}</span>
                  {horse.breed && (
                    <span className="text-gray-400 ml-1">({horse.breed})</span>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onEditHorse(horse, customerId)}
                  className="text-gray-300 hover:text-blue-500 transition-colors min-h-[44px] sm:min-h-0 flex items-center"
                  aria-label="Redigera häst"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDeleteHorse(horse, customerId)}
                  className="text-gray-300 hover:text-red-500 transition-colors min-h-[44px] sm:min-h-0 flex items-center"
                  aria-label="Ta bort häst"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">
          Inga hästar registrerade
        </p>
      )}
    </div>
  )
}
