"use client"

import { useState } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Send } from "lucide-react"
import { InfoPopover } from "@/components/ui/info-popover"

const TARGET_LABELS: Record<string, string> = {
  all: "alla användare",
  customers: "alla kunder",
  providers: "alla leverantörer",
}

export default function AdminNotificationsPage() {
  const [target, setTarget] = useState("all")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number } | null>(null)

  const canSend = title.trim().length > 0 && message.trim().length > 0

  const handleSend = async () => {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          title: title.trim(),
          message: message.trim(),
          ...(linkUrl.trim() ? { linkUrl: linkUrl.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Något gick fel")
        return
      }
      const data = await res.json()
      setResult(data)
      setTitle("")
      setMessage("")
      setLinkUrl("")
    } catch {
      alert("Något gick fel")
    } finally {
      setSending(false)
      setShowConfirm(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Skicka notifikation</h1>

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-lg">Systemnotifikation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-sm font-medium text-gray-700">
                  Mottagare
                </label>
                <InfoPopover text="Alla användare = kunder + leverantörer. Notifikationen visas i appen och kan inte ångras efter att den skickats." />
              </div>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla användare</SelectItem>
                  <SelectItem value="customers">Alla kunder</SelectItem>
                  <SelectItem value="providers">Alla leverantörer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Titel
              </label>
              <Input
                placeholder="Viktig uppdatering..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-gray-400 mt-1">{title.length}/100</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Meddelande
              </label>
              <Textarea
                placeholder="Skriv ditt meddelande..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={4}
              />
              <p className="text-xs text-gray-400 mt-1">{message.length}/500</p>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-sm font-medium text-gray-700">
                  Länk (valfri)
                </label>
                <InfoPopover text="Intern sökväg som öppnas när användaren klickar på notifikationen, t.ex. /customer/bookings eller /provider/calendar." />
              </div>
              <Input
                placeholder="/customer/bookings"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                maxLength={200}
              />
            </div>

            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!canSend || sending}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Skicka notifikation
            </Button>

            {result && (
              <div className="p-3 bg-green-50 rounded-md border border-green-200">
                <p className="text-green-700 text-sm font-medium">
                  Notifikation skickad till{" "}
                  <Badge className="bg-green-100 text-green-700">{result.sent}</Badge>{" "}
                  {result.sent === 1 ? "användare" : "användare"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bekräftelsedialog */}
      {showConfirm && (
        <AlertDialog open={true} onOpenChange={() => setShowConfirm(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Skicka notifikation</AlertDialogTitle>
              <AlertDialogDescription>
                Skicka notifikationen &quot;{title}&quot; till{" "}
                <strong>{TARGET_LABELS[target]}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? "Skickar..." : "Skicka"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </AdminLayout>
  )
}
