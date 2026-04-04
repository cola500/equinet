"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { HorseIcon } from "@/components/icons/HorseIcon"
import { CustomerNav } from "./CustomerNav"
import { NotificationBell } from "@/components/notification/NotificationBell"
import { notifyNativeLogout } from "@/lib/native-bridge"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { isDemoMode } from "@/lib/demo-mode"

function useDemoMode(): boolean {
  const flagValue = useFeatureFlag("demo_mode")
  return isDemoMode() || flagValue
}

interface HeaderProps {
  hideSecondaryNav?: boolean
}

export function Header({ hideSecondaryNav = false }: HeaderProps) {
  const { user, isAuthenticated, isLoading, isProvider, isCustomer, isAdmin, isStableOwner } = useAuth()
  const stableEnabled = useFeatureFlag("stable_profiles")
  const demo = useDemoMode()

  const handleLogout = async () => {
    notifyNativeLogout()
    // Clear any lingering NextAuth cookies from pre-migration sessions
    document.cookie = "next-auth.session-token=; Max-Age=0; path=/"
    document.cookie = "__Secure-next-auth.session-token=; Max-Age=0; path=/; secure"
    document.cookie = "next-auth.csrf-token=; Max-Age=0; path=/"
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  return (
    <>
    <header className="bg-white border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-1.5 text-xl md:text-2xl font-bold text-primary">
          <HorseIcon className="h-6 w-6 md:h-7 md:w-7" />
          Equinet
        </Link>
        <div className="flex items-center gap-2 md:gap-4">
          {isLoading ? null : !isAuthenticated ? (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="h-11 px-3 md:px-4">
                  Logga in
                </Button>
              </Link>
              {!demo && (
                <Link href="/register">
                  <Button size="sm" className="h-11 px-3 md:px-4">
                    <span className="hidden sm:inline">Registrera gratis</span>
                    <span className="sm:hidden">Registrera</span>
                  </Button>
                </Link>
              )}
            </>
          ) : (
            <>
            {!demo && <NotificationBell />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-11 px-3 md:px-4 max-w-[150px] md:max-w-none truncate">
                  {user?.name || user?.email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem asChild className="py-3 px-4">
                  <Link href={isProvider ? "/provider/dashboard" : "/dashboard"}>
                    Översikt
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="py-3 px-4">
                  <Link href={isProvider ? "/provider/profile" : "/customer/profile"}>
                    Min profil
                  </Link>
                </DropdownMenuItem>
                {!demo && isStableOwner && stableEnabled && (
                  <DropdownMenuItem asChild className="py-3 px-4">
                    <Link href="/stable/profile">Stallprofil</Link>
                  </DropdownMenuItem>
                )}
                {!demo && isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="py-3 px-4">
                      <Link href="/admin">
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="py-3 px-4">
                  Logga ut
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
    {isAuthenticated && isCustomer && !hideSecondaryNav && !demo && <CustomerNav />}
    </>
  )
}
