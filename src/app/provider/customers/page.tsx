"use client"

import { useAuth } from "@/hooks/useAuth"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useProviderCustomers, type StatusFilter } from "@/hooks/useProviderCustomers"
import { OfflineErrorState } from "@/components/ui/OfflineErrorState"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { CustomerListSkeleton } from "@/components/loading/CustomerListSkeleton"
import { useFeatureFlags } from "@/components/providers/FeatureFlagProvider"
import { Search, UserPlus, Users } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { CustomerCard } from "@/components/provider/customers/CustomerCard"
import { CustomerFormDialog } from "@/components/provider/customers/CustomerFormDialog"
import { AddEditHorseDialog } from "@/components/provider/customers/AddEditHorseDialog"
import { DeleteConfirmDialogs } from "@/components/provider/customers/DeleteConfirmDialogs"

export default function ProviderCustomersPage() {
  const { isLoading: authLoading, isProvider } = useAuth()
  const isOnline = useOnlineStatus()
  const flags = useFeatureFlags()
  const c = useProviderCustomers(isProvider)

  if (authLoading || !isProvider) {
    return (
      <ProviderLayout>
        <CustomerListSkeleton />
      </ProviderLayout>
    )
  }

  return (
    <ProviderLayout>
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Kunder</h1>
            <p className="text-gray-600 mt-1">
              Översikt över dina kunder och deras hästar
            </p>
          </div>
          <Button onClick={() => c.addCustomerDialog.openDialog()}>
            <UserPlus className="h-4 w-4 mr-2" />
            Lägg till kund
          </Button>
        </div>
      </div>

      {c.fetchError && !isOnline && (
        <div className="mb-6">
          <OfflineErrorState onRetry={c.fetchCustomers} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Sök på namn eller email..."
            value={c.searchQuery}
            onChange={(e) => c.setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => c.setStatusFilter(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                c.statusFilter === status
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
      {c.isLoading ? (
        <CustomerListSkeleton />
      ) : c.customers.length === 0 ? (
        c.searchQuery || c.statusFilter !== "all" ? (
          <EmptyState
            icon={Search}
            title="Inga träffar"
            description="Inga kunder matchar din sökning. Prova ett annat sökord eller filter."
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Inga kunder ännu"
            description="Kunder visas här när de bokar dina tjänster, eller lägg till dem manuellt."
            action={{ label: "Lägg till din första kund", onClick: () => c.addCustomerDialog.openDialog() }}
          />
        )
      ) : (
        <div className="space-y-3">
          {c.customers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              isExpanded={c.expandedCustomer === customer.id}
              onToggleExpand={() => c.toggleExpand(customer.id)}
              horses={c.customerHorses.get(customer.id) || []}
              horsesLoading={c.horsesLoading === customer.id}
              notes={c.customerNotes.get(customer.id) || []}
              notesLoading={c.notesLoading === customer.id}
              flags={flags}
              onAddNote={c.handleAddNote}
              onEditNote={c.handleEditNote}
              onDeleteNote={(note) => c.setNoteToDelete(note)}
              onAddHorse={(customerId) => {
                c.setShowHorseDialog(customerId)
                c.setHorseToEdit(null)
              }}
              onEditHorse={(horse, customerId) => {
                c.setHorseToEdit(horse)
                c.setShowHorseDialog(customerId)
              }}
              onDeleteHorse={(horse, customerId) => c.setHorseToDelete({ horse, customerId })}
              onEditCustomer={(cust) => {
                c.setCustomerToEdit(cust)
                c.addCustomerDialog.openDialog()
              }}
              onDeleteCustomer={(cust) => c.setCustomerToDelete(cust)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit customer dialog */}
      <CustomerFormDialog
        open={c.addCustomerDialog.open}
        isSaving={c.isAddingCustomer}
        mode={c.customerToEdit ? "edit" : "add"}
        customer={c.customerToEdit}
        onSave={(form) => {
          if (c.customerToEdit) {
            c.handleEditCustomer(c.customerToEdit.id, form)
          } else {
            c.handleAddCustomer(form)
          }
        }}
        onClose={() => {
          c.addCustomerDialog.close()
          c.setCustomerToEdit(null)
        }}
      />

      {/* Add/Edit horse dialog */}
      {c.showHorseDialog && (
        <AddEditHorseDialog
          open={true}
          customerId={c.showHorseDialog}
          horseToEdit={c.horseToEdit}
          isSaving={c.isSavingHorse}
          onSave={c.handleSaveHorse}
          onClose={() => {
            c.setShowHorseDialog(null)
            c.setHorseToEdit(null)
          }}
        />
      )}

      {/* Delete confirmation dialogs */}
      <DeleteConfirmDialogs
        noteToDelete={c.noteToDelete}
        onDeleteNote={() => c.noteToDelete && c.handleDeleteNote(c.noteToDelete)}
        onCancelNoteDelete={() => c.setNoteToDelete(null)}
        isDeletingNote={c.isDeletingNote}
        customerToDelete={c.customerToDelete}
        onDeleteCustomer={() => c.customerToDelete && c.handleDeleteCustomer(c.customerToDelete)}
        onCancelCustomerDelete={() => c.setCustomerToDelete(null)}
        isDeletingCustomer={c.isDeletingCustomer}
        horseToDelete={c.horseToDelete}
        onDeleteHorse={c.handleDeleteHorse}
        onCancelHorseDelete={() => c.setHorseToDelete(null)}
        isDeletingHorse={c.isDeletingHorse}
      />
    </ProviderLayout>
  )
}
