"use client"

import { ReactNode } from "react"
import { Header } from "./Header"
import { OfflineBanner } from "@/components/provider/OfflineBanner"


interface CustomerLayoutProps {
  children: ReactNode
}

export function CustomerLayout({ children }: CustomerLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <OfflineBanner />
      <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  )
}
