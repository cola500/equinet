"use client"

import { ReactNode } from "react"
import { Header } from "./Header"
import { AdminNav } from "./AdminNav"

interface AdminLayoutProps {
  children: ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <AdminNav />
        <main className="flex-1 container mx-auto px-4 py-8 pb-24 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  )
}
