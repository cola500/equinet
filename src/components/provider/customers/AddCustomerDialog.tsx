"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"
import { Loader2 } from "lucide-react"

interface AddCustomerDialogProps {
  open: boolean
  isAdding: boolean
  onAdd: (form: { firstName: string; lastName: string; phone: string; email: string }) => void
  onClose: () => void
}

export function AddCustomerDialog({
  open,
  isAdding,
  onAdd,
  onClose,
}: AddCustomerDialogProps) {
  const [addForm, setAddForm] = useState({ firstName: "", lastName: "", phone: "", email: "" })

  const handleClose = () => {
    setAddForm({ firstName: "", lastName: "", phone: "", email: "" })
    onClose()
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Lägg till kund</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Lägg till en kund manuellt i ditt kundregister.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">Förnamn *</Label>
              <Input
                id="firstName"
                value={addForm.firstName}
                onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="Anna"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="lastName">Efternamn</Label>
              <Input
                id="lastName"
                value={addForm.lastName}
                onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Svensson"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              type="tel"
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="070-123 45 67"
            />
          </div>
          <div>
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="anna@example.com"
            />
          </div>
        </div>

        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Avbryt
          </Button>
          <Button
            onClick={() => onAdd(addForm)}
            disabled={!addForm.firstName.trim() || isAdding}
          >
            {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Lägg till
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
