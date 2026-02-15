"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Wrench,
  Route,
  Megaphone,
  Users,
  Clock,
  UserPlus,
  Star,
  User,
  Mic,
} from "lucide-react"
import { BottomTabBar, type TabItem, type MoreMenuItem } from "./BottomTabBar"

const providerTabs: TabItem[] = [
  { href: "/provider/dashboard", label: "Översikt", icon: LayoutDashboard },
  { href: "/provider/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/provider/bookings", label: "Bokningar", icon: ClipboardList },
]

const providerMoreItems: MoreMenuItem[] = [
  { href: "/provider/services", label: "Mina tjänster", icon: Wrench },
  { href: "/provider/voice-log", label: "Röstlogg", icon: Mic, matchPrefix: "/provider/voice-log" },
  { href: "/provider/route-planning", label: "Ruttplanering", icon: Route, matchPrefix: "/provider/route" },
  { href: "/provider/announcements", label: "Rutt-annonser", icon: Megaphone, matchPrefix: "/provider/announcements" },
  { href: "/provider/customers", label: "Kunder", icon: Users, matchPrefix: "/provider/customers" },
  { href: "/provider/due-for-service", label: "Besöksplanering", icon: Clock, matchPrefix: "/provider/due-for-service" },
  { href: "/provider/group-bookings", label: "Gruppförfrågningar", icon: UserPlus, matchPrefix: "/provider/group-bookings" },
  { href: "/provider/reviews", label: "Recensioner", icon: Star },
  { href: "/provider/profile", label: "Min profil", icon: User },
]

const navItems = [
  { href: "/provider/dashboard", label: "Översikt" },
  { href: "/provider/calendar", label: "Kalender" },
  { href: "/provider/bookings", label: "Bokningar" },
  { href: "/provider/voice-log", label: "Röstlogg", matchPrefix: "/provider/voice-log" },
  { href: "/provider/services", label: "Mina tjänster" },
  { href: "/provider/route-planning", label: "Ruttplanering", matchPrefix: "/provider/route" },
  { href: "/provider/announcements", label: "Rutt-annonser", matchPrefix: "/provider/announcements" },
  { href: "/provider/customers", label: "Kunder", matchPrefix: "/provider/customers" },
  { href: "/provider/due-for-service", label: "Besöksplanering", matchPrefix: "/provider/due-for-service" },
  { href: "/provider/group-bookings", label: "Gruppförfrågningar", matchPrefix: "/provider/group-bookings" },
  { href: "/provider/reviews", label: "Recensioner" },
  { href: "/provider/profile", label: "Min profil" },
]

export function ProviderNav() {
  const pathname = usePathname()

  const isActive = (item: typeof navItems[0]) => {
    if (item.matchPrefix) {
      return pathname?.startsWith(item.matchPrefix)
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
                className={linkClasses(item)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <BottomTabBar tabs={providerTabs} moreItems={providerMoreItems} />
    </>
  )
}
