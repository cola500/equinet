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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ImageUpload } from "@/components/ui/image-upload"
import { toast } from "sonner"

// --- Types ---

interface VerificationImage {
  id: string
  url: string
  mimeType: string
  originalName: string | null
}

interface VerificationRequest {
  id: string
  type: string
  title: string
  description: string | null
  issuer: string | null
  year: number | null
  status: string
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
  images: VerificationImage[]
}

// --- Constants ---

const TYPE_OPTIONS = [
  { value: "education", label: "Utbildning", description: "T.ex. gesällprov, yrkesutbildning" },
  { value: "organization", label: "Organisation", description: "T.ex. medlemskap i branschorganisation" },
  { value: "certificate", label: "Certifikat", description: "T.ex. godkänt certifieringsprov" },
  { value: "experience", label: "Erfarenhet", description: "T.ex. antal års verksamhet" },
  { value: "license", label: "Licens", description: "T.ex. veterinärlicens, yrkeslicens" },
]

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Under granskning", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Godkänd", color: "bg-green-100 text-green-800" },
  rejected: { label: "Avvisad", color: "bg-red-100 text-red-800" },
}

const TYPE_LABELS: Record<string, string> = {
  education: "Utbildning",
  organization: "Organisation",
  certificate: "Certifikat",
  experience: "Erfarenhet",
  license: "Licens",
}

const emptyForm = {
  type: "",
  title: "",
  description: "",
  issuer: "",
  year: "",
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

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

  const handleDialogClose = () => {
    setDialogOpen(false)
    setForm(emptyForm)
    setEditingId(null)
    setCreatedId(null)
    fetchRequests()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const body = {
        type: form.type,
        title: form.title,
        description: form.description || undefined,
        issuer: form.issuer || undefined,
        year: form.year ? parseInt(form.year) : undefined,
      }

      const isEditing = editingId !== null
      const url = isEditing
        ? `/api/verification-requests/${editingId}`
        : "/api/verification-requests"
      const method = isEditing ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Kunde inte spara ansökan")
      }

      if (isEditing) {
        toast.success("Verifieringsansökan uppdaterad!")
        handleDialogClose()
      } else {
        toast.success("Kompetensen är sparad! Du kan nu ladda upp filer.")
        setCreatedId(data.id)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte spara ansökan"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (req: VerificationRequest) => {
    setEditingId(req.id)
    setForm({
      type: req.type,
      title: req.title,
      description: req.description || "",
      issuer: req.issuer || "",
      year: req.year ? String(req.year) : "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/verification-requests/${deleteId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte ta bort ansökan")
      }

      toast.success("Verifieringsansökan borttagen")
      setDeleteId(null)
      fetchRequests()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte ta bort ansökan"
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleImageUploaded = () => {
    // Refresh to show new image
    fetchRequests()
  }

  const handleDeleteImage = async (imageId: string) => {
    try {
      const response = await fetch(`/api/upload/${imageId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte ta bort bilden")
      }

      toast.success("Bilden borttagen")
      fetchRequests()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte ta bort bilden"
      )
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length
  const isEditable = (status: string) => status === "pending" || status === "rejected"

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
            <h1 className="text-3xl font-bold">Kompetenser & Verifiering</h1>
            <p className="text-gray-600 mt-1">
              Lägg till dina utbildningar, certifikat och meriter.
              Godkända kompetenser visas på din profil.
            </p>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                handleDialogClose()
              } else {
                setDialogOpen(true)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={pendingCount >= 5}>
                Ny kompetens
              </Button>
            </DialogTrigger>
            <DialogContent>
              {createdId !== null ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Kompetensen är sparad</DialogTitle>
                    <DialogDescription>
                      Ladda upp bilder eller PDF-filer som styrker din kompetens (valfritt).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <ImageUpload
                      bucket="verifications"
                      entityId={createdId}
                      onUploaded={handleImageUploaded}
                      variant="default"
                      allowPdf
                    />
                    <p className="text-xs text-gray-500">
                      Du kan ladda upp fler filer senare via kompetenskortet.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleDialogClose}>
                      Klar
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>
                      {editingId ? "Redigera kompetens" : "Ny kompetens"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingId
                        ? "Uppdatera informationen. Om ansökan var avvisad återgår den till granskning."
                        : "Beskriv din merit eller kvalifikation. Vi granskar ansökningar manuellt."}
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
                      <Label htmlFor="ver-issuer">Utfärdare</Label>
                      <Input
                        id="ver-issuer"
                        value={form.issuer}
                        onChange={(e) =>
                          setForm({ ...form, issuer: e.target.value })
                        }
                        placeholder="T.ex. Wången, SHF"
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ver-year">År</Label>
                      <Input
                        id="ver-year"
                        type="number"
                        value={form.year}
                        onChange={(e) =>
                          setForm({ ...form, year: e.target.value })
                        }
                        placeholder="T.ex. 2020"
                        min={1900}
                        max={2100}
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
                        {isSaving
                          ? "Sparar..."
                          : editingId
                            ? "Spara ändringar"
                            : "Skicka ansökan"}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
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
                Du har inga kompetenser tillagda.
              </p>
              <p className="text-sm text-gray-500">
                Lägg till dina utbildningar och certifikat för att visa dem på din profil.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const statusInfo = STATUS_LABELS[req.status] || STATUS_LABELS.pending
              const canEdit = isEditable(req.status)
              return (
                <Card key={req.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{req.title}</CardTitle>
                        <CardDescription>
                          {TYPE_LABELS[req.type] || req.type}
                          {req.issuer && ` - ${req.issuer}`}
                          {req.year && ` (${req.year})`}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={statusInfo.color}
                        >
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {req.description && (
                      <p className="text-sm text-gray-600 mb-3">
                        {req.description}
                      </p>
                    )}

                    {/* Images */}
                    {req.images && req.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {req.images.map((img) => (
                          <div key={img.id} className="relative group">
                            {img.mimeType === "application/pdf" ? (
                              <a
                                href={img.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-20 h-20 rounded border border-gray-200 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors p-1"
                                title={img.originalName || "PDF"}
                              >
                                <svg className="h-6 w-6 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4z" />
                                </svg>
                                <span className="text-[10px] text-gray-500 mt-0.5 text-center line-clamp-2 break-all leading-tight">
                                  {img.originalName || "PDF"}
                                </span>
                              </a>
                            ) : (
                              <img
                                src={img.url}
                                alt="Verifieringsbild"
                                className="w-20 h-20 object-cover rounded cursor-pointer border border-gray-200"
                                onClick={() => setLightboxImage(img.url)}
                              />
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteImage(img.id)}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Ta bort"
                              >
                                x
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload images (only for editable posts) */}
                    {canEdit && (req.images?.length || 0) < 5 && (
                      <div className="mb-3">
                        <ImageUpload
                          bucket="verifications"
                          entityId={req.id}
                          onUploaded={handleImageUploaded}
                          variant="default"
                          className="max-w-xs"
                          allowPdf
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          {req.images?.length || 0}/5 filer
                        </p>
                      </div>
                    )}

                    {req.reviewNote && (
                      <div className="bg-gray-50 p-3 rounded text-sm mt-2">
                        <span className="font-medium">Granskningskommentar:</span>{" "}
                        {req.reviewNote}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-gray-400">
                        Skickad{" "}
                        {new Date(req.createdAt).toLocaleDateString("sv-SE")}
                        {req.reviewedAt &&
                          ` | Granskad ${new Date(req.reviewedAt).toLocaleDateString("sv-SE")}`}
                      </p>

                      {canEdit && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(req)}
                          >
                            Redigera
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteId(req.id)}
                          >
                            Ta bort
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ta bort kompetens?</AlertDialogTitle>
              <AlertDialogDescription>
                Denna åtgärd kan inte ångras. Kompetensen och alla tillhörande bilder tas bort.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? "Tar bort..." : "Ta bort"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Image Lightbox */}
        <Dialog open={lightboxImage !== null} onOpenChange={(open) => !open && setLightboxImage(null)}>
          <DialogContent className="max-w-3xl p-2">
            <DialogHeader className="sr-only">
              <DialogTitle>Bild</DialogTitle>
            </DialogHeader>
            {lightboxImage && (
              <img
                src={lightboxImage}
                alt="Verifieringsbild"
                className="w-full h-auto rounded"
              />
            )}
          </DialogContent>
        </Dialog>
    </ProviderLayout>
  )
}
