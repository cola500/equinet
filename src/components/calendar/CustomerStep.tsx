"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CustomerResult {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
}

interface CustomerStepProps {
  customerMode: "search" | "manual"
  onCustomerModeChange: (mode: "search" | "manual") => void
  isOnline: boolean
  // Search mode
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  searchResults: CustomerResult[]
  isSearching: boolean
  selectedCustomer: CustomerResult | null
  onSelectCustomer: (customer: CustomerResult) => void
  onClearCustomer: () => void
  // Manual mode
  customerName: string
  onCustomerNameChange: (name: string) => void
  customerPhone: string
  onCustomerPhoneChange: (phone: string) => void
  customerEmail: string
  onCustomerEmailChange: (email: string) => void
  // Reset callbacks for mode switching
  onSwitchToSearch: () => void
  onSwitchToManual: () => void
}

export function CustomerStep({
  customerMode,
  isOnline,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  isSearching,
  selectedCustomer,
  onSelectCustomer,
  onClearCustomer,
  customerName,
  onCustomerNameChange,
  customerPhone,
  onCustomerPhoneChange,
  customerEmail,
  onCustomerEmailChange,
  onSwitchToSearch,
  onSwitchToManual,
}: CustomerStepProps) {
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <Label>Kund</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={customerMode === "search" ? "default" : "ghost"}
            size="sm"
            disabled={!isOnline}
            onClick={onSwitchToSearch}
            className="h-7 text-xs"
          >
            Befintlig
          </Button>
          <Button
            type="button"
            variant={customerMode === "manual" ? "default" : "ghost"}
            size="sm"
            onClick={onSwitchToManual}
            className="h-7 text-xs"
          >
            Ny kund
          </Button>
        </div>
      </div>

      {customerMode === "search" ? (
        <div>
          {selectedCustomer ? (
            <div className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
              <span className="text-sm font-medium">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
                <span className="text-gray-500 ml-2">
                  {selectedCustomer.email}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearCustomer}
                className="h-6 text-xs"
              >
                Byt
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Sök kund (namn eller email)..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
              />
              {isSearching && (
                <div className="absolute right-3 top-3 text-xs text-gray-400">
                  Söker...
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-b-0"
                    >
                      <span className="font-medium">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="text-gray-500 ml-2">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            placeholder="Namn *"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Telefon"
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(e.target.value)}
            />
            <Input
              placeholder="Email"
              type="email"
              value={customerEmail}
              onChange={(e) => onCustomerEmailChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
