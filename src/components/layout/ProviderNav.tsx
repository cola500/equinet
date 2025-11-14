"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function ProviderNav() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <nav className="bg-white border-b">
      <div className="container mx-auto px-4">
        <div className="flex gap-6">
          <Link
            href="/provider/dashboard"
            className={`py-3 ${
              isActive("/provider/dashboard")
                ? "border-b-2 border-green-600 text-green-600 font-medium"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/provider/services"
            className={`py-3 ${
              isActive("/provider/services")
                ? "border-b-2 border-green-600 text-green-600 font-medium"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Mina tjänster
          </Link>
          <Link
            href="/provider/bookings"
            className={`py-3 ${
              isActive("/provider/bookings")
                ? "border-b-2 border-green-600 text-green-600 font-medium"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Bokningar
          </Link>
          <Link
            href="/provider/profile"
            className={`py-3 ${
              isActive("/provider/profile")
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
