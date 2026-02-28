"use client"

import Link from "next/link"
import { Search, CalendarDays, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/layout/Header"
import { HorseIcon } from "@/components/icons/HorseIcon"
import { AnnouncementPreview } from "@/components/AnnouncementPreview"

const features = [
  {
    icon: Search,
    title: "Sök och jämför",
    description: "Hitta rätt tjänsteleverantör baserat på område, tjänstetyp och tillgänglighet",
  },
  {
    icon: CalendarDays,
    title: "Boka direkt",
    description: "Se tillgängliga tider och boka tjänster direkt online",
  },
  {
    icon: Bell,
    title: "Håll koll",
    description: "Få bekräftelser och påminnelser om dina kommande bokningar",
  },
  {
    icon: HorseIcon,
    title: "Din häst i centrum",
    description: "Samla alla hästar, besökshistorik och vårdscheman på ett ställe",
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.96_0.02_80)] to-white">
      <Header />

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 md:mb-6">
            Boka hästtjänster enkelt och smidigt
          </h1>
          <p className="text-base md:text-xl text-gray-600 mb-6 md:mb-8 px-2">
            Equinet är din plattform för att hitta och boka hovslagare,
            veterinärer, hästterapeuter och andra professionella tjänster
            för din häst.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center px-4 sm:px-0">
            <Link href="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-base md:text-lg px-6 md:px-8">
                Registrera dig gratis
              </Button>
            </Link>
            <Link href="/providers" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base md:text-lg px-6 md:px-8">
                Hitta tjänster
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-16 md:mt-32 grid md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div key={feature.title} className="text-center">
                <div className="w-16 h-16 bg-accent-warm/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-8 h-8 text-accent-warm-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            )
          })}
        </div>

        {/* Announcements Preview Section */}
        <AnnouncementPreview />

        {/* CTA Section for Providers */}
        <div className="mt-16 md:mt-32 bg-primary text-primary-foreground rounded-2xl p-6 md:p-12 text-center mx-2 md:mx-0">
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">
            Är du tjänsteleverantör?
          </h2>
          <p className="text-base md:text-lg mb-6 opacity-85">
            Gå med i Equinet och nå fler kunder. Hantera dina bokningar enkelt i vår plattform.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Bli tjänsteleverantör
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t text-center text-gray-600">
        <p>&copy; 2026 Equinet. Alla rättigheter förbehållna.</p>
      </footer>
    </div>
  )
}
