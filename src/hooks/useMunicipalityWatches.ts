"use client"

import useSWR from "swr"
import { useCallback, useState } from "react"
import { toast } from "sonner"

interface MunicipalityWatch {
  id: string
  customerId: string
  municipality: string
  serviceTypeName: string
  createdAt: string
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("Fetch failed")
  return r.json()
})

export function useMunicipalityWatches() {
  const { data, error, isLoading, mutate } = useSWR<MunicipalityWatch[]>(
    "/api/municipality-watches",
    fetcher
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const addWatch = useCallback(async (municipality: string, serviceTypeName: string) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/municipality-watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ municipality, serviceTypeName }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        toast.error(body.error || "Kunde inte skapa bevakning")
        return false
      }

      await mutate()
      toast.success("Bevakning skapad")
      return true
    } catch {
      toast.error("Kunde inte skapa bevakning")
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [mutate])

  const removeWatch = useCallback(async (id: string) => {
    // Optimistic update
    const prev = data
    mutate(
      data?.filter((w) => w.id !== id),
      false
    )

    try {
      const response = await fetch(`/api/municipality-watches/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        throw new Error()
      }
      await mutate()
    } catch {
      // Revert
      mutate(prev, false)
      toast.error("Kunde inte ta bort bevakning")
    }
  }, [data, mutate])

  return {
    watches: data || [],
    isLoading,
    error,
    isSubmitting,
    addWatch,
    removeWatch,
  }
}

export function useServiceTypes() {
  const { data, isLoading } = useSWR<string[]>(
    "/api/service-types",
    fetcher
  )

  return {
    serviceTypes: data || [],
    isLoading,
  }
}
