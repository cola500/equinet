"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function CustomerNav() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <nav className="bg-white border-b">
      <div className="container mx-auto px-4">
        <div className="flex gap-6">
          <Link
            href="/providers"
            className={`py-3 ${
              isActive("/providers")
                ? "border-b-2 border-green-600 text-green-600 font-medium"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Hitta tjänster
          </Link>
          <Link
            href="/customer/bookings"
            className={`py-3 ${
              isActive("/customer/bookings")
                ? "border-b-2 border-green-600 text-green-600 font-medium"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Mina bokningar
          </Link>
          <Link
            href="/customer/profile"
            className={`py-3 ${
              isActive("/customer/profile")
                ? "border-b-2 border-green-600 text-green-600 font-medium"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Min profil
          </Link>
        </div>
      </div>
    </nav>
  )
}
