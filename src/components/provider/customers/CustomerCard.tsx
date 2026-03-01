"use client"

import { useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VoiceTextarea } from "@/components/ui/voice-textarea"
import { CustomerInsightCard } from "@/components/customer/CustomerInsightCard"
import {
  ChevronDown,
  ChevronUp,
  User,
  StickyNote,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Send,
  Merge,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HorseIcon } from "@/components/icons/HorseIcon"
import type { Customer, CustomerHorse, CustomerNote } from "./types"

interface CustomerCardProps {
  customer: Customer
  isExpanded: boolean
  onToggleExpand: () => void
  horses: CustomerHorse[]
  horsesLoading: boolean
  notes: CustomerNote[]
  notesLoading: boolean
  flags: Record<string, boolean>
  // Note callbacks
  onAddNote: (customerId: string, content: string) => Promise<boolean>
  onEditNote: (note: CustomerNote, content: string) => Promise<boolean>
  onDeleteNote: (note: CustomerNote) => void
  // Horse callbacks
  onAddHorse: (customerId: string) => void
  onEditHorse: (horse: CustomerHorse, customerId: string) => void
  onDeleteHorse: (horse: CustomerHorse, customerId: string) => void
  // Customer callbacks
  onEditCustomer: (customer: Customer) => void
  onDeleteCustomer: (customer: Customer) => void
}

function isEdited(note: CustomerNote) {
  return note.updatedAt && note.createdAt !== note.updatedAt
}

function isSentinelEmail(email: string) {
  return email.includes("@ghost.equinet.se")
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function CustomerCard({
  customer,
  isExpanded,
  onToggleExpand,
  horses,
  horsesLoading,
  notes,
  notesLoading,
  flags,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onAddHorse,
  onEditHorse,
  onDeleteHorse,
  onEditCustomer,
  onDeleteCustomer,
}: CustomerCardProps) {
  // Local note form state
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState("")
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [editingNote, setEditingNote] = useState<CustomerNote | null>(null)
  const [editNoteContent, setEditNoteContent] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<"idle" | "sent" | "error">("idle")
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [mergeEmail, setMergeEmail] = useState("")
  const [isMerging, setIsMerging] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [mergeSuccess, setMergeSuccess] = useState(false)

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || isSavingNote) return

    setIsSavingNote(true)
    const success = await onAddNote(customer.id, newNoteContent.trim())
    setIsSavingNote(false)

    if (success) {
      setIsAddingNote(false)
      setNewNoteContent("")
    }
  }

  const handleEditNote = async (note: CustomerNote) => {
    if (!editNoteContent.trim() || isSavingEdit) return

    setIsSavingEdit(true)
    const success = await onEditNote(note, editNoteContent.trim())
    setIsSavingEdit(false)

    if (success) {
      setEditingNote(null)
      setEditNoteContent("")
    }
  }

  const handleInvite = async () => {
    if (isInviting) return
    setIsInviting(true)
    setInviteStatus("idle")

    try {
      const res = await fetch(`/api/provider/customers/${customer.id}/invite`, {
        method: "POST",
      })

      if (res.ok) {
        setInviteStatus("sent")
      } else {
        setInviteStatus("error")
      }
    } catch {
      setInviteStatus("error")
    } finally {
      setIsInviting(false)
    }
  }

  const handleMerge = async () => {
    if (isMerging || !mergeEmail.trim()) return
    setIsMerging(true)
    setMergeError(null)

    try {
      const res = await fetch(`/api/provider/customers/${customer.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmail: mergeEmail.trim() }),
      })

      if (res.ok) {
        setMergeSuccess(true)
      } else {
        const data = await res.json()
        setMergeError(data.error || "Något gick fel")
      }
    } catch {
      setMergeError("Något gick fel. Försök igen.")
    } finally {
      setIsMerging(false)
    }
  }

  const canInvite = customer.isManuallyAdded &&
    !isSentinelEmail(customer.email) &&
    flags.customer_invite

  const canMerge = customer.isManuallyAdded && flags.customer_invite

  const horseCount = horses.length > 0 ? horses.length : customer.horses.length

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">
                  {customer.firstName} {customer.lastName}
                </h3>
                {customer.isManuallyAdded && customer.bookingCount === 0 && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                    manuellt tillagd
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {isSentinelEmail(customer.email) ? "-" : customer.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:block text-right">
              {customer.bookingCount > 0 ? (
                <>
                  <p className="text-sm text-gray-600">
                    {customer.bookingCount}{" "}
                    {customer.bookingCount === 1 ? "bokning" : "bokningar"}
                  </p>
                  {customer.noShowCount > 0 && (
                    <p className={`text-xs font-medium ${customer.noShowCount >= 2 ? "text-orange-700" : "text-orange-500"}`}>
                      {customer.noShowCount} utebliven{customer.noShowCount !== 1 ? "a" : ""}
                    </p>
                  )}
                  {customer.lastBookingDate && (
                    <p className="text-xs text-gray-400">
                      Senast: {formatDate(customer.lastBookingDate)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">Inga bokningar</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {horseCount > 0 && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {horseCount}{" "}
                  {horseCount === 1 ? "häst" : "hästar"}
                </span>
              )}
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
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
              {customer.noShowCount > 0 && (
                <p className={`text-xs font-medium mt-0.5 ${customer.noShowCount >= 2 ? "text-orange-700" : "text-orange-500"}`}>
                  {customer.noShowCount} utebliven{customer.noShowCount !== 1 ? "a" : ""}
                </p>
              )}
            </div>
            {customer.lastBookingDate && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Senaste bokning
                </p>
                <p className="text-sm">
                  {formatDate(customer.lastBookingDate)}
                </p>
              </div>
            )}
          </div>

          {/* Horses section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <HorseIcon className="h-3 w-3" />
                Hästar
                {horses.length > 0 && (
                  <span className="text-gray-400">
                    ({horses.length})
                  </span>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddHorse(customer.id)}
                className="h-7 text-xs text-primary hover:text-primary/80"
              >
                <Plus className="h-3 w-3 mr-1" />
                Lägg till häst
              </Button>
            </div>

            {horsesLoading ? (
              <div className="text-center py-3">
                <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
              </div>
            ) : horses.length > 0 ? (
              <div className="space-y-2">
                {horses.map((horse) => (
                  <div
                    key={horse.id}
                    className="flex items-center justify-between bg-white p-2 rounded-md border text-sm"
                  >
                    <Link
                      href={`/provider/horse-timeline/${horse.id}`}
                      className="flex items-center gap-2 hover:text-green-700 transition-colors min-w-0 flex-1"
                    >
                      <HorseIcon className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-medium">{horse.name}</span>
                        {horse.breed && (
                          <span className="text-gray-400 ml-1">({horse.breed})</span>
                        )}
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onEditHorse(horse, customer.id)}
                        className="text-gray-300 hover:text-blue-500 transition-colors min-h-[44px] sm:min-h-0 flex items-center"
                        aria-label="Redigera häst"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteHorse(horse, customer.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors min-h-[44px] sm:min-h-0 flex items-center"
                        aria-label="Ta bort häst"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Inga hästar registrerade
              </p>
            )}
          </div>

          {/* Notes section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <StickyNote className="h-3 w-3" />
                Anteckningar
                {notes.length > 0 && (
                  <span className="text-gray-400">
                    ({notes.length})
                  </span>
                )}
              </p>
              {!isAddingNote && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingNote(true)
                    setNewNoteContent("")
                    setEditingNote(null)
                  }}
                  className="h-7 text-xs text-primary hover:text-primary/80"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ny anteckning
                </Button>
              )}
            </div>

            {/* Add note form */}
            {isAddingNote && (
              <div className="mb-3 bg-white rounded-md p-3 border">
                <VoiceTextarea
                  placeholder="Skriv en anteckning..."
                  value={newNoteContent}
                  onChange={(value) => setNewNoteContent(value)}
                  rows={3}
                  maxLength={2000}
                  className="mb-2 text-sm resize-none"
                />
                <div className="flex flex-col sm:flex-row gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsAddingNote(false)
                      setNewNoteContent("")
                    }}
                  >
                    Avbryt
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddNote}
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
            {notesLoading ? (
              <div className="text-center py-3">
                <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
              </div>
            ) : notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-white rounded-md p-3 border text-sm"
                  >
                    {editingNote?.id === note.id ? (
                      /* Inline edit form */
                      <div>
                        <VoiceTextarea
                          value={editNoteContent}
                          onChange={(value) => setEditNoteContent(value)}
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
                                setIsAddingNote(false)
                              }}
                              className="text-gray-300 hover:text-blue-500 transition-colors min-h-[44px] sm:min-h-0 flex items-center"
                              aria-label="Redigera anteckning"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteNote(note)}
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

          {/* Customer Insights */}
          {flags.customer_insights && (
            <div className="mt-4 pt-4 border-t">
              <CustomerInsightCard customerId={customer.id} />
            </div>
          )}

          {/* Customer actions */}
          <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-800"
              onClick={() => onEditCustomer(customer)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Redigera kund
            </Button>
            {canInvite && (
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary/80"
                onClick={handleInvite}
                disabled={isInviting || inviteStatus === "sent"}
              >
                {isInviting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1" />
                )}
                {inviteStatus === "sent" ? "Inbjudan skickad" : "Skicka inbjudan"}
              </Button>
            )}
            {inviteStatus === "error" && (
              <span className="text-xs text-red-500">Kunde inte skicka inbjudan</span>
            )}
            {canMerge && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-800"
                onClick={() => {
                  setShowMergeDialog(true)
                  setMergeEmail("")
                  setMergeError(null)
                  setMergeSuccess(false)
                }}
              >
                <Merge className="h-3.5 w-3.5 mr-1" />
                Slå ihop
              </Button>
            )}
            {customer.isManuallyAdded && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDeleteCustomer(customer)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Ta bort kund
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Merge dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slå ihop med riktigt konto</DialogTitle>
            <DialogDescription>
              All data (bokningar, hästar, recensioner) från {customer.firstName} {customer.lastName} flyttas
              till det riktiga kontot. Den manuella kundposten raderas sedan.
            </DialogDescription>
          </DialogHeader>

          {mergeSuccess ? (
            <div className="py-4">
              <p className="text-sm text-green-600 font-medium">
                Kunden har slagits ihop med det riktiga kontot.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-sm text-amber-800 font-medium">
                    Den här åtgärden är permanent och kan inte ångras.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="merge-email">E-postadress för målkontot</Label>
                  <Input
                    id="merge-email"
                    type="email"
                    placeholder="kund@example.com"
                    value={mergeEmail}
                    onChange={(e) => setMergeEmail(e.target.value)}
                    disabled={isMerging}
                  />
                </div>
                {mergeError && (
                  <p className="text-sm text-red-600">{mergeError}</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowMergeDialog(false)}
                  disabled={isMerging}
                >
                  Avbryt
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleMerge}
                  disabled={isMerging || !mergeEmail.trim()}
                >
                  {isMerging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Slå ihop
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
