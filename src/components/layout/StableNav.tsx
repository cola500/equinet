"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  LayoutGrid,
  Mail,
  User,
  ArrowLeftRight,
} from "lucide-react"
import { BottomTabBar, type TabItem, type MoreMenuItem } from "./BottomTabBar"
import { useAuth } from "@/hooks/useAuth"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { toast } from "sonner"

const allStableTabs: TabItem[] = [
  { href: "/stable/dashboard", label: "Översikt", icon: Home },
  { href: "/stable/spots", label: "Platser", icon: LayoutGrid },
  { href: "/stable/invites", label: "Inbjudningar", icon: Mail },
  { href: "/stable/profile", label: "Stallprofil", icon: User },
]

const allNavItems = [
  { href: "/stable/dashboard", label: "Översikt" },
  { href: "/stable/spots", label: "Stallplatser" },
  { href: "/stable/invites", label: "Inbjudningar" },
  { href: "/stable/profile", label: "Stallprofil" },
]

export function StableNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { isProvider, isCustomer, isStableOwner, isLoading } = useAuth()
  const isOnline = useOnlineStatus()

  // Hide Platser + Inbjudningar tabs until auth resolves and user has a stable profile
  const showAllTabs = !isLoading && isStableOwner
  const stableTabs = showAllTabs
    ? allStableTabs
    : allStableTabs.filter((t) => t.href === "/stable/dashboard" || t.href === "/stable/profile")
  const navItems = showAllTabs
    ? allNavItems
    : allNavItems.filter((n) => n.href === "/stable/dashboard" || n.href === "/stable/profile")

  const stableMoreItems: MoreMenuItem[] = [
    ...(isProvider ? [{ href: "/provider/dashboard", label: "Leverantörsvy", icon: ArrowLeftRight, section: "Byt vy" }] : []),
    ...(isCustomer ? [{ href: "/dashboard", label: "Kundvy", icon: ArrowLeftRight, section: "Byt vy" }] : []),
  ]

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!isOnline) {
      e.preventDefault()
      toast.error("Inte tillgänglig offline")
      return
    }
    // Already on this page
    if (pathname === href) {
      e.preventDefault()
    }
  }

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:block bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 h-12">
            {/* Role switcher */}
            <div className="mr-4 flex items-center bg-gray-100 rounded-lg p-1" aria-label="Byt vy">
              <span className="text-xs text-gray-500 mr-1">Vy:</span>
              <span className="text-sm font-medium bg-white rounded-md shadow-sm px-3 py-1.5">
                Stall
              </span>
              {isProvider && (
                <button
                  onClick={() => router.push("/provider/dashboard")}
                  aria-label="Byt till leverantörsvy"
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md min-h-[36px] flex items-center"
                >
                  Leverantör
                </button>
              )}
              {isCustomer && (
                <button
                  onClick={() => router.push("/dashboard")}
                  aria-label="Byt till kundvy"
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md min-h-[36px] flex items-center"
                >
                  Kund
                </button>
              )}
            </div>

            <div className="h-6 w-px bg-gray-200 mr-2" />

            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleLinkClick(e, item.href)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <BottomTabBar tabs={stableTabs} moreItems={stableMoreItems} />
    </>
  )
}
