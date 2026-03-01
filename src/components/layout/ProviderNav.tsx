"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Stethoscope,
  Route,
  Megaphone,
  Users,
  Clock,
  UserPlus,
  Star,
  User,
  Mic,
  BarChart3,
  ChevronDown,
  HelpCircle,
} from "lucide-react"
import { BottomTabBar, type TabItem, type MoreMenuItem } from "./BottomTabBar"
import { useFeatureFlags } from "@/components/providers/FeatureFlagProvider"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { toast } from "sonner"

interface NavItem {
  href: string
  label: string
  matchPrefix?: string
  featureFlag?: string
  offlineSafe?: boolean
}

interface MoreItem extends MoreMenuItem {
  featureFlag?: string
  section?: string
}

const providerTabs: TabItem[] = [
  { href: "/provider/dashboard", label: "Översikt", icon: LayoutDashboard, offlineSafe: true },
  { href: "/provider/calendar", label: "Kalender", icon: CalendarDays, offlineSafe: true },
  { href: "/provider/bookings", label: "Bokningar", icon: ClipboardList, offlineSafe: true },
]

const providerMoreItems: MoreItem[] = [
  { href: "/provider/services", label: "Mina tjänster", icon: Stethoscope, section: "Dagligt arbete" },
  { href: "/provider/voice-log", label: "Logga arbete", icon: Mic, matchPrefix: "/provider/voice-log", featureFlag: "voice_logging", section: "Dagligt arbete" },
  { href: "/provider/customers", label: "Kunder", icon: Users, matchPrefix: "/provider/customers", section: "Dagligt arbete" },
  { href: "/provider/route-planning", label: "Ruttplanering", icon: Route, matchPrefix: "/provider/route", featureFlag: "route_planning", section: "Planering" },
  { href: "/provider/announcements", label: "Rutt-annonser", icon: Megaphone, matchPrefix: "/provider/announcements", featureFlag: "route_announcements", section: "Planering" },
  { href: "/provider/due-for-service", label: "Besöksplanering", icon: Clock, matchPrefix: "/provider/due-for-service", featureFlag: "due_for_service", section: "Planering" },
  { href: "/provider/group-bookings", label: "Gruppbokningar", icon: UserPlus, matchPrefix: "/provider/group-bookings", featureFlag: "group_bookings", section: "Planering" },
  { href: "/provider/insights", label: "Insikter", icon: BarChart3, matchPrefix: "/provider/insights", featureFlag: "business_insights", section: "Mitt företag" },
  { href: "/provider/reviews", label: "Recensioner", icon: Star, section: "Mitt företag" },
  { href: "/provider/help", label: "Hjälp", icon: HelpCircle, matchPrefix: "/provider/help", featureFlag: "help_center", section: "Mitt företag" },
  { href: "/provider/profile", label: "Min profil", icon: User, section: "Mitt företag" },
]

// Primary nav items always visible on desktop (max 6)
const primaryNavItems: NavItem[] = [
  { href: "/provider/dashboard", label: "Översikt", offlineSafe: true },
  { href: "/provider/calendar", label: "Kalender", offlineSafe: true },
  { href: "/provider/bookings", label: "Bokningar", offlineSafe: true },
  { href: "/provider/services", label: "Mina tjänster" },
  { href: "/provider/customers", label: "Kunder", matchPrefix: "/provider/customers" },
  { href: "/provider/reviews", label: "Recensioner" },
]

// Secondary nav items in "Mer" dropdown on desktop
const secondaryNavItems: (NavItem & { section?: string })[] = [
  { href: "/provider/voice-log", label: "Logga arbete", matchPrefix: "/provider/voice-log", featureFlag: "voice_logging", section: "Dagligt arbete" },
  { href: "/provider/route-planning", label: "Ruttplanering", matchPrefix: "/provider/route", featureFlag: "route_planning", section: "Planering" },
  { href: "/provider/announcements", label: "Rutt-annonser", matchPrefix: "/provider/announcements", featureFlag: "route_announcements", section: "Planering" },
  { href: "/provider/due-for-service", label: "Besöksplanering", matchPrefix: "/provider/due-for-service", featureFlag: "due_for_service", section: "Planering" },
  { href: "/provider/group-bookings", label: "Gruppbokningar", matchPrefix: "/provider/group-bookings", featureFlag: "group_bookings", section: "Planering" },
  { href: "/provider/insights", label: "Insikter", matchPrefix: "/provider/insights", featureFlag: "business_insights", section: "Mitt företag" },
  { href: "/provider/help", label: "Hjälp", matchPrefix: "/provider/help", featureFlag: "help_center", section: "Mitt företag" },
  { href: "/provider/profile", label: "Min profil", section: "Mitt företag" },
]

const OFFLINE_SAFE_PATHS = providerTabs
  .filter((t) => t.offlineSafe)
  .map((t) => t.href)

/**
 * Module-level guard: warm the RSC navigation cache only once per page session.
 *
 * router.prefetch() caches in `pages-rsc-prefetch` (with Next-Router-Prefetch header),
 * but navigation requests look in `pages-rsc` (without that header). This raw fetch
 * populates the correct cache so offline navigation works via SW cache hit.
 */
let rscCacheWarmed = false

function warmRscCache() {
  if (rscCacheWarmed) return
  rscCacheWarmed = true

  OFFLINE_SAFE_PATHS.forEach((path) => {
    fetch(path, {
      headers: { RSC: "1" },
    }).catch(() => {
      // Fetch failed (offline already?) -- reset guard so next mount retries
      rscCacheWarmed = false
    })
  })
}

/** Reset guard for tests */
export function _resetRscCacheWarmed() {
  rscCacheWarmed = false
}

export function ProviderNav() {
  const pathname = usePathname()
  const router = useRouter()
  const flags = useFeatureFlags()
  const isOnline = useOnlineStatus()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }
    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [moreOpen])

  // Close dropdown on navigation
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  // Prefetch offline-safe tabs so RSC payloads are cached for offline navigation
  useEffect(() => {
    if (flags.offline_mode) {
      OFFLINE_SAFE_PATHS.forEach((path) => router.prefetch(path))
      warmRscCache()
    }
  }, [flags.offline_mode, router])

  const isVisible = (item: { featureFlag?: string }) =>
    !item.featureFlag || flags[item.featureFlag]

  const visibleSecondaryItems = secondaryNavItems.filter(isVisible)
  const visibleMoreItems = providerMoreItems.filter(isVisible)

  const isActive = (item: NavItem) => {
    if (item.matchPrefix) {
      return pathname?.startsWith(item.matchPrefix)
    }
    return pathname === item.href
  }

  // Check if any secondary item is active (for "Mer" button highlight)
  const isSecondaryActive = visibleSecondaryItems.some(isActive)

  function handleOfflineClick(e: React.MouseEvent, item: NavItem) {
    if (!isOnline && !isActive(item)) {
      if (!item.offlineSafe) {
        e.preventDefault()
        toast.error("Du är offline. Navigering kräver internetanslutning.")
      } else {
        // offlineSafe: hard navigate to bypass RSC fetch and use SW document cache
        e.preventDefault()
        window.location.href = item.href
      }
    }
  }

  const linkClasses = (item: NavItem) => {
    const active = isActive(item)
    return `py-3 whitespace-nowrap ${
      active
        ? "border-b-2 border-primary text-primary font-medium"
        : "text-gray-600 hover:text-gray-900"
    }`
  }

  return (
    <>
      {/* Desktop navigation */}
      <nav className="bg-white border-b hidden md:block">
        <div className="container mx-auto px-4">
          <div className="flex gap-6 items-center">
            {primaryNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleOfflineClick(e, item)}
                className={linkClasses(item)}
              >
                {item.label}
              </Link>
            ))}

            {/* "Mer" dropdown for secondary items */}
            {visibleSecondaryItems.length > 0 && (
              <div className="relative" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`py-3 flex items-center gap-1 whitespace-nowrap ${
                    isSecondaryActive
                      ? "border-b-2 border-primary text-primary font-medium"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Mer
                  <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                </button>

                {moreOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[200px] z-50">
                    {visibleSecondaryItems.map((item, index) => {
                      const showSectionHeader =
                        item.section &&
                        (index === 0 || visibleSecondaryItems[index - 1].section !== item.section)
                      return (
                        <div key={item.href}>
                          {showSectionHeader && (
                            <div className={`px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider ${index > 0 ? "border-t border-gray-100 mt-1" : ""}`}>
                              {item.section}
                            </div>
                          )}
                          <Link
                            href={item.href}
                            onClick={(e) => handleOfflineClick(e, item)}
                            className={`block px-4 py-2 text-sm ${
                              isActive(item)
                                ? "bg-primary/5 text-primary font-medium"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {item.label}
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <BottomTabBar tabs={providerTabs} moreItems={visibleMoreItems} />
    </>
  )
}
