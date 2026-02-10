"use client"

import { ReactNode } from "react"
import { Header } from "./Header"
import { ProviderNav } from "./ProviderNav"

interface ProviderLayoutProps {
  children: ReactNode
}

export function ProviderLayout({ children }: ProviderLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <ProviderNav />
      <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  )
}
