"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import { MoreHorizontal } from "lucide-react"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { toast } from "sonner"

export interface TabItem {
  href: string
  label: string
  icon: LucideIcon
  matchPrefix?: string
  offlineSafe?: boolean
}

export interface MoreMenuItem {
  href: string
  label: string
  icon: LucideIcon
  matchPrefix?: string
  offlineSafe?: boolean
}

interface BottomTabBarProps {
  tabs: TabItem[]
  moreItems: MoreMenuItem[]
}

export function BottomTabBar({ tabs, moreItems }: BottomTabBarProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const isOnline = useOnlineStatus()

  const isActive = (href: string, matchPrefix?: string) => {
    if (matchPrefix) {
      return pathname.startsWith(matchPrefix)
    }
    return pathname === href
  }

  function handleOfflineClick(e: React.MouseEvent, href: string, matchPrefix?: string, offlineSafe?: boolean) {
    if (!isOnline && !isActive(href, matchPrefix)) {
      if (!offlineSafe) {
        e.preventDefault()
        toast.error("Du är offline. Navigering kräver internetanslutning.")
      } else {
        // offlineSafe: hard navigate to bypass RSC fetch and use SW document cache
        e.preventDefault()
        window.location.href = href
      }
    }
  }

  // Check if any "more" item is active (to highlight the "Mer" tab)
  const isMoreActive = moreItems.some((item) => isActive(item.href, item.matchPrefix))

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t shadow-[0_-1px_3px_rgba(0,0,0,0.1)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch">
          {tabs.map((tab) => {
            const active = isActive(tab.href, tab.matchPrefix)
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={(e) => handleOfflineClick(e, tab.href, tab.matchPrefix, tab.offlineSafe)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] transition-all duration-200 ${
                  active ? "text-green-700" : "text-gray-400"
                }`}
              >
                {active ? (
                  <span className="flex flex-col items-center gap-0.5 bg-green-100/80 rounded-full px-3 py-1">
                    <Icon className="h-[22px] w-[22px]" />
                    <span className="text-[10px] leading-tight font-medium">{tab.label}</span>
                  </span>
                ) : (
                  <>
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] leading-tight">{tab.label}</span>
                  </>
                )}
              </Link>
            )
          })}

          {/* "Mer" tab */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] transition-all duration-200 ${
              isMoreActive ? "text-green-700" : "text-gray-400"
            }`}
          >
            {isMoreActive ? (
              <span className="flex flex-col items-center gap-0.5 bg-green-100/80 rounded-full px-3 py-1">
                <MoreHorizontal className="h-[22px] w-[22px]" />
                <span className="text-[10px] leading-tight font-medium">Mer</span>
              </span>
            ) : (
              <>
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[10px] leading-tight">Mer</span>
              </>
            )}
          </button>
        </div>
      </nav>

      {/* "Mer" drawer */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Mer</DrawerTitle>
          </DrawerHeader>
          <nav className="flex flex-col pb-6">
            {moreItems.map((item) => {
              const active = isActive(item.href, item.matchPrefix)
              const Icon = item.icon
              return (
                <DrawerClose key={item.href} asChild>
                  <Link
                    href={item.href}
                    onClick={(e) => handleOfflineClick(e, item.href, item.matchPrefix, item.offlineSafe)}
                    className={`flex items-center gap-3 px-4 py-3 min-h-[48px] ${
                      active
                        ? "text-green-700 bg-green-50 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </DrawerClose>
              )
            })}
          </nav>
        </DrawerContent>
      </Drawer>
    </>
  )
}
