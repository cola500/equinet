"use client"

import { useState, useCallback } from "react"
import { clientLogger } from "@/lib/client-logger"
import type { CustomerNote } from "@/components/provider/customers/types"
import type { OfflineMutationOptions } from "@/hooks/useOfflineGuard"

type GuardMutation = <T>(
  action: () => Promise<T>,
  offlineOptions?: OfflineMutationOptions
) => Promise<T | undefined>

export function useCustomerNotes(guardMutation: GuardMutation) {
  const [customerNotes, setCustomerNotes] = useState<Map<string, CustomerNote[]>>(new Map())
  const [notesLoading, setNotesLoading] = useState<string | null>(null)
  const [noteToDelete, setNoteToDelete] = useState<CustomerNote | null>(null)
  const [isDeletingNote, setIsDeletingNote] = useState(false)

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
      clientLogger.error("Failed to fetch notes", error)
    } finally {
      setNotesLoading(null)
    }
  }, [customerNotes])

  const handleAddNote = async (customerId: string, content: string): Promise<boolean> => {
    const noteId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
    const body = JSON.stringify({ content })

    const result = await guardMutation(
      async () => {
        try {
          const response = await fetch(`/api/provider/customers/${customerId}/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
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
          clientLogger.error("Failed to create note", error)
          return false
        }
      },
      {
        method: "POST",
        url: `/api/provider/customers/${customerId}/notes`,
        body,
        entityType: "customer-note",
        entityId: noteId,
        optimisticUpdate: () => {
          setCustomerNotes((prev) => {
            const updated = new Map(prev)
            const existing = updated.get(customerId) || []
            updated.set(customerId, [
              { id: noteId, providerId: "", customerId, content, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
              ...existing,
            ])
            return updated
          })
        },
      }
    )
    return (result ?? false) as boolean
  }

  const handleEditNote = async (note: CustomerNote, content: string): Promise<boolean> => {
    const body = JSON.stringify({ content })

    const result = await guardMutation(
      async () => {
        try {
          const response = await fetch(
            `/api/provider/customers/${note.customerId}/notes/${note.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body,
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
          clientLogger.error("Failed to update note", error)
          return false
        }
      },
      {
        method: "PUT",
        url: `/api/provider/customers/${note.customerId}/notes/${note.id}`,
        body,
        entityType: "customer-note",
        entityId: note.id,
        optimisticUpdate: () => {
          setCustomerNotes((prev) => {
            const updated = new Map(prev)
            const existing = updated.get(note.customerId) || []
            updated.set(
              note.customerId,
              existing.map((n) => (n.id === note.id ? { ...n, content, updatedAt: new Date().toISOString() } : n))
            )
            return updated
          })
        },
      }
    )
    return (result ?? false) as boolean
  }

  const handleDeleteNote = async (note: CustomerNote) => {
    await guardMutation(
      async () => {
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
          clientLogger.error("Failed to delete note", error)
        } finally {
          setIsDeletingNote(false)
          setNoteToDelete(null)
        }
      },
      {
        method: "DELETE",
        url: `/api/provider/customers/${note.customerId}/notes/${note.id}`,
        body: "",
        entityType: "customer-note",
        entityId: note.id,
        optimisticUpdate: () => {
          setCustomerNotes((prev) => {
            const updated = new Map(prev)
            const existing = updated.get(note.customerId) || []
            updated.set(
              note.customerId,
              existing.filter((n) => n.id !== note.id)
            )
            return updated
          })
          setIsDeletingNote(false)
          setNoteToDelete(null)
        },
      }
    )
  }

  const clearNotesForCustomer = (customerId: string) => {
    setCustomerNotes((prev) => {
      const updated = new Map(prev)
      updated.delete(customerId)
      return updated
    })
  }

  return {
    customerNotes,
    notesLoading,
    noteToDelete,
    setNoteToDelete,
    isDeletingNote,
    fetchNotes,
    handleAddNote,
    handleEditNote,
    handleDeleteNote,
    clearNotesForCustomer,
  }
}
