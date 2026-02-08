"use client"

import * as React from "react"
import { useIsMobile } from "@/hooks/useMediaQuery"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

interface ResponsiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  )
}

interface ResponsiveDialogContentProps {
  children: React.ReactNode
  className?: string
}

function ResponsiveDialogContent({ children, className }: ResponsiveDialogContentProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <DrawerContent className={className}>
        <div className="overflow-y-auto max-h-[85vh] px-4 pb-4">
          {children}
        </div>
      </DrawerContent>
    )
  }

  return (
    <DialogContent className={className}>
      {children}
    </DialogContent>
  )
}

function ResponsiveDialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerHeader className={className}>{children}</DrawerHeader>
  }
  return <DialogHeader className={className}>{children}</DialogHeader>
}

function ResponsiveDialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>
  }
  return <DialogTitle className={className}>{children}</DialogTitle>
}

function ResponsiveDialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerDescription className={className}>{children}</DrawerDescription>
  }
  return <DialogDescription className={className}>{children}</DialogDescription>
}

function ResponsiveDialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerFooter className={className}>{children}</DrawerFooter>
  }
  return <DialogFooter className={className}>{children}</DialogFooter>
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
}
