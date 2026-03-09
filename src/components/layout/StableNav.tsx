"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  MapPin,
  Mail,
  User,
} from "lucide-react"
import { BottomTabBar, type TabItem } from "./BottomTabBar"
import { useAuth } from "@/hooks/useAuth"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { toast } from "sonner"

const stableTabs: TabItem[] = [
  { href: "/stable/dashboard", label: "Oversikt", icon: Home },
  { href: "/stable/spots", label: "Platser", icon: MapPin },
  { href: "/stable/invites", label: "Inbjudningar", icon: Mail },
  { href: "/stable/profile", label: "Profil", icon: User },
]

const navItems = [
  { href: "/stable/dashboard", label: "Oversikt" },
  { href: "/stable/spots", label: "Stallplatser" },
  { href: "/stable/invites", label: "Inbjudningar" },
  { href: "/stable/profile", label: "Min profil" },
]

export function StableNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { isProvider, isCustomer } = useAuth()
  const isOnline = useOnlineStatus()

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!isOnline) {
      e.preventDefault()
      toast.error("Inte tillganglig offline")
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
            <div className="mr-4 flex items-center gap-2">
              <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                Stall
              </span>
              {isProvider && (
                <button
                  onClick={() => router.push("/provider/dashboard")}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Leverantor
                </button>
              )}
              {isCustomer && (
                <button
                  onClick={() => router.push("/dashboard")}
                  className="text-xs text-gray-500 hover:text-gray-700"
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
      <BottomTabBar tabs={stableTabs} moreItems={[]} />
    </>
  )
}
