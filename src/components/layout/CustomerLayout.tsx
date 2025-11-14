"use client"

import { ReactNode } from "react"
import { Header } from "./Header"
import { CustomerNav } from "./CustomerNav"

interface CustomerLayoutProps {
  children: ReactNode
}

export function CustomerLayout({ children }: CustomerLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <CustomerNav />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
