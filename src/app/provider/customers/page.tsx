"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogAction,
} from "@/components/ui/responsive-alert-dialog"
import {
  Search,
  ChevronDown,
  ChevronUp,
  User,
  PawPrint,
  StickyNote,
  Plus,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react"

interface CustomerHorse {
  id: string
  name: string
}

interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  bookingCount: number
  lastBookingDate: string
  horses: CustomerHorse[]
}

interface CustomerNote {
  id: string
  providerId: string
  customerId: string
  content: string
  createdAt: string
  updatedAt: string
}

type StatusFilter = "all" | "active" | "inactive"

export default function ProviderCustomersPage() {
  const router = useRouter()
  const { isLoading: authLoading, isProvider } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

  // Notes state
  const [customerNotes, setCustomerNotes] = useState<Map<string, CustomerNote[]>>(new Map())
  const [notesLoading, setNotesLoading] = useState<string | null>(null)
  const [isAddingNote, setIsAddingNote] = useState<string | null>(null)
  const [newNoteContent, setNewNoteContent] = useState("")
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<CustomerNote | null>(null)
  const [isDeletingNote, setIsDeletingNote] = useState(false)

  // Edit state
  const [editingNote, setEditingNote] = useState<CustomerNote | null>(null)
  const [editNoteContent, setEditNoteContent] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  useEffect(() => {
    if (!authLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, authLoading, router])

  useEffect(() => {
    if (isProvider) {
      fetchCustomers()
    }
  }, [isProvider, statusFilter, searchQuery])

  const fetchCustomers = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (searchQuery.trim()) params.set("q", searchQuery.trim())

      const response = await fetch(`/api/provider/customers?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers)
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error)
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

  const toggleExpand = (customerId: string) => {
    const newExpanded = expandedCustomer === customerId ? null : customerId
    setExpandedCustomer(newExpanded)

    // Lazy-load notes when expanding
    if (newExpanded) {
      fetchNotes(newExpanded)
    }

    // Reset forms when collapsing
    if (!newExpanded) {
      setIsAddingNote(null)
      setNewNoteContent("")
      setEditingNote(null)
      setEditNoteContent("")
    }
  }

  const handleAddNote = async (customerId: string) => {
    if (!newNoteContent.trim() || isSavingNote) return

    setIsSavingNote(true)
    try {
      const response = await fetch(`/api/provider/customers/${customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      })

      if (response.ok) {
        const note = await response.json()
        setCustomerNotes((prev) => {
          const updated = new Map(prev)
          const existing = updated.get(customerId) || []
          updated.set(customerId, [note, ...existing])
          return updated
        })
        setIsAddingNote(null)
        setNewNoteContent("")
      }
    } catch (error) {
      console.error("Failed to create note:", error)
    } finally {
      setIsSavingNote(false)
    }
  }

  const handleEditNote = async (note: CustomerNote) => {
    if (!editNoteContent.trim() || isSavingEdit) return

    setIsSavingEdit(true)
    try {
      const response = await fetch(
        `/api/provider/customers/${note.customerId}/notes/${note.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editNoteContent.trim() }),
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
        setEditingNote(null)
        setEditNoteContent("")
      }
    } catch (error) {
      console.error("Failed to update note:", error)
    } finally {
      setIsSavingEdit(false)
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

  const isEdited = (note: CustomerNote) => {
    return note.updatedAt && note.createdAt !== note.updatedAt
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (authLoading || !isProvider) {
    return (
      <ProviderLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </ProviderLayout>
    )
  }

  return (
    <ProviderLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Kunder</h1>
        <p className="text-gray-600 mt-1">
          Översikt över dina kunder och deras hästar
        </p>
      </div>

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
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar kunder...</p>
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {searchQuery || statusFilter !== "all"
              ? "Inga kunder matchar din sökning."
              : "Du har inga kunder än. Kunder dyker upp här efter avslutade bokningar."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {customers.map((customer) => (
            <Card key={customer.id} className="overflow-hidden">
              <button
                className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(customer.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">
                        {customer.firstName} {customer.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">{customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden sm:block text-right">
                      <p className="text-sm text-gray-600">
                        {customer.bookingCount}{" "}
                        {customer.bookingCount === 1 ? "bokning" : "bokningar"}
                      </p>
                      <p className="text-xs text-gray-400">
                        Senast: {formatDate(customer.lastBookingDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {customer.horses.length > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          {customer.horses.length}{" "}
                          {customer.horses.length === 1 ? "häst" : "hästar"}
                        </span>
                      )}
                      {expandedCustomer === customer.id ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {expandedCustomer === customer.id && (
                <div className="border-t px-4 py-4 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Telefon
                      </p>
                      <p className="text-sm">
                        {customer.phone || "Ej angivet"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Antal bokningar
                      </p>
                      <p className="text-sm">{customer.bookingCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Senaste bokning
                      </p>
                      <p className="text-sm">
                        {formatDate(customer.lastBookingDate)}
                      </p>
                    </div>
                  </div>

                  {customer.horses.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                        Hästar
                      </p>
                      <div className="space-y-2">
                        {customer.horses.map((horse) => (
                          <Link
                            key={horse.id}
                            href={`/provider/horse-timeline/${horse.id}`}
                            className="flex items-center gap-2 text-sm bg-white p-2 rounded-md hover:bg-green-50 hover:text-green-700 transition-colors"
                          >
                            <PawPrint className="h-4 w-4 text-gray-400" />
                            <span>{horse.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <StickyNote className="h-3 w-3" />
                        Anteckningar
                        {customerNotes.has(customer.id) && (
                          <span className="text-gray-400">
                            ({customerNotes.get(customer.id)!.length})
                          </span>
                        )}
                      </p>
                      {isAddingNote !== customer.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsAddingNote(customer.id)
                            setNewNoteContent("")
                            setEditingNote(null)
                          }}
                          className="h-7 text-xs text-green-600 hover:text-green-700"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Ny anteckning
                        </Button>
                      )}
                    </div>

                    {/* Add note form */}
                    {isAddingNote === customer.id && (
                      <div className="mb-3 bg-white rounded-md p-3 border">
                        <Textarea
                          placeholder="Skriv en anteckning..."
                          value={newNoteContent}
                          onChange={(e) => setNewNoteContent(e.target.value)}
                          rows={3}
                          maxLength={2000}
                          className="mb-2 text-sm resize-none"
                        />
                        <div className="flex flex-col sm:flex-row gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsAddingNote(null)
                              setNewNoteContent("")
                            }}
                          >
                            Avbryt
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAddNote(customer.id)}
                            disabled={!newNoteContent.trim() || isSavingNote}
                          >
                            {isSavingNote && (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            )}
                            Spara
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Notes list */}
                    {notesLoading === customer.id ? (
                      <div className="text-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
                      </div>
                    ) : (customerNotes.get(customer.id) || []).length > 0 ? (
                      <div className="space-y-2">
                        {(customerNotes.get(customer.id) || []).map((note) => (
                          <div
                            key={note.id}
                            className="bg-white rounded-md p-3 border text-sm"
                          >
                            {editingNote?.id === note.id ? (
                              /* Inline edit form */
                              <div>
                                <Textarea
                                  value={editNoteContent}
                                  onChange={(e) => setEditNoteContent(e.target.value)}
                                  rows={3}
                                  maxLength={2000}
                                  className="mb-2 text-sm resize-none"
                                />
                                <div className="flex flex-col sm:flex-row gap-2 justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingNote(null)
                                      setEditNoteContent("")
                                    }}
                                  >
                                    Avbryt
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleEditNote(note)}
                                    disabled={!editNoteContent.trim() || isSavingEdit}
                                  >
                                    {isSavingEdit && (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    )}
                                    Spara
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              /* Display mode */
                              <>
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <span className="text-xs text-gray-400">
                                    {formatDateTime(note.createdAt)}
                                    {isEdited(note) && (
                                      <span className="ml-1 text-gray-400">(redigerad)</span>
                                    )}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingNote(note)
                                        setEditNoteContent(note.content)
                                        setIsAddingNote(null)
                                      }}
                                      className="text-gray-300 hover:text-blue-500 transition-colors min-h-[44px] sm:min-h-0 flex items-center"
                                      aria-label="Redigera anteckning"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setNoteToDelete(note)}
                                      className="text-gray-300 hover:text-red-500 transition-colors min-h-[44px] sm:min-h-0 flex items-center"
                                      aria-label="Ta bort anteckning"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-gray-700 whitespace-pre-line">
                                  {note.content}
                                </p>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        Inga anteckningar ännu
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Delete note confirmation */}
      {noteToDelete && (
        <ResponsiveAlertDialog
          open={true}
          onOpenChange={(open) => { if (!open) setNoteToDelete(null) }}
        >
          <ResponsiveAlertDialogContent>
            <ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogTitle>Ta bort anteckning?</ResponsiveAlertDialogTitle>
              <ResponsiveAlertDialogDescription>
                Anteckningen tas bort permanent och kan inte återställas.
              </ResponsiveAlertDialogDescription>
            </ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogFooter>
              <ResponsiveAlertDialogCancel onClick={() => setNoteToDelete(null)}>
                Avbryt
              </ResponsiveAlertDialogCancel>
              <ResponsiveAlertDialogAction
                onClick={() => handleDeleteNote(noteToDelete)}
                className="bg-red-600 hover:bg-red-700"
                disabled={isDeletingNote}
              >
                {isDeletingNote ? "Tar bort..." : "Ta bort"}
              </ResponsiveAlertDialogAction>
            </ResponsiveAlertDialogFooter>
          </ResponsiveAlertDialogContent>
        </ResponsiveAlertDialog>
      )}
    </ProviderLayout>
  )
}
