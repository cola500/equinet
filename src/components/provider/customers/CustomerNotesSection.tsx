"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { VoiceTextarea } from "@/components/ui/voice-textarea"
import { PendingSyncBadge } from "@/components/ui/PendingSyncBadge"
import { StickyNote, Plus, Trash2, Pencil, Loader2 } from "lucide-react"
import type { CustomerNote } from "./types"

function isEdited(note: CustomerNote) {
  return note.updatedAt && note.createdAt !== note.updatedAt
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

interface CustomerNotesSectionProps {
  customerId: string
  notes: CustomerNote[]
  notesLoading: boolean
  onAddNote: (customerId: string, content: string) => Promise<boolean>
  onEditNote: (note: CustomerNote, content: string) => Promise<boolean>
  onDeleteNote: (note: CustomerNote) => void
}

export function CustomerNotesSection({
  customerId,
  notes,
  notesLoading,
  onAddNote,
  onEditNote,
  onDeleteNote,
}: CustomerNotesSectionProps) {
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState("")
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [editingNote, setEditingNote] = useState<CustomerNote | null>(null)
  const [editNoteContent, setEditNoteContent] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || isSavingNote) return

    setIsSavingNote(true)
    const success = await onAddNote(customerId, newNoteContent.trim())
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

  return (
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
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      {formatDateTime(note.createdAt)}
                      {isEdited(note) && (
                        <span className="ml-1 text-gray-400">(redigerad)</span>
                      )}
                      <PendingSyncBadge entityId={note.id} />
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
  )
}
