"use client"

import { useEffect, useState, useCallback } from "react"
import { useDialogState } from "@/hooks/useDialogState"
import { toast } from "sonner"
import { useOfflineGuard } from "@/hooks/useOfflineGuard"
import { clientLogger } from "@/lib/client-logger"
import { useCustomerNotes } from "@/hooks/useCustomerNotes"
import { useCustomerHorses } from "@/hooks/useCustomerHorses"
import type { Customer } from "@/components/provider/customers/types"

export type StatusFilter = "all" | "active" | "inactive"

export function useProviderCustomers(isProvider: boolean) {
  const { guardMutation } = useOfflineGuard()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

  // Customer form dialog (add + edit)
  const addCustomerDialog = useDialogState()
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null)

  // Delete customer
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false)

  // Composed hooks
  const notes = useCustomerNotes(guardMutation)
  const horses = useCustomerHorses(guardMutation)

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
      clientLogger.error("Failed to fetch customers", error)
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

  const toggleExpand = (customerId: string) => {
    const newExpanded = expandedCustomer === customerId ? null : customerId
    setExpandedCustomer(newExpanded)

    if (newExpanded) {
      notes.fetchNotes(newExpanded)
      horses.fetchHorses(newExpanded)
    }
  }

  const handleAddCustomer = async (form: { firstName: string; lastName: string; phone: string; email: string }) => {
    if (!form.firstName.trim() || isAddingCustomer) return

    const customerId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
    const bodyObj: Record<string, string> = { firstName: form.firstName.trim() }
    if (form.lastName.trim()) bodyObj.lastName = form.lastName.trim()
    if (form.phone.trim()) bodyObj.phone = form.phone.trim()
    if (form.email.trim()) bodyObj.email = form.email.trim()
    const body = JSON.stringify(bodyObj)

    await guardMutation(
      async () => {
        setIsAddingCustomer(true)
        try {
          const response = await fetch("/api/provider/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          })

          if (response.ok) {
            addCustomerDialog.close()
            toast.success(`${bodyObj.firstName} har lagts till i kundregistret`)
            fetchCustomers()
          } else {
            const data = await response.json()
            toast.error(data.error || "Kunde inte lagga till kund")
          }
        } catch (error) {
          clientLogger.error("Failed to add customer", error)
          toast.error("Kunde inte lagga till kund")
        } finally {
          setIsAddingCustomer(false)
        }
      },
      {
        method: "POST",
        url: "/api/provider/customers",
        body,
        entityType: "customer",
        entityId: customerId,
        optimisticUpdate: () => {
          addCustomerDialog.close()
          setIsAddingCustomer(false)
        },
      }
    )
  }

  const handleEditCustomer = async (customerId: string, form: { firstName: string; lastName: string; phone: string; email: string }) => {
    if (!form.firstName.trim() || isAddingCustomer) return

    const bodyObj: Record<string, string> = { firstName: form.firstName.trim() }
    if (form.lastName.trim()) bodyObj.lastName = form.lastName.trim()
    if (form.phone.trim()) bodyObj.phone = form.phone.trim()
    if (form.email.trim()) bodyObj.email = form.email.trim()
    const body = JSON.stringify(bodyObj)

    await guardMutation(
      async () => {
        setIsAddingCustomer(true)
        try {
          const response = await fetch(`/api/provider/customers/${customerId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body,
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
          clientLogger.error("Failed to edit customer", error)
          toast.error("Kunde inte uppdatera kund")
        } finally {
          setIsAddingCustomer(false)
        }
      },
      {
        method: "PUT",
        url: `/api/provider/customers/${customerId}`,
        body,
        entityType: "customer",
        entityId: customerId,
        optimisticUpdate: () => {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId
                ? { ...c, firstName: bodyObj.firstName, lastName: bodyObj.lastName || c.lastName }
                : c
            )
          )
          addCustomerDialog.close()
          setCustomerToEdit(null)
          setIsAddingCustomer(false)
        },
      }
    )
  }

  const handleDeleteCustomer = async (customer: Customer) => {
    await guardMutation(
      async () => {
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
            notes.clearNotesForCustomer(customer.id)
            horses.clearHorsesForCustomer(customer.id)
            fetchCustomers()
          } else {
            const data = await response.json()
            toast.error(data.error || "Kunde inte ta bort kund")
          }
        } catch (error) {
          clientLogger.error("Failed to delete customer", error)
          toast.error("Kunde inte ta bort kund")
        } finally {
          setIsDeletingCustomer(false)
          setCustomerToDelete(null)
        }
      },
      {
        method: "DELETE",
        url: `/api/provider/customers/${customer.id}`,
        body: "",
        entityType: "customer",
        entityId: customer.id,
        optimisticUpdate: () => {
          setCustomers((prev) => prev.filter((c) => c.id !== customer.id))
          if (expandedCustomer === customer.id) {
            setExpandedCustomer(null)
          }
          notes.clearNotesForCustomer(customer.id)
          horses.clearHorsesForCustomer(customer.id)
          setIsDeletingCustomer(false)
          setCustomerToDelete(null)
        },
      }
    )
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

    // Notes (from useCustomerNotes)
    customerNotes: notes.customerNotes,
    notesLoading: notes.notesLoading,
    noteToDelete: notes.noteToDelete,
    setNoteToDelete: notes.setNoteToDelete,
    isDeletingNote: notes.isDeletingNote,
    handleAddNote: notes.handleAddNote,
    handleEditNote: notes.handleEditNote,
    handleDeleteNote: notes.handleDeleteNote,

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

    // Horses (from useCustomerHorses)
    customerHorses: horses.customerHorses,
    horsesLoading: horses.horsesLoading,
    showHorseDialog: horses.showHorseDialog,
    setShowHorseDialog: horses.setShowHorseDialog,
    horseToEdit: horses.horseToEdit,
    setHorseToEdit: horses.setHorseToEdit,
    horseToDelete: horses.horseToDelete,
    setHorseToDelete: horses.setHorseToDelete,
    isDeletingHorse: horses.isDeletingHorse,
    isSavingHorse: horses.isSavingHorse,
    handleSaveHorse: horses.handleSaveHorse,
    handleDeleteHorse: horses.handleDeleteHorse,
  }
}
