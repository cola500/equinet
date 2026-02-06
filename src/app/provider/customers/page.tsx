"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { Search, ChevronDown, ChevronUp, User, PawPrint } from "lucide-react"

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

type StatusFilter = "all" | "active" | "inactive"

export default function ProviderCustomersPage() {
  const router = useRouter()
  const { isLoading: authLoading, isProvider } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

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

  const toggleExpand = (customerId: string) => {
    setExpandedCustomer((prev) => (prev === customerId ? null : customerId))
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
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
              : "Du har inga kunder an. Kunder dyker upp har efter avslutade bokningar."}
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
                    <div>
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
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </ProviderLayout>
  )
}
