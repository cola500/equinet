"use client"

import { Card } from "@/components/ui/card"
import { CustomerInsightCard } from "@/components/customer/CustomerInsightCard"
import { ChevronDown, ChevronUp, User } from "lucide-react"
import { CustomerHorsesSection } from "./CustomerHorsesSection"
import { CustomerNotesSection } from "./CustomerNotesSection"
import { CustomerActions } from "./CustomerActions"
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
  onMergeSuccess?: () => void
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
  onMergeSuccess,
}: CustomerCardProps) {
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

          <CustomerHorsesSection
            customerId={customer.id}
            horses={horses}
            horsesLoading={horsesLoading}
            onAddHorse={onAddHorse}
            onEditHorse={onEditHorse}
            onDeleteHorse={onDeleteHorse}
          />

          <CustomerNotesSection
            customerId={customer.id}
            notes={notes}
            notesLoading={notesLoading}
            onAddNote={onAddNote}
            onEditNote={onEditNote}
            onDeleteNote={onDeleteNote}
          />

          {/* Customer Insights */}
          {flags.customer_insights && (
            <div className="mt-4 pt-4 border-t">
              <CustomerInsightCard customerId={customer.id} />
            </div>
          )}

          <CustomerActions
            customer={customer}
            flags={flags}
            onEditCustomer={onEditCustomer}
            onDeleteCustomer={onDeleteCustomer}
            onMergeSuccess={onMergeSuccess}
          />
        </div>
      )}
    </Card>
  )
}
