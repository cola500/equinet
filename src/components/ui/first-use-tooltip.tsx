"use client"

import { useEffect, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

// --- Exporterade hjälpfunktioner (testbara utan React) ---

export function getStorageKey(id: string): string {
  return `equinet-firstuse-${id}-dismissed`
}

export function isTooltipDismissed(id: string): boolean {
  return localStorage.getItem(getStorageKey(id)) === "true"
}

export function dismissTooltip(id: string): void {
  localStorage.setItem(getStorageKey(id), "true")
}

// --- Komponent ---

interface FirstUseTooltipProps {
  id: string
  title: string
  description: string
  side?: "top" | "bottom" | "left" | "right"
  children: React.ReactNode
}

export function FirstUseTooltip({
  id,
  title,
  description,
  side = "bottom",
  children,
}: FirstUseTooltipProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!isTooltipDismissed(id)) {
      setOpen(true)
    }
  }, [id])

  const handleDismiss = () => {
    dismissTooltip(id)
    setOpen(false)
  }

  if (!mounted || isTooltipDismissed(id)) {
    return <>{children}</>
  }

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleDismiss()
    }}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent side={side} className="w-72">
        <div className="space-y-2">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-sm text-gray-600">{description}</p>
          <Button size="sm" variant="outline" onClick={handleDismiss} className="w-full">
            Uppfattat
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
