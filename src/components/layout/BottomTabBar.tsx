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

export interface TabItem {
  href: string
  label: string
  icon: LucideIcon
  matchPrefix?: string
}

export interface MoreMenuItem {
  href: string
  label: string
  icon: LucideIcon
  matchPrefix?: string
}

interface BottomTabBarProps {
  tabs: TabItem[]
  moreItems: MoreMenuItem[]
}

export function BottomTabBar({ tabs, moreItems }: BottomTabBarProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string, matchPrefix?: string) => {
    if (matchPrefix) {
      return pathname.startsWith(matchPrefix)
    }
    return pathname === href
  }

  // Check if any "more" item is active (to highlight the "Mer" tab)
  const isMoreActive = moreItems.some((item) => isActive(item.href, item.matchPrefix))

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t md:hidden"
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
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] transition-colors ${
                  active ? "text-green-600" : "text-gray-500"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] leading-tight">{tab.label}</span>
              </Link>
            )
          })}

          {/* "Mer" tab */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] transition-colors ${
              isMoreActive ? "text-green-600" : "text-gray-500"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] leading-tight">Mer</span>
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
                    className={`flex items-center gap-3 px-4 py-3 min-h-[48px] ${
                      active
                        ? "text-green-600 bg-green-50 font-medium"
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
