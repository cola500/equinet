"use client"

import { useEffect, useState, useCallback } from "react"
import { useDialogState } from "@/hooks/useDialogState"
import { useAuth } from "@/hooks/useAuth"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { OfflineErrorState } from "@/components/ui/OfflineErrorState"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { CustomerListSkeleton } from "@/components/loading/CustomerListSkeleton"
import { toast } from "sonner"
import { useFeatureFlags } from "@/components/providers/FeatureFlagProvider"
import { Search, UserPlus, Users } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { CustomerCard } from "@/components/provider/customers/CustomerCard"
import { AddCustomerDialog } from "@/components/provider/customers/AddCustomerDialog"
import { AddEditHorseDialog } from "@/components/provider/customers/AddEditHorseDialog"
import { DeleteConfirmDialogs } from "@/components/provider/customers/DeleteConfirmDialogs"
import type { Customer, CustomerHorse, CustomerNote, HorseFormData } from "@/components/provider/customers/types"
import { emptyHorseForm } from "@/components/provider/customers/types"

type StatusFilter = "all" | "active" | "inactive"

export default function ProviderCustomersPage() {
  const { isLoading: authLoading, isProvider } = useAuth()
  const isOnline = useOnlineStatus()
  const flags = useFeatureFlags()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

  // Notes state
  const [customerNotes, setCustomerNotes] = useState<Map<string, CustomerNote[]>>(new Map())
  const [notesLoading, setNotesLoading] = useState<string | null>(null)
  const [noteToDelete, setNoteToDelete] = useState<CustomerNote | null>(null)
  const [isDeletingNote, setIsDeletingNote] = useState(false)

  // Add customer dialog
  const addCustomerDialog = useDialogState()
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)

  // Delete customer
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false)

  // Horse state
  const [customerHorses, setCustomerHorses] = useState<Map<string, CustomerHorse[]>>(new Map())
  const [horsesLoading, setHorsesLoading] = useState<string | null>(null)
  const [showHorseDialog, setShowHorseDialog] = useState<string | null>(null)
  const [horseToEdit, setHorseToEdit] = useState<CustomerHorse | null>(null)
  const [horseToDelete, setHorseToDelete] = useState<{ horse: CustomerHorse; customerId: string } | null>(null)
  const [isDeletingHorse, setIsDeletingHorse] = useState(false)
  const [isSavingHorse, setIsSavingHorse] = useState(false)

  useEffect(() => {
    if (isProvider) {
      fetchCustomers()
    }
  }, [isProvider, statusFilter, searchQuery])

  const fetchCustomers = async () => {
    setIsLoading(true)
    setFetchError(false)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (searchQuery.trim()) params.set("q", searchQuery.trim())

      const response = await fetch(`/api/provider/customers?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers)
      } else {
        setFetchError(true)
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error)
      setFetchError(true)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNotes = useCallback(async (customerId: string) => {
    // Skip if already loaded
    if (customerNotes.has(customerId)) return

    setNotesLoading(customerId)
    try {
      const response = await fetch(`/api/provider/customers/${customerId}/notes`)
      if (response.ok) {
        const data = await response.json()
        setCustomerNotes((prev) => new Map(prev).set(customerId, data.notes))
      }
    } catch (error) {
      console.error("Failed to fetch notes:", error)
    } finally {
      setNotesLoading(null)
    }
  }, [customerNotes])

  const fetchHorses = useCallback(async (customerId: string) => {
    if (customerHorses.has(customerId)) return

    setHorsesLoading(customerId)
    try {
      const response = await fetch(`/api/provider/customers/${customerId}/horses`)
      if (response.ok) {
        const data = await response.json()
        setCustomerHorses((prev) => new Map(prev).set(customerId, data.horses))
      }
    } catch (error) {
      console.error("Failed to fetch horses:", error)
    } finally {
      setHorsesLoading(null)
    }
  }, [customerHorses])

  const toggleExpand = (customerId: string) => {
    const newExpanded = expandedCustomer === customerId ? null : customerId
    setExpandedCustomer(newExpanded)

    // Lazy-load notes and horses when expanding
    if (newExpanded) {
      fetchNotes(newExpanded)
      fetchHorses(newExpanded)
    }
  }

  const handleAddNote = async (customerId: string, content: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/provider/customers/${customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (response.ok) {
        const note = await response.json()
        setCustomerNotes((prev) => {
          const updated = new Map(prev)
          const existing = updated.get(customerId) || []
          updated.set(customerId, [note, ...existing])
          return updated
        })
        return true
      }
      return false
    } catch (error) {
      console.error("Failed to create note:", error)
      return false
    }
  }

  const handleEditNote = async (note: CustomerNote, content: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/provider/customers/${note.customerId}/notes/${note.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      )

      if (response.ok) {
        const updatedNote = await response.json()
        setCustomerNotes((prev) => {
          const updated = new Map(prev)
          const existing = updated.get(note.customerId) || []
          updated.set(
            note.customerId,
            existing.map((n) => (n.id === note.id ? updatedNote : n))
          )
          return updated
        })
        return true
      }
      return false
    } catch (error) {
      console.error("Failed to update note:", error)
      return false
    }
  }

  const handleDeleteNote = async (note: CustomerNote) => {
    setIsDeletingNote(true)
    try {
      const response = await fetch(
        `/api/provider/customers/${note.customerId}/notes/${note.id}`,
        { method: "DELETE" }
      )

      if (response.ok || response.status === 204) {
        setCustomerNotes((prev) => {
          const updated = new Map(prev)
          const existing = updated.get(note.customerId) || []
          updated.set(
            note.customerId,
            existing.filter((n) => n.id !== note.id)
          )
          return updated
        })
      }
    } catch (error) {
      console.error("Failed to delete note:", error)
    } finally {
      setIsDeletingNote(false)
      setNoteToDelete(null)
    }
  }

  const handleAddCustomer = async (form: { firstName: string; lastName: string; phone: string; email: string }) => {
    if (!form.firstName.trim() || isAddingCustomer) return

    setIsAddingCustomer(true)
    try {
      const body: Record<string, string> = { firstName: form.firstName.trim() }
      if (form.lastName.trim()) body.lastName = form.lastName.trim()
      if (form.phone.trim()) body.phone = form.phone.trim()
      if (form.email.trim()) body.email = form.email.trim()

      const response = await fetch("/api/provider/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        addCustomerDialog.close()
        toast.success(`${body.firstName} har lagts till i kundregistret`)
        fetchCustomers()
      } else {
        const data = await response.json()
        toast.error(data.error || "Kunde inte lägga till kund")
      }
    } catch (error) {
      console.error("Failed to add customer:", error)
      toast.error("Kunde inte lägga till kund")
    } finally {
      setIsAddingCustomer(false)
    }
  }

  const handleDeleteCustomer = async (customer: Customer) => {
    setIsDeletingCustomer(true)
    try {
      const response = await fetch(`/api/provider/customers/${customer.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success(`${customer.firstName} ${customer.lastName} har tagits bort`)
        // Clear expanded state and notes
        if (expandedCustomer === customer.id) {
          setExpandedCustomer(null)
        }
        setCustomerNotes((prev) => {
          const updated = new Map(prev)
          updated.delete(customer.id)
          return updated
        })
        fetchCustomers()
      } else {
        const data = await response.json()
        toast.error(data.error || "Kunde inte ta bort kund")
      }
    } catch (error) {
      console.error("Failed to delete customer:", error)
      toast.error("Kunde inte ta bort kund")
    } finally {
      setIsDeletingCustomer(false)
      setCustomerToDelete(null)
    }
  }

  const handleSaveHorse = async (customerId: string, form: HorseFormData, isEdit: boolean, horseId?: string) => {
    if (!form.name.trim() || isSavingHorse) return

    setIsSavingHorse(true)
    try {
      const body: Record<string, unknown> = { name: form.name.trim() }
      if (form.breed.trim()) body.breed = form.breed.trim()
      if (form.birthYear.trim()) body.birthYear = parseInt(form.birthYear, 10)
      if (form.color.trim()) body.color = form.color.trim()
      if (form.gender) body.gender = form.gender
      if (form.specialNeeds.trim()) body.specialNeeds = form.specialNeeds.trim()
      if (form.registrationNumber.trim()) body.registrationNumber = form.registrationNumber.trim()
      if (form.microchipNumber.trim()) body.microchipNumber = form.microchipNumber.trim()

      const url = isEdit
        ? `/api/provider/customers/${customerId}/horses/${horseId}`
        : `/api/provider/customers/${customerId}/horses`

      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const savedHorse = await response.json()
        setCustomerHorses((prev) => {
          const updated = new Map(prev)
          const existing = updated.get(customerId) || []
          if (isEdit) {
            updated.set(customerId, existing.map((h) => (h.id === savedHorse.id ? savedHorse : h)))
          } else {
            updated.set(customerId, [...existing, savedHorse])
          }
          return updated
        })
        setShowHorseDialog(null)
        setHorseToEdit(null)
        toast.success(isEdit ? "Hästen har uppdaterats" : "Hästen har lagts till")
      } else {
        const data = await response.json()
        toast.error(data.error || "Kunde inte spara häst")
      }
    } catch (error) {
      console.error("Failed to save horse:", error)
      toast.error("Kunde inte spara häst")
    } finally {
      setIsSavingHorse(false)
    }
  }

  const handleDeleteHorse = async () => {
    if (!horseToDelete || isDeletingHorse) return

    setIsDeletingHorse(true)
    try {
      const response = await fetch(
        `/api/provider/customers/${horseToDelete.customerId}/horses/${horseToDelete.horse.id}`,
        { method: "DELETE" }
      )

      if (response.ok) {
        setCustomerHorses((prev) => {
          const updated = new Map(prev)
          const existing = updated.get(horseToDelete.customerId) || []
          updated.set(
            horseToDelete.customerId,
            existing.filter((h) => h.id !== horseToDelete.horse.id)
          )
          return updated
        })
        toast.success("Hästen har tagits bort")
      } else {
        const data = await response.json()
        toast.error(data.error || "Kunde inte ta bort häst")
      }
    } catch (error) {
      console.error("Failed to delete horse:", error)
      toast.error("Kunde inte ta bort häst")
    } finally {
      setIsDeletingHorse(false)
      setHorseToDelete(null)
    }
  }

  if (authLoading || !isProvider) {
    return (
      <ProviderLayout>
        <CustomerListSkeleton />
      </ProviderLayout>
    )
  }

  return (
    <ProviderLayout>
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Kunder</h1>
            <p className="text-gray-600 mt-1">
              Översikt över dina kunder och deras hästar
            </p>
          </div>
          <Button onClick={() => addCustomerDialog.openDialog()}>
            <UserPlus className="h-4 w-4 mr-2" />
            Lägg till kund
          </Button>
        </div>
      </div>

      {fetchError && !isOnline && (
        <div className="mb-6">
          <OfflineErrorState onRetry={fetchCustomers} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Sök på namn eller email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                statusFilter === status
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {status === "all" ? "Alla" : status === "active" ? "Aktiva" : "Inaktiva"}
            </button>
          ))}
        </div>
      </div>

      {/* Customer list */}
      {isLoading ? (
        <CustomerListSkeleton />
      ) : customers.length === 0 ? (
        searchQuery || statusFilter !== "all" ? (
          <EmptyState
            icon={Search}
            title="Inga träffar"
            description="Inga kunder matchar din sökning. Prova ett annat sökord eller filter."
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Inga kunder ännu"
            description="Kunder visas här när de bokar dina tjänster, eller lägg till dem manuellt."
            action={{ label: "Lägg till din första kund", onClick: () => addCustomerDialog.openDialog() }}
          />
        )
      ) : (
        <div className="space-y-3">
          {customers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              isExpanded={expandedCustomer === customer.id}
              onToggleExpand={() => toggleExpand(customer.id)}
              horses={customerHorses.get(customer.id) || []}
              horsesLoading={horsesLoading === customer.id}
              notes={customerNotes.get(customer.id) || []}
              notesLoading={notesLoading === customer.id}
              flags={flags}
              onAddNote={handleAddNote}
              onEditNote={handleEditNote}
              onDeleteNote={(note) => setNoteToDelete(note)}
              onAddHorse={(customerId) => {
                setShowHorseDialog(customerId)
                setHorseToEdit(null)
              }}
              onEditHorse={(horse, customerId) => {
                setHorseToEdit(horse)
                setShowHorseDialog(customerId)
              }}
              onDeleteHorse={(horse, customerId) => setHorseToDelete({ horse, customerId })}
              onDeleteCustomer={(c) => setCustomerToDelete(c)}
            />
          ))}
        </div>
      )}

      {/* Add customer dialog */}
      <AddCustomerDialog
        open={addCustomerDialog.open}
        isAdding={isAddingCustomer}
        onAdd={handleAddCustomer}
        onClose={() => addCustomerDialog.close()}
      />

      {/* Add/Edit horse dialog */}
      {showHorseDialog && (
        <AddEditHorseDialog
          open={true}
          customerId={showHorseDialog}
          horseToEdit={horseToEdit}
          isSaving={isSavingHorse}
          onSave={handleSaveHorse}
          onClose={() => {
            setShowHorseDialog(null)
            setHorseToEdit(null)
          }}
        />
      )}

      {/* Delete confirmation dialogs */}
      <DeleteConfirmDialogs
        noteToDelete={noteToDelete}
        onDeleteNote={() => noteToDelete && handleDeleteNote(noteToDelete)}
        onCancelNoteDelete={() => setNoteToDelete(null)}
        isDeletingNote={isDeletingNote}
        customerToDelete={customerToDelete}
        onDeleteCustomer={() => customerToDelete && handleDeleteCustomer(customerToDelete)}
        onCancelCustomerDelete={() => setCustomerToDelete(null)}
        isDeletingCustomer={isDeletingCustomer}
        horseToDelete={horseToDelete}
        onDeleteHorse={handleDeleteHorse}
        onCancelHorseDelete={() => setHorseToDelete(null)}
        isDeletingHorse={isDeletingHorse}
      />
    </ProviderLayout>
  )
}
