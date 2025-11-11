import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="text-2xl font-bold text-green-800">Equinet</div>
        <div className="space-x-4">
          <Link href="/login">
            <Button variant="ghost">Logga in</Button>
          </Link>
          <Link href="/register">
            <Button>Kom igång</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Boka hästtjänster enkelt och smidigt
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Equinet är din plattform för att hitta och boka hovslagare,
            veterinärer, hästterapeuter och andra professionella tjänster
            för din häst.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8">
                Registrera dig gratis
              </Button>
            </Link>
            <Link href="/providers">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Hitta tjänster
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-32 grid md:grid-cols-3 gap-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Sök och jämför</h3>
            <p className="text-gray-600">
              Hitta rätt tjänsteleverantör baserat på område, tjänstetyp och tillgänglighet
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Boka direkt</h3>
            <p className="text-gray-600">
              Se tillgängliga tider och boka tjänster direkt online
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Håll koll</h3>
            <p className="text-gray-600">
              Få bekräftelser och påminnelser om dina kommande bokningar
            </p>
          </div>
        </div>

        {/* CTA Section for Providers */}
        <div className="mt-32 bg-green-800 text-white rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Är du tjänsteleverantör?
          </h2>
          <p className="text-lg mb-6 text-green-100">
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
        <p>&copy; 2024 Equinet. Alla rättigheter förbehållna.</p>
      </footer>
    </div>
  )
}
