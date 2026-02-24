"use client"

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
import type { Customer, CustomerHorse, CustomerNote } from "./types"

interface DeleteConfirmDialogsProps {
  noteToDelete: CustomerNote | null
  onDeleteNote: () => void
  onCancelNoteDelete: () => void
  isDeletingNote: boolean

  customerToDelete: Customer | null
  onDeleteCustomer: () => void
  onCancelCustomerDelete: () => void
  isDeletingCustomer: boolean

  horseToDelete: { horse: CustomerHorse; customerId: string } | null
  onDeleteHorse: () => void
  onCancelHorseDelete: () => void
  isDeletingHorse: boolean
}

export function DeleteConfirmDialogs({
  noteToDelete,
  onDeleteNote,
  onCancelNoteDelete,
  isDeletingNote,
  customerToDelete,
  onDeleteCustomer,
  onCancelCustomerDelete,
  isDeletingCustomer,
  horseToDelete,
  onDeleteHorse,
  onCancelHorseDelete,
  isDeletingHorse,
}: DeleteConfirmDialogsProps) {
  return (
    <>
      {/* Delete note confirmation */}
      {noteToDelete && (
        <ResponsiveAlertDialog
          open={true}
          onOpenChange={(open) => { if (!open) onCancelNoteDelete() }}
        >
          <ResponsiveAlertDialogContent>
            <ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogTitle>Ta bort anteckning?</ResponsiveAlertDialogTitle>
              <ResponsiveAlertDialogDescription>
                Anteckningen tas bort permanent och kan inte återställas.
              </ResponsiveAlertDialogDescription>
            </ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogFooter>
              <ResponsiveAlertDialogCancel onClick={onCancelNoteDelete}>
                Avbryt
              </ResponsiveAlertDialogCancel>
              <ResponsiveAlertDialogAction
                onClick={onDeleteNote}
                className="bg-red-600 hover:bg-red-700"
                disabled={isDeletingNote}
              >
                {isDeletingNote ? "Tar bort..." : "Ta bort"}
              </ResponsiveAlertDialogAction>
            </ResponsiveAlertDialogFooter>
          </ResponsiveAlertDialogContent>
        </ResponsiveAlertDialog>
      )}

      {/* Delete customer confirmation */}
      {customerToDelete && (
        <ResponsiveAlertDialog
          open={true}
          onOpenChange={(open) => { if (!open) onCancelCustomerDelete() }}
        >
          <ResponsiveAlertDialogContent>
            <ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogTitle>Ta bort kund?</ResponsiveAlertDialogTitle>
              <ResponsiveAlertDialogDescription>
                {customerToDelete.firstName} {customerToDelete.lastName} tas bort från ditt kundregister.
                {customerToDelete.bookingCount === 0
                  ? " Kundens konto raderas helt."
                  : " Befintliga bokningar påverkas inte."}
              </ResponsiveAlertDialogDescription>
            </ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogFooter>
              <ResponsiveAlertDialogCancel onClick={onCancelCustomerDelete}>
                Avbryt
              </ResponsiveAlertDialogCancel>
              <ResponsiveAlertDialogAction
                onClick={onDeleteCustomer}
                className="bg-red-600 hover:bg-red-700"
                disabled={isDeletingCustomer}
              >
                {isDeletingCustomer ? "Tar bort..." : "Ta bort"}
              </ResponsiveAlertDialogAction>
            </ResponsiveAlertDialogFooter>
          </ResponsiveAlertDialogContent>
        </ResponsiveAlertDialog>
      )}

      {/* Delete horse confirmation */}
      {horseToDelete && (
        <ResponsiveAlertDialog
          open={true}
          onOpenChange={(open) => { if (!open) onCancelHorseDelete() }}
        >
          <ResponsiveAlertDialogContent>
            <ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogTitle>Ta bort häst?</ResponsiveAlertDialogTitle>
              <ResponsiveAlertDialogDescription>
                {horseToDelete.horse.name} tas bort. Detta kan inte ångras.
              </ResponsiveAlertDialogDescription>
            </ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogFooter>
              <ResponsiveAlertDialogCancel onClick={onCancelHorseDelete}>
                Avbryt
              </ResponsiveAlertDialogCancel>
              <ResponsiveAlertDialogAction
                onClick={onDeleteHorse}
                className="bg-red-600 hover:bg-red-700"
                disabled={isDeletingHorse}
              >
                {isDeletingHorse ? "Tar bort..." : "Ta bort"}
              </ResponsiveAlertDialogAction>
            </ResponsiveAlertDialogFooter>
          </ResponsiveAlertDialogContent>
        </ResponsiveAlertDialog>
      )}
    </>
  )
}
