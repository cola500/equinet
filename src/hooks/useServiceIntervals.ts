import { useState, useCallback } from "react"
import { toast } from "sonner"
import { useDialogState } from "@/hooks/useDialogState"
import type { ServiceInterval, AvailableService } from "@/app/customer/horses/[id]/types"

export function useServiceIntervals(horseId: string, enabled: boolean) {
  const [intervals, setIntervals] = useState<ServiceInterval[]>([])
  const [availableServices, setAvailableServices] = useState<AvailableService[]>([])
  const intervalDialog = useDialogState()
  const [editingInterval, setEditingInterval] = useState<ServiceInterval | null>(null)
  const [intervalForm, setIntervalForm] = useState({ serviceId: "", intervalWeeks: "" })
  const [isSavingInterval, setIsSavingInterval] = useState(false)

  const fetchIntervals = useCallback(async () => {
    if (!enabled) return
    try {
      const response = await fetch(`/api/customer/horses/${horseId}/intervals`)
      if (response.ok) {
        const data = await response.json()
        setIntervals(data.intervals ?? [])
        setAvailableServices(data.availableServices ?? [])
      }
    } catch {
      // Silent -- intervals are supplementary
    }
  }, [horseId, enabled])

  const handleSaveInterval = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingInterval(true)

    try {
      const response = await fetch(`/api/customer/horses/${horseId}/intervals`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: intervalForm.serviceId,
          intervalWeeks: Number(intervalForm.intervalWeeks),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte spara intervall")
      }

      toast.success(editingInterval ? "Intervall uppdaterat!" : "Intervall tillagt!")
      intervalDialog.close()
      setEditingInterval(null)
      setIntervalForm({ serviceId: "", intervalWeeks: "" })
      fetchIntervals()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte spara intervall"
      )
    } finally {
      setIsSavingInterval(false)
    }
  }, [horseId, intervalForm, editingInterval, intervalDialog, fetchIntervals])

  const handleDeleteInterval = useCallback(async (serviceId: string, serviceName: string) => {
    if (!window.confirm(`Ta bort intervall för ${serviceName}?`)) return

    try {
      const response = await fetch(`/api/customer/horses/${horseId}/intervals`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte ta bort intervall")
      }

      toast.success("Intervall borttaget!")
      fetchIntervals()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte ta bort intervall"
      )
    }
  }, [horseId, fetchIntervals])

  const openEditInterval = useCallback((interval: ServiceInterval) => {
    setEditingInterval(interval)
    setIntervalForm({
      serviceId: interval.serviceId,
      intervalWeeks: String(interval.intervalWeeks),
    })
    intervalDialog.openDialog()
  }, [intervalDialog])

  const openNewInterval = useCallback(() => {
    setEditingInterval(null)
    setIntervalForm({ serviceId: "", intervalWeeks: "" })
    intervalDialog.openDialog()
  }, [intervalDialog])

  const handleServiceSelect = useCallback((serviceId: string) => {
    const service = availableServices.find((s) => s.id === serviceId)
    setIntervalForm((prev) => ({
      serviceId,
      intervalWeeks: service?.recommendedIntervalWeeks
        ? String(service.recommendedIntervalWeeks)
        : prev.intervalWeeks,
    }))
  }, [availableServices])

  return {
    intervals,
    availableServices,
    intervalDialog,
    editingInterval,
    intervalForm,
    setIntervalForm,
    isSavingInterval,
    fetchIntervals,
    handleSaveInterval,
    handleDeleteInterval,
    openEditInterval,
    openNewInterval,
    handleServiceSelect,
  }
}
