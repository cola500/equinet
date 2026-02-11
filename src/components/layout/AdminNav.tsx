"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Star,
  ShieldCheck,
  Plug,
  Activity,
  Bell,
  Menu,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/admin", label: "Översikt", icon: LayoutDashboard },
  { href: "/admin/users", label: "Användare", icon: Users },
  { href: "/admin/bookings", label: "Bokningar", icon: CalendarDays },
  { href: "/admin/reviews", label: "Recensioner", icon: Star },
  { href: "/admin/verifications", label: "Verifieringar", icon: ShieldCheck },
  { href: "/admin/integrations", label: "Integrationer", icon: Plug },
  { href: "/admin/system", label: "System", icon: Activity },
  { href: "/admin/notifications", label: "Notifikationer", icon: Bell },
]

export function AdminNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

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

  const navContent = (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={linkClasses(item.href)}
          onClick={() => setOpen(false)}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-56 shrink-0 border-r bg-white p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
          Administration
        </p>
        {navContent}
      </aside>

      {/* Mobile hamburger */}
      <div className="md:hidden border-b bg-white px-4 py-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-11">
              <Menu className="h-5 w-5 mr-2" />
              Meny
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-4">
            <SheetTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
              Administration
            </SheetTitle>
            {navContent}
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
