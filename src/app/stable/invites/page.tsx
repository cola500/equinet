"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
} from "@/components/ui/responsive-alert-dialog"
import { toast } from "sonner"
import { Copy, MoreHorizontal } from "lucide-react"
import { clientLogger } from "@/lib/client-logger"

interface Invite {
  id: string
  token: string
  email: string
  expiresAt: string
  usedAt: string | null
  createdAt: string
}

type InviteStatusType = "pending" | "accepted" | "expired"

function getInviteStatus(invite: Invite): InviteStatusType {
  if (invite.usedAt) return "accepted"
  if (new Date(invite.expiresAt) < new Date()) return "expired"
  return "pending"
}

function sortInvites(invites: Invite[]): Invite[] {
  const order: Record<InviteStatusType, number> = { pending: 0, accepted: 1, expired: 2 }
  return [...invites].sort((a, b) => {
    const statusDiff = order[getInviteStatus(a)] - order[getInviteStatus(b)]
    if (statusDiff !== 0) return statusDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function StableInvitesPage() {
  const { isLoading: authLoading, isStableOwner } = useAuth()
  const router = useRouter()
  const stableEnabled = useFeatureFlag("stable_profiles")

  // Redirect guard: require stable profile
  useEffect(() => {
    if (!authLoading && !isStableOwner) {
      toast.error("Skapa en stallprofil först")
      router.replace("/stable/profile")
    }
  }, [authLoading, isStableOwner, router])
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)
  const [showOnlyActive, setShowOnlyActive] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/stable/invites")
      if (res.ok) {
        const data = await res.json()
        setInvites(data)
      }
    } catch (err) {
      clientLogger.error("Failed to fetch invites", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isStableOwner && stableEnabled) {
      fetchInvites()
    } else if (!authLoading) {
      setIsLoading(false)
    }
  }, [isStableOwner, stableEnabled, fetchInvites, authLoading])

  const handleEmailBlur = () => {
    if (email.trim() && !isValidEmail(email.trim())) {
      setEmailError("Ange en giltig e-postadress")
    } else {
      setEmailError("")
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !isValidEmail(email.trim())) return

    setIsSending(true)
    setLastInviteUrl(null)
    setEmailError("")
    try {
      const res = await fetch("/api/stable/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()

      if (res.ok) {
        toast.success("Inbjudan skapad -- kopiera länken nedan")
        if (data.inviteUrl) {
          setLastInviteUrl(window.location.origin + data.inviteUrl)
        }
        setEmail("")
        fetchInvites()
      } else {
        toast.error(data.error || "Kunde inte skicka inbjudan")
      }
    } catch (err) {
      clientLogger.error("Failed to send invite", err)
      toast.error("Kunde inte skicka inbjudan")
    } finally {
      setIsSending(false)
    }
  }

  const handleCopyLink = async () => {
    if (!lastInviteUrl) return
    try {
      await navigator.clipboard.writeText(lastInviteUrl)
      toast.success("Länken kopierad!")
    } catch {
      toast.error("Kunde inte kopiera länken")
    }
  }

  const handleResend = async (invite: Invite) => {
    try {
      const res = await fetch("/api/stable/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invite.email }),
      })
      const data = await res.json()

      if (res.ok) {
        toast.success("Ny inbjudan skickad till " + invite.email)
        if (data.inviteUrl) {
          setLastInviteUrl(window.location.origin + data.inviteUrl)
        }
        fetchInvites()
      } else {
        toast.error(data.error || "Kunde inte skicka ny inbjudan")
      }
    } catch (err) {
      clientLogger.error("Failed to resend invite", err)
      toast.error("Kunde inte skicka ny inbjudan")
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    setIsRevoking(true)
    try {
      const res = await fetch(`/api/stable/invites/${revokeTarget.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Inbjudan återkallad")
        setRevokeTarget(null)
        fetchInvites()
      } else {
        const data = await res.json()
        toast.error(data.error || "Kunde inte återkalla inbjudan")
      }
    } catch (err) {
      clientLogger.error("Failed to revoke invite", err)
      toast.error("Kunde inte återkalla inbjudan")
    } finally {
      setIsRevoking(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"
          role="status"
          aria-label="Laddar..."
        />
      </div>
    )
  }

  if (!stableEnabled) {
    return <p className="text-gray-500 py-8">Funktionen är inte tillgänglig just nu.</p>
  }

  if (!isStableOwner) {
    return <p className="text-gray-500 py-8">Du behöver vara stallägare för att hantera inbjudningar.</p>
  }

  const sorted = sortInvites(invites)
  const filtered = showOnlyActive
    ? sorted.filter((i) => getInviteStatus(i) === "pending")
    : sorted

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inbjudningar</h1>

      {/* Send invite form */}
      <Card>
        <CardContent className="py-4">
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <Label htmlFor="invite-email">Bjud in hästägare via e-post</Label>
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <div className="flex-1">
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="namn@exempel.se"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (emailError) setEmailError("")
                    }}
                    onBlur={handleEmailBlur}
                    required
                    aria-describedby={emailError ? "email-error" : undefined}
                    aria-invalid={!!emailError}
                  />
                  {emailError && (
                    <p id="email-error" role="alert" aria-live="polite" className="text-sm text-red-600 mt-1">
                      {emailError}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={isSending || !email.trim()} className="sm:flex-shrink-0">
                  {isSending ? "Skickar..." : "Bjud in"}
                </Button>
              </div>
            </div>
          </form>

          {/* Copy link section */}
          {lastInviteUrl && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600 mb-2">Inbjudningslänk:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-white px-2 py-1 rounded border flex-1 truncate min-w-0">
                  {lastInviteUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="flex-shrink-0"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Kopiera
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Skickade inbjudningar</h2>
          {invites.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOnlyActive(!showOnlyActive)}
            >
              {showOnlyActive ? "Visa alla" : "Visa bara aktiva"}
            </Button>
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <div
              className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"
              role="status"
              aria-label="Laddar..."
            />
            <span>Laddar...</span>
          </div>
        ) : invites.length === 0 ? (
          <p className="text-gray-500">
            Bjud in hästägare som har sina hästar i ditt stall för att koppla dem.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">
            Inga aktiva inbjudningar.{" "}
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => setShowOnlyActive(false)}
            >
              Visa alla
            </button>
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                onResend={handleResend}
                onRevoke={setRevokeTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Revoke confirmation dialog */}
      <ResponsiveAlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>Återkalla inbjudan</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              Är du säker på att du vill återkalla inbjudan till{" "}
              <strong>{revokeTarget?.email}</strong>? Länken kommer sluta fungera.
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel onClick={() => setRevokeTarget(null)}>
              Avbryt
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogAction
              onClick={handleRevoke}
              disabled={isRevoking}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isRevoking ? "Återkallar..." : "Återkalla"}
            </ResponsiveAlertDialogAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </div>
  )
}

function InviteRow({
  invite,
  onResend,
  onRevoke,
}: {
  invite: Invite
  onResend: (invite: Invite) => void
  onRevoke: (invite: Invite) => void
}) {
  const status = getInviteStatus(invite)
  const isPending = status === "pending"

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="font-medium truncate block">{invite.email}</span>
            <div className="text-sm text-gray-500">
              <span>{new Date(invite.createdAt).toLocaleDateString("sv-SE")}</span>
              {isPending && (
                <span className="ml-2">
                  Går ut {new Date(invite.expiresAt).toLocaleDateString("sv-SE")}
                </span>
              )}
              {status === "expired" && (
                <span className="ml-2">
                  Gick ut {new Date(invite.expiresAt).toLocaleDateString("sv-SE")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <InviteStatusBadge status={status} />
            {(isPending || status === "expired") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-11 w-11 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isPending && (
                    <DropdownMenuItem onClick={async () => {
                      const url = `${window.location.origin}/invite/stable/${invite.token}`
                      try {
                        await navigator.clipboard.writeText(url)
                        toast.success("Länken kopierad!")
                      } catch {
                        toast.error("Kunde inte kopiera länken")
                      }
                    }}>
                      <Copy className="h-4 w-4 mr-2" />
                      Kopiera länk
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onResend(invite)}>
                    Skicka igen
                  </DropdownMenuItem>
                  {isPending && (
                    <DropdownMenuItem
                      onClick={() => onRevoke(invite)}
                      className="text-red-600"
                    >
                      Återkalla
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InviteStatusBadge({ status }: { status: InviteStatusType }) {
  switch (status) {
    case "accepted":
      return (
        <span className="text-sm px-2 py-1 rounded bg-green-100 text-green-800">
          Accepterad
        </span>
      )
    case "expired":
      return (
        <span className="text-sm px-2 py-1 rounded bg-gray-100 text-gray-600">
          Utgången
        </span>
      )
    case "pending":
      return (
        <span className="text-sm px-2 py-1 rounded bg-blue-100 text-blue-800">
          Väntande
        </span>
      )
  }
}
