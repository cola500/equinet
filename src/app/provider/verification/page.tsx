"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"

// --- Types ---

interface VerificationRequest {
  id: string
  type: string
  title: string
  description: string | null
  status: string
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
}

// --- Constants ---

const TYPE_OPTIONS = [
  { value: "education", label: "Utbildning", description: "T.ex. gesällprov, certifikat" },
  { value: "organization", label: "Organisation", description: "T.ex. medlemskap i branschorganisation" },
  { value: "experience", label: "Erfarenhet", description: "T.ex. antal års verksamhet" },
]

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Under granskning", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Godkänd", color: "bg-green-100 text-green-800" },
  rejected: { label: "Avvisad", color: "bg-red-100 text-red-800" },
}

const TYPE_LABELS: Record<string, string> = {
  education: "Utbildning",
  organization: "Organisation",
  experience: "Erfarenhet",
}

const emptyForm = {
  type: "",
  title: "",
  description: "",
}

// --- Page ---

export default function ProviderVerificationPage() {
  const router = useRouter()
  const { isLoading: authLoading, isProvider } = useAuth()

  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, authLoading, router])

  const fetchRequests = useCallback(async () => {
    try {
      const response = await fetch("/api/verification-requests")
      if (response.ok) {
        const data = await response.json()
        setRequests(data)
      }
    } catch {
      toast.error("Kunde inte hämta verifieringsansökningar")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isProvider) {
      fetchRequests()
    }
  }, [isProvider, fetchRequests])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const response = await fetch("/api/verification-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          description: form.description || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte skapa ansökan")
      }

      toast.success("Verifieringsansökan skickad!")
      setDialogOpen(false)
      setForm(emptyForm)
      fetchRequests()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte skapa ansökan"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length

  if (authLoading || !isProvider) {
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
    <ProviderLayout>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Verifiering</h1>
            <p className="text-gray-600 mt-1">
              Ansök om verifiering genom att skicka in dina meriter.
              Godkända ansökningar ger en verifierings-badge på din profil.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={pendingCount >= 5}>
                Ny ansökan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ny verifieringsansökan</DialogTitle>
                <DialogDescription>
                  Beskriv din merit eller kvalifikation.
                  Vi granskar ansökningar manuellt.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="ver-type">Typ *</Label>
                  <Select
                    value={form.type}
                    onValueChange={(value) =>
                      setForm({ ...form, type: value })
                    }
                  >
                    <SelectTrigger id="ver-type">
                      <SelectValue placeholder="Välj typ..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ver-title">Titel *</Label>
                  <Input
                    id="ver-title"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="T.ex. Wångens gesällprov"
                    required
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor="ver-desc">Beskrivning</Label>
                  <Textarea
                    id="ver-desc"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="Valfri beskrivning av din merit..."
                    rows={3}
                    maxLength={1000}
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={
                      isSaving || !form.type || !form.title.trim()
                    }
                  >
                    {isSaving ? "Skickar..." : "Skicka ansökan"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {pendingCount >= 5 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            Du har 5 väntande ansökningar. Vänta tills befintliga har granskats innan du skickar fler.
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
            <p className="mt-2 text-gray-600">Laddar ansökningar...</p>
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 mb-2">
                Du har inga verifieringsansökningar.
              </p>
              <p className="text-sm text-gray-500">
                Skicka in dina meriter för att få en verifierings-badge.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const statusInfo = STATUS_LABELS[req.status] || STATUS_LABELS.pending
              return (
                <Card key={req.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{req.title}</CardTitle>
                        <CardDescription>
                          {TYPE_LABELS[req.type] || req.type}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className={statusInfo.color}
                      >
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {req.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {req.description}
                      </p>
                    )}
                    {req.reviewNote && (
                      <div className="bg-gray-50 p-3 rounded text-sm mt-2">
                        <span className="font-medium">Granskningskommentar:</span>{" "}
                        {req.reviewNote}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Skickad{" "}
                      {new Date(req.createdAt).toLocaleDateString("sv-SE")}
                      {req.reviewedAt &&
                        ` | Granskad ${new Date(req.reviewedAt).toLocaleDateString("sv-SE")}`}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
    </ProviderLayout>
  )
}
