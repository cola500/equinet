"use client"

import * as React from "react"
import { useIsMobile } from "@/hooks/useMediaQuery"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MobileContext = React.createContext(false)

function useMobileContext() {
  return React.useContext(MobileContext)
}

interface ResponsiveAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function ResponsiveAlertDialog({ open, onOpenChange, children }: ResponsiveAlertDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <MobileContext.Provider value={true}>
        <Drawer open={open} onOpenChange={onOpenChange}>
          {children}
        </Drawer>
      </MobileContext.Provider>
    )
  }

  return (
    <MobileContext.Provider value={false}>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        {children}
      </AlertDialog>
    </MobileContext.Provider>
  )
}

function ResponsiveAlertDialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useMobileContext()

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
    <AlertDialogContent className={className}>
      {children}
    </AlertDialogContent>
  )
}

function ResponsiveAlertDialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useMobileContext()

  if (isMobile) {
    return <DrawerHeader className={className}>{children}</DrawerHeader>
  }
  return <AlertDialogHeader className={className}>{children}</AlertDialogHeader>
}

function ResponsiveAlertDialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useMobileContext()

  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>
  }
  return <AlertDialogTitle className={className}>{children}</AlertDialogTitle>
}

function ResponsiveAlertDialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useMobileContext()

  if (isMobile) {
    return <DrawerDescription className={className}>{children}</DrawerDescription>
  }
  return <AlertDialogDescription className={className}>{children}</AlertDialogDescription>
}

function ResponsiveAlertDialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useMobileContext()

  if (isMobile) {
    return <DrawerFooter className={className}>{children}</DrawerFooter>
  }
  return <AlertDialogFooter className={className}>{children}</AlertDialogFooter>
}

function ResponsiveAlertDialogAction({
  children,
  className,
  onClick,
  ...props
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const isMobile = useMobileContext()

  if (isMobile) {
    return (
      <Button
        className={cn("w-full", className)}
        onClick={onClick}
        {...props}
      >
        {children}
      </Button>
    )
  }

  return (
    <AlertDialogAction className={className} onClick={onClick} {...props}>
      {children}
    </AlertDialogAction>
  )
}

function ResponsiveAlertDialogCancel({
  children,
  className,
  onClick,
  ...props
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const isMobile = useMobileContext()

  if (isMobile) {
    return (
      <Button
        variant="outline"
        className={cn("w-full", className)}
        onClick={onClick}
        {...props}
      >
        {children}
      </Button>
    )
  }

  return (
    <AlertDialogCancel className={className} onClick={onClick} {...props}>
      {children}
    </AlertDialogCancel>
  )
}

export {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
}
