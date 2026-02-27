import { useState, useCallback } from "react"

/**
 * Reusable hook for dialog open/close state management.
 * Replaces the common pattern: const [open, setOpen] = useState(false)
 * with stable function references for open, close, and toggle.
 */
export function useDialogState(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen)

  const openDialog = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((prev) => !prev), [])

  return { open, setOpen, openDialog, close, toggle }
}
