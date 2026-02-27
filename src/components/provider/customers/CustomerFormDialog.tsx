"use client"

import { useState, useEffect } from "react"
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
import type { Customer } from "./types"

export interface CustomerFormData {
  firstName: string
  lastName: string
  phone: string
  email: string
}

interface CustomerFormDialogProps {
  open: boolean
  isSaving: boolean
  mode: "add" | "edit"
  customer?: Customer | null
  onSave: (form: CustomerFormData) => void
  onClose: () => void
}

const emptyForm: CustomerFormData = { firstName: "", lastName: "", phone: "", email: "" }

export function CustomerFormDialog({
  open,
  isSaving,
  mode,
  customer,
  onSave,
  onClose,
}: CustomerFormDialogProps) {
  const [form, setForm] = useState<CustomerFormData>(emptyForm)

  // Populate form when opening in edit mode
  useEffect(() => {
    if (open) {
      if (mode === "edit" && customer) {
        setForm({
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone || "",
          email: customer.email,
        })
      } else {
        setForm(emptyForm)
      }
    }
  }, [open, mode, customer])

  const handleClose = () => {
    setForm(emptyForm)
    onClose()
  }

  const isAdd = mode === "add"

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isAdd ? "Lägg till kund" : "Redigera kund"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {isAdd
              ? "Lägg till en kund manuellt i ditt kundregister."
              : "Ändra kundens uppgifter."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">Förnamn *</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="Anna"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="lastName">Efternamn</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Svensson"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="070-123 45 67"
            />
          </div>
          <div>
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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
            onClick={() => onSave(form)}
            disabled={!form.firstName.trim() || isSaving}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isAdd ? "Lägg till" : "Spara"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

// Backwards-compatible alias for existing imports
export { CustomerFormDialog as AddCustomerDialog }
