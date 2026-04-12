"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { clientLogger } from "@/lib/client-logger"
import type { CustomerHorse, HorseFormData } from "@/components/provider/customers/types"
import type { OfflineMutationOptions } from "@/hooks/useOfflineGuard"

type GuardMutation = <T>(
  action: () => Promise<T>,
  offlineOptions?: OfflineMutationOptions
) => Promise<T | undefined>

export function useCustomerHorses(guardMutation: GuardMutation) {
  const [customerHorses, setCustomerHorses] = useState<Map<string, CustomerHorse[]>>(new Map())
  const [horsesLoading, setHorsesLoading] = useState<string | null>(null)
  const [showHorseDialog, setShowHorseDialog] = useState<string | null>(null)
  const [horseToEdit, setHorseToEdit] = useState<CustomerHorse | null>(null)
  const [horseToDelete, setHorseToDelete] = useState<{ horse: CustomerHorse; customerId: string } | null>(null)
  const [isDeletingHorse, setIsDeletingHorse] = useState(false)
  const [isSavingHorse, setIsSavingHorse] = useState(false)

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
      clientLogger.error("Failed to fetch horses", error)
    } finally {
      setHorsesLoading(null)
    }
  }, [customerHorses])

  const handleSaveHorse = async (customerId: string, form: HorseFormData, isEdit: boolean, horseId?: string) => {
    if (!form.name.trim() || isSavingHorse) return

    const entityId = isEdit ? horseId! : globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
    const bodyObj: Record<string, unknown> = { name: form.name.trim() }
    if (form.breed.trim()) bodyObj.breed = form.breed.trim()
    if (form.birthYear.trim()) bodyObj.birthYear = parseInt(form.birthYear, 10)
    if (form.color.trim()) bodyObj.color = form.color.trim()
    if (form.gender) bodyObj.gender = form.gender
    if (form.specialNeeds.trim()) bodyObj.specialNeeds = form.specialNeeds.trim()
    if (form.registrationNumber.trim()) bodyObj.registrationNumber = form.registrationNumber.trim()
    if (form.microchipNumber.trim()) bodyObj.microchipNumber = form.microchipNumber.trim()

    const url = isEdit
      ? `/api/provider/customers/${customerId}/horses/${horseId}`
      : `/api/provider/customers/${customerId}/horses`
    const method = isEdit ? "PUT" : "POST"
    const body = JSON.stringify(bodyObj)

    await guardMutation(
      async () => {
        setIsSavingHorse(true)
        try {
          const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body,
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
            toast.success(isEdit ? "Hasten har uppdaterats" : "Hasten har lagts till")
          } else {
            const data = await response.json()
            toast.error(data.error || "Kunde inte spara hast")
          }
        } catch (error) {
          clientLogger.error("Failed to save horse", error)
          toast.error("Kunde inte spara hast")
        } finally {
          setIsSavingHorse(false)
        }
      },
      {
        method,
        url,
        body,
        entityType: "customer-horse",
        entityId,
        optimisticUpdate: () => {
          setShowHorseDialog(null)
          setHorseToEdit(null)
          setIsSavingHorse(false)
        },
      }
    )
  }

  const handleDeleteHorse = async () => {
    if (!horseToDelete || isDeletingHorse) return

    const { horse, customerId } = horseToDelete

    await guardMutation(
      async () => {
        setIsDeletingHorse(true)
        try {
          const response = await fetch(
            `/api/provider/customers/${customerId}/horses/${horse.id}`,
            { method: "DELETE" }
          )

          if (response.ok) {
            setCustomerHorses((prev) => {
              const updated = new Map(prev)
              const existing = updated.get(customerId) || []
              updated.set(
                customerId,
                existing.filter((h) => h.id !== horse.id)
              )
              return updated
            })
            toast.success("Hasten har tagits bort")
          } else {
            const data = await response.json()
            toast.error(data.error || "Kunde inte ta bort hast")
          }
        } catch (error) {
          clientLogger.error("Failed to delete horse", error)
          toast.error("Kunde inte ta bort hast")
        } finally {
          setIsDeletingHorse(false)
          setHorseToDelete(null)
        }
      },
      {
        method: "DELETE",
        url: `/api/provider/customers/${customerId}/horses/${horse.id}`,
        body: "",
        entityType: "customer-horse",
        entityId: horse.id,
        optimisticUpdate: () => {
          setCustomerHorses((prev) => {
            const updated = new Map(prev)
            const existing = updated.get(customerId) || []
            updated.set(
              customerId,
              existing.filter((h) => h.id !== horse.id)
            )
            return updated
          })
          setIsDeletingHorse(false)
          setHorseToDelete(null)
        },
      }
    )
  }

  const clearHorsesForCustomer = (customerId: string) => {
    setCustomerHorses((prev) => {
      const updated = new Map(prev)
      updated.delete(customerId)
      return updated
    })
  }

  return {
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
    fetchHorses,
    handleSaveHorse,
    handleDeleteHorse,
    clearHorsesForCustomer,
  }
}
