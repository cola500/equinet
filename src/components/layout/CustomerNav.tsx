"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Search,
  CalendarDays,
  PawPrint,
  MapPin,
  Users,
  HelpCircle,
  User,
  Shield,
} from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { BottomTabBar, type TabItem, type MoreMenuItem } from "./BottomTabBar"

const customerTabs: TabItem[] = [
  { href: "/providers", label: "Sök", icon: Search, matchPrefix: "/providers" },
  { href: "/customer/bookings", label: "Bokningar", icon: CalendarDays },
  { href: "/customer/horses", label: "Hästar", icon: PawPrint },
]

const customerMoreItems: MoreMenuItem[] = [
  { href: "/announcements", label: "Planerade rutter", icon: MapPin, matchPrefix: "/announcements" },
  { href: "/customer/group-bookings", label: "Gruppförfrågningar", icon: Users, matchPrefix: "/customer/group-bookings" },
  { href: "/customer/faq", label: "Vanliga frågor", icon: HelpCircle },
  { href: "/customer/profile", label: "Min profil", icon: User },
]

const allNavItems = [
  { href: "/providers", label: "Hitta tjänster", matchPrefix: "/providers" },
  { href: "/customer/bookings", label: "Mina bokningar" },
  { href: "/announcements", label: "Planerade rutter", matchPrefix: "/announcements" },
  { href: "/customer/group-bookings", label: "Gruppförfrågningar", matchPrefix: "/customer/group-bookings" },
  { href: "/customer/horses", label: "Mina hästar" },
  { href: "/customer/faq", label: "Vanliga frågor" },
  { href: "/customer/profile", label: "Min profil" },
]

export function CustomerNav() {
  const pathname = usePathname()
  const { isAdmin } = useAuth()

  const navItems = [
    ...allNavItems,
    ...(isAdmin ? [{ href: "/admin/verifications", label: "Admin", matchPrefix: "/admin" }] : []),
  ]

  const moreItems: MoreMenuItem[] = [
    ...customerMoreItems,
    ...(isAdmin ? [{ href: "/admin/verifications", label: "Admin", icon: Shield, matchPrefix: "/admin" }] : []),
  ]

  const isActive = (item: typeof navItems[0]) => {
    if (item.matchPrefix) {
      return pathname.startsWith(item.matchPrefix)
    }
    return pathname === item.href
  }

  const linkClasses = (item: typeof navItems[0]) => {
    const active = isActive(item)
    return `py-3 ${
      active
        ? "border-b-2 border-green-600 text-green-600 font-medium"
        : "text-gray-600 hover:text-gray-900"
    }`
  }

  return (
    <>
      {/* Desktop navigation */}
      <nav className="bg-white border-b hidden md:block">
        <div className="container mx-auto px-4">
          <div className="flex gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item) ? "page" : undefined}
                className={linkClasses(item)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <BottomTabBar tabs={customerTabs} moreItems={moreItems} />
    </>
  )
}
