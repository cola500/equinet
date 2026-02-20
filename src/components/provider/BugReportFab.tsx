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
import { useFeatureFlag, useFeatureFlags } from "@/components/providers/FeatureFlagProvider"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useAuth } from "@/hooks/useAuth"
import { getDebugLogs } from "@/lib/offline/debug-logger"
import { submitBugReport } from "@/lib/offline/bug-report"

export function BugReportFab() {
  const enabled = useFeatureFlag("offline_mode")
  const featureFlags = useFeatureFlags()
  const isOnline = useOnlineStatus()
  const { isAuthenticated } = useAuth()
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [reportText, setReportText] = useState<string | null>(null)

  if (!enabled) return null

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const logs = await getDebugLogs({ limit: 50 })

      const report = await submitBugReport({
        description: description || "(Ingen beskrivning)",
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        isStandalone: window.matchMedia("(display-mode: standalone)").matches,
        isOnline,
        isAuthenticated,
        currentUrl: pathname,
        featureFlags,
        debugLogs: logs,
      })

      // Try native share API (mobile)
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Equinet buggrapport",
            text: report,
          })
          toast.success("Rapport delad")
          setDescription("")
          setOpen(false)
          return
        } catch (err) {
          // User cancelled share - not an error
          if (err instanceof Error && err.name === "AbortError") return
          // Other share error - fall through to textarea
        }
      }

      // Fallback: show report in textarea for manual copy
      setReportText(report)
    } catch {
      toast.error("Kunde inte skapa rapport")
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setDescription("")
    setReportText(null)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Rapportera fel"
        className="fixed right-4 bottom-[calc(56px+env(safe-area-inset-bottom)+12px)] z-50 flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-colors hover:bg-red-700 md:bottom-6"
      >
        <Bug className="h-5 w-5" />
      </button>

      <Drawer open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Rapportera fel</DrawerTitle>
            <DrawerDescription>
              {reportText
                ? "Rapporten kunde inte delas automatiskt. Markera texten och kopiera den manuellt."
                : "Beskriv vad som gick fel. Rapporten inkluderar automatiskt debug-loggar och enhetsinformation."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4">
            {reportText ? (
              <textarea
                readOnly
                aria-label="Buggrapport"
                value={reportText}
                rows={10}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full rounded-md border border-gray-300 bg-gray-50 p-3 font-mono text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            ) : (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beskriv problemet..."
                rows={4}
                className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            )}
          </div>

          <DrawerFooter>
            {reportText ? (
              <Button variant="outline" onClick={handleClose}>
                Stäng
              </Button>
            ) : (
              <>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Skapar..." : "Skapa rapport"}
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
