"use client"

import { useEffect, useState, useCallback } from "react"
import { useDialogState } from "@/hooks/useDialogState"
import { toast } from "sonner"
import type { Customer, CustomerHorse, CustomerNote, HorseFormData } from "@/components/provider/customers/types"

export type StatusFilter = "all" | "active" | "inactive"

export function useProviderCustomers(isProvider: boolean) {
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

  // Customer form dialog (add + edit)
  const addCustomerDialog = useDialogState()
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null)

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

  const fetchCustomers = useCallback(async () => {
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
  }, [statusFilter, searchQuery])

  /* eslint-disable react-hooks/exhaustive-deps -- fetchCustomers captures statusFilter and searchQuery */
  useEffect(() => {
    if (isProvider) {
      fetchCustomers()
    }
  }, [isProvider, statusFilter, searchQuery])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchNotes = useCallback(async (customerId: string) => {
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

  const handleEditCustomer = async (customerId: string, form: { firstName: string; lastName: string; phone: string; email: string }) => {
    if (!form.firstName.trim() || isAddingCustomer) return

    setIsAddingCustomer(true)
    try {
      const body: Record<string, string> = { firstName: form.firstName.trim() }
      if (form.lastName.trim()) body.lastName = form.lastName.trim()
      if (form.phone.trim()) body.phone = form.phone.trim()
      if (form.email.trim()) body.email = form.email.trim()

      const response = await fetch(`/api/provider/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        addCustomerDialog.close()
        setCustomerToEdit(null)
        toast.success("Kundinformationen har uppdaterats")
        fetchCustomers()
      } else {
        const data = await response.json()
        toast.error(data.error || "Kunde inte uppdatera kund")
      }
    } catch (error) {
      console.error("Failed to edit customer:", error)
      toast.error("Kunde inte uppdatera kund")
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

  return {
    // Customer list
    customers,
    isLoading,
    fetchError,
    fetchCustomers,

    // Filters
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,

    // Expand/collapse
    expandedCustomer,
    toggleExpand,

    // Notes
    customerNotes,
    notesLoading,
    noteToDelete,
    setNoteToDelete,
    isDeletingNote,
    handleAddNote,
    handleEditNote,
    handleDeleteNote,

    // Add/edit customer
    addCustomerDialog,
    isAddingCustomer,
    handleAddCustomer,
    handleEditCustomer,
    customerToEdit,
    setCustomerToEdit,

    // Delete customer
    customerToDelete,
    setCustomerToDelete,
    isDeletingCustomer,
    handleDeleteCustomer,

    // Horses
    customerHorses,
    horsesLoading,
    showHorseDialog,
    setShowHorseDialog,
    horseToEdit,
    setHorseToEdit,
    horseToDelete,
    setHorseToDelete,
    isDeletingHorse,
    isSavingHorse,
    handleSaveHorse,
    handleDeleteHorse,
  }
}
