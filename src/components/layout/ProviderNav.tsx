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
  BarChart3,
} from "lucide-react"
import { BottomTabBar, type TabItem, type MoreMenuItem } from "./BottomTabBar"
import { useFeatureFlags } from "@/components/providers/FeatureFlagProvider"

interface NavItem {
  href: string
  label: string
  matchPrefix?: string
  featureFlag?: string
}

interface MoreItem extends MoreMenuItem {
  featureFlag?: string
}

const providerTabs: TabItem[] = [
  { href: "/provider/dashboard", label: "Översikt", icon: LayoutDashboard },
  { href: "/provider/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/provider/bookings", label: "Bokningar", icon: ClipboardList },
]

const providerMoreItems: MoreItem[] = [
  { href: "/provider/services", label: "Mina tjänster", icon: Wrench },
  { href: "/provider/voice-log", label: "Logga arbete", icon: Mic, matchPrefix: "/provider/voice-log", featureFlag: "voice_logging" },
  { href: "/provider/route-planning", label: "Ruttplanering", icon: Route, matchPrefix: "/provider/route", featureFlag: "route_planning" },
  { href: "/provider/announcements", label: "Rutt-annonser", icon: Megaphone, matchPrefix: "/provider/announcements", featureFlag: "route_announcements" },
  { href: "/provider/customers", label: "Kunder", icon: Users, matchPrefix: "/provider/customers" },
  { href: "/provider/due-for-service", label: "Besöksplanering", icon: Clock, matchPrefix: "/provider/due-for-service", featureFlag: "due_for_service" },
  { href: "/provider/group-bookings", label: "Gruppbokningar", icon: UserPlus, matchPrefix: "/provider/group-bookings", featureFlag: "group_bookings" },
  { href: "/provider/insights", label: "Insikter", icon: BarChart3, matchPrefix: "/provider/insights", featureFlag: "business_insights" },
  { href: "/provider/reviews", label: "Recensioner", icon: Star },
  { href: "/provider/profile", label: "Min profil", icon: User },
]

const navItems: NavItem[] = [
  { href: "/provider/dashboard", label: "Översikt" },
  { href: "/provider/calendar", label: "Kalender" },
  { href: "/provider/bookings", label: "Bokningar" },
  { href: "/provider/voice-log", label: "Logga arbete", matchPrefix: "/provider/voice-log", featureFlag: "voice_logging" },
  { href: "/provider/services", label: "Mina tjänster" },
  { href: "/provider/route-planning", label: "Ruttplanering", matchPrefix: "/provider/route", featureFlag: "route_planning" },
  { href: "/provider/announcements", label: "Rutt-annonser", matchPrefix: "/provider/announcements", featureFlag: "route_announcements" },
  { href: "/provider/customers", label: "Kunder", matchPrefix: "/provider/customers" },
  { href: "/provider/due-for-service", label: "Besöksplanering", matchPrefix: "/provider/due-for-service", featureFlag: "due_for_service" },
  { href: "/provider/group-bookings", label: "Gruppbokningar", matchPrefix: "/provider/group-bookings", featureFlag: "group_bookings" },
  { href: "/provider/insights", label: "Insikter", matchPrefix: "/provider/insights", featureFlag: "business_insights" },
  { href: "/provider/reviews", label: "Recensioner" },
  { href: "/provider/profile", label: "Min profil" },
]

export function ProviderNav() {
  const pathname = usePathname()
  const flags = useFeatureFlags()

  const isVisible = (item: { featureFlag?: string }) =>
    !item.featureFlag || flags[item.featureFlag]

  const visibleNavItems = navItems.filter(isVisible)
  const visibleMoreItems = providerMoreItems.filter(isVisible)

  const isActive = (item: NavItem) => {
    if (item.matchPrefix) {
      return pathname?.startsWith(item.matchPrefix)
    }
    return pathname === item.href
  }

  const linkClasses = (item: NavItem) => {
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
            {visibleNavItems.map((item) => (
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
      <BottomTabBar tabs={providerTabs} moreItems={visibleMoreItems} />
    </>
  )
}
