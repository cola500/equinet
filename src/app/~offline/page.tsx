import { WifiOff } from "lucide-react"
import Link from "next/link"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-amber-100 p-6">
            <WifiOff className="h-12 w-12 text-amber-600" aria-hidden="true" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Ingen internetanslutning
        </h1>
        <p className="text-gray-600 mb-6">
          Du verkar vara offline. Kontrollera din internetanslutning och
          försök igen.
        </p>
        <Link
          href="/provider/dashboard"
          className="inline-flex items-center justify-center rounded-md bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors"
        >
          Tillbaka till Dashboard
        </Link>
      </div>
    </div>
  )
}
