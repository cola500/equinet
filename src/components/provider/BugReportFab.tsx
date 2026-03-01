"use client"

import { useState } from "react"
import { Bug } from "lucide-react"
import { toast } from "sonner"
import { usePathname } from "next/navigation"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"

export function BugReportFab() {
  const { isAuthenticated } = useAuth()
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [reproductionSteps, setReproductionSteps] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  if (!isAuthenticated) return null

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) {
      toast.error("Titel och beskrivning krävs")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          reproductionSteps: reproductionSteps.trim() || undefined,
          pageUrl: pathname,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Kunde inte skicka rapport")
      }

      const data = await res.json()
      setSubmittedId(data.id)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte skicka rapport"
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setTitle("")
    setDescription("")
    setReproductionSteps("")
    setSubmittedId(null)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Rapportera fel"
        className="fixed right-4 bottom-40 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-colors hover:bg-red-700 md:bottom-6"
      >
        <Bug className="h-5 w-5" />
      </button>

      <Drawer
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleClose()
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {submittedId ? "Tack!" : "Rapportera fel"}
            </DrawerTitle>
            <DrawerDescription>
              {submittedId
                ? "Vi har tagit emot din rapport."
                : "Beskriv vad som gick fel så undersöker vi det."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-4">
            {submittedId ? (
              <div className="rounded-md bg-green-50 p-4 text-sm">
                <p className="font-medium text-green-800">Rapport mottagen</p>
                <p className="mt-1 text-green-700">
                  Referens-ID:{" "}
                  <code className="rounded bg-green-100 px-1 py-0.5 font-mono text-xs">
                    {submittedId}
                  </code>
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="bug-title">Titel *</Label>
                  <Input
                    id="bug-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Kort beskrivning av problemet"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bug-description">Beskrivning *</Label>
                  <textarea
                    id="bug-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Vad hände? Vad förväntade du dig?"
                    rows={3}
                    maxLength={5000}
                    className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bug-steps">
                    Steg för att återskapa (valfritt)
                  </Label>
                  <textarea
                    id="bug-steps"
                    value={reproductionSteps}
                    onChange={(e) => setReproductionSteps(e.target.value)}
                    placeholder={"1. Gå till...\n2. Klicka på...\n3. Se felet..."}
                    rows={3}
                    maxLength={5000}
                    className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          <DrawerFooter>
            {submittedId ? (
              <Button variant="outline" onClick={handleClose}>
                Stäng
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    submitting || !title.trim() || !description.trim()
                  }
                >
                  {submitting ? "Skickar..." : "Skicka rapport"}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline">Avbryt</Button>
                </DrawerClose>
              </>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
