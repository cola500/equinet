"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const navItems = [
  { href: "/providers", label: "Hitta tjänster", matchPrefix: "/providers" },
  { href: "/customer/bookings", label: "Mina bokningar" },
  { href: "/announcements", label: "Planerade rutter", matchPrefix: "/announcements" },
  { href: "/customer/group-bookings", label: "Gruppförfrågningar", matchPrefix: "/customer/group-bookings" },
  { href: "/customer/horses", label: "Mina hästar" },
  { href: "/customer/profile", label: "Min profil" },
]

export function CustomerNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (item: typeof navItems[0]) => {
    if (item.matchPrefix) {
      return pathname.startsWith(item.matchPrefix)
    }
    return pathname === item.href
  }

  const linkClasses = (item: typeof navItems[0], isMobile = false) => {
    const active = isActive(item)
    if (isMobile) {
      return `block py-3 px-4 text-base ${
        active
          ? "bg-green-50 text-green-600 font-medium border-l-4 border-green-600"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`
    }
    return `py-3 ${
      active
        ? "border-b-2 border-green-600 text-green-600 font-medium"
        : "text-gray-600 hover:text-gray-900"
    }`
  }

  return (
    <nav className="bg-white border-b">
      <div className="container mx-auto px-4">
        {/* Desktop navigation */}
        <div className="hidden md:flex gap-6">
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

        {/* Mobile navigation */}
        <div className="md:hidden flex items-center py-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Öppna meny</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b p-4">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col py-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item) ? "page" : undefined}
                    className={linkClasses(item, true)}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <span className="ml-2 text-sm font-medium text-gray-600">
            {navItems.find((item) => isActive(item))?.label || "Navigation"}
          </span>
        </div>
      </div>
    </nav>
  )
}
