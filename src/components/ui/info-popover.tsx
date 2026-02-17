import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Info } from "lucide-react"

export function InfoPopover({ text }: { text: string }) {
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
