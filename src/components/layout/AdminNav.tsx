"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Star,
  ShieldCheck,
  Plug,
  Activity,
  Bell,
  ClipboardCheck,
  Bug,
} from "lucide-react"
import { BottomTabBar } from "./BottomTabBar"
import type { TabItem, MoreMenuItem } from "./BottomTabBar"

const navItems = [
  { href: "/admin", label: "Översikt", icon: LayoutDashboard },
  { href: "/admin/users", label: "Användare", icon: Users },
  { href: "/admin/bookings", label: "Bokningar", icon: CalendarDays },
  { href: "/admin/reviews", label: "Recensioner", icon: Star },
  { href: "/admin/verifications", label: "Verifieringar", icon: ShieldCheck },
  { href: "/admin/bug-reports", label: "Buggrapporter", icon: Bug },
  { href: "/admin/integrations", label: "Integrationer", icon: Plug },
  { href: "/admin/system", label: "System", icon: Activity },
  { href: "/admin/notifications", label: "Notifikationer", icon: Bell },
  { href: "/admin/testing-guide", label: "Testningsguide", icon: ClipboardCheck },
]

const mobileTabs: TabItem[] = [
  { href: "/admin", label: "Översikt", icon: LayoutDashboard },
  { href: "/admin/users", label: "Användare", icon: Users, matchPrefix: "/admin/users" },
  { href: "/admin/bookings", label: "Bokningar", icon: CalendarDays, matchPrefix: "/admin/bookings" },
  { href: "/admin/system", label: "System", icon: Activity, matchPrefix: "/admin/system" },
]

const mobileMoreItems: MoreMenuItem[] = [
  { href: "/admin/reviews", label: "Recensioner", icon: Star, matchPrefix: "/admin/reviews" },
  { href: "/admin/verifications", label: "Verifieringar", icon: ShieldCheck, matchPrefix: "/admin/verifications" },
  { href: "/admin/bug-reports", label: "Buggar", icon: Bug, matchPrefix: "/admin/bug-reports" },
  { href: "/admin/integrations", label: "Integrationer", icon: Plug, matchPrefix: "/admin/integrations" },
  { href: "/admin/notifications", label: "Notifikationer", icon: Bell, matchPrefix: "/admin/notifications" },
  { href: "/admin/testing-guide", label: "Testguide", icon: ClipboardCheck, matchPrefix: "/admin/testing-guide" },
]

export function AdminNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin"
    return pathname?.startsWith(href)
  }

  const linkClasses = (href: string) => {
    const active = isActive(href)
    return `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      active
        ? "bg-green-50 text-green-700 font-medium"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-56 shrink-0 border-r bg-white p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
          Administration
        </p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClasses(item.href)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile bottom tab bar */}
      <BottomTabBar tabs={mobileTabs} moreItems={mobileMoreItems} />
    </>
  )
}
