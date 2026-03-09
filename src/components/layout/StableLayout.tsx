"use client"

import { ReactNode } from "react"
import { Header } from "./Header"
import { StableNav } from "./StableNav"

interface StableLayoutProps {
  children: ReactNode
}

export function StableLayout({ children }: StableLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header hideSecondaryNav />
      <StableNav />
      <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  )
}
