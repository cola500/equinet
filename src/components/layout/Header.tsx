"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { signOut } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { CustomerNav } from "./CustomerNav"

export function Header() {
  const { user, isAuthenticated, isProvider, isCustomer } = useAuth()

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" })
  }

  return (
    <>
    <header className="bg-white border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl md:text-2xl font-bold text-green-800">
          Equinet
        </Link>
        <div className="flex items-center gap-2 md:gap-4">
          {!isAuthenticated ? (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="h-11 px-3 md:px-4">
                  Logga in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="h-11 px-3 md:px-4">
                  <span className="hidden sm:inline">Kom igång</span>
                  <span className="sm:hidden">Börja</span>
                </Button>
              </Link>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-11 px-3 md:px-4 max-w-[150px] md:max-w-none truncate">
                  {user?.name || user?.email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuItem asChild>
                  <Link href={isProvider ? "/provider/dashboard" : "/dashboard"}>
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={isProvider ? "/provider/profile" : "/customer/profile"}>
                    Min profil
                  </Link>
                </DropdownMenuItem>
                {isCustomer && (
                  <DropdownMenuItem asChild>
                    <Link href="/customer/bookings">
                      Mina bokningar
                    </Link>
                  </DropdownMenuItem>
                )}
                {isProvider && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/provider/services">
                        Mina tjänster
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/provider/bookings">
                        Bokningar
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  Logga ut
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
    {isAuthenticated && isCustomer && <CustomerNav />}
    </>
  )
}
