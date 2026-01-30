"use client"

import { useState } from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"
import { CustomerLayout } from "@/components/layout/CustomerLayout"

export default function ExportPage() {
  const router = useRouter()
  const { isLoading: authLoading, isCustomer } = useAuth()
  const [isExporting, setIsExporting] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(format)
    try {
      const url =
        format === "csv"
          ? "/api/export/my-data?format=csv"
          : "/api/export/my-data"

      const response = await fetch(url)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte exportera data")
      }

      if (format === "csv") {
        // Download CSV file
        const blob = await response.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = downloadUrl
        a.download =
          response.headers
            .get("content-disposition")
            ?.match(/filename="(.+)"/)?.[1] ||
          `equinet-export-${new Date().toISOString().split("T")[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(downloadUrl)
        a.remove()
        toast.success("CSV-fil nedladdad!")
      } else {
        // Download JSON file
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        })
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = downloadUrl
        a.download = `equinet-export-${new Date().toISOString().split("T")[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(downloadUrl)
        a.remove()
        toast.success("JSON-fil nedladdad!")
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte exportera data"
      )
    } finally {
      setIsExporting(null)
    }
  }

  if (authLoading || !isCustomer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  return (
    <CustomerLayout>
      <h1 className="text-3xl font-bold mb-2">Exportera mina data</h1>
      <p className="text-gray-600 mb-8">
        Ladda ner all din data i enlighet med GDPR (dataporterbarhet, artikel
        20). Exporten innehåller din profil, hästar, bokningar, anteckningar och
        recensioner.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>JSON-format</CardTitle>
            <CardDescription>
              Strukturerad data som kan användas i andra system. Bäst för
              tekniskt bruk eller import till andra tjänster.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleExport("json")}
              disabled={isExporting !== null}
              className="w-full"
            >
              {isExporting === "json" ? "Exporterar..." : "Ladda ner JSON"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CSV-format</CardTitle>
            <CardDescription>
              Tabellformat som kan öppnas i Excel eller Google Sheets. Bäst för
              att läsa igenom data eller göra egna sammanställningar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleExport("csv")}
              disabled={isExporting !== null}
              variant="outline"
              className="w-full"
            >
              {isExporting === "csv" ? "Exporterar..." : "Ladda ner CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardContent className="py-6">
          <h3 className="font-semibold mb-2">Vad ingår i exporten?</h3>
          <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
            <li>Din profil (namn, email, telefon, adress)</li>
            <li>Alla dina registrerade hästar</li>
            <li>Alla bokningar (genomförda, kommande, avbokade)</li>
            <li>Anteckningar du skapat för dina hästar</li>
            <li>Recensioner du skrivit</li>
          </ul>
          <p className="text-xs text-gray-400 mt-4">
            Lösenord och interna system-ID exporteras aldrig.
          </p>
        </CardContent>
      </Card>
    </CustomerLayout>
  )
}
