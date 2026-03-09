"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/layout/Header"
import { MapPin, Phone, Mail, ArrowLeft } from "lucide-react"
import type { StableWithCounts, StableSpot } from "@/infrastructure/persistence/stable/IStableRepository"

interface StableProfileViewProps {
  stable: StableWithCounts
  availableSpots: StableSpot[]
}

export function StableProfileView({ stable, availableSpots }: StableProfileViewProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back link */}
          <Link href="/stables" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till sökning
          </Link>

          {/* Stable Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{stable.name}</h1>
            {(stable.municipality || stable.city) && (
              <p className="text-gray-600 flex items-center gap-1 text-lg">
                <MapPin className="h-5 w-5" />
                {[stable.municipality, stable.city].filter(Boolean).join(", ")}
              </p>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              {stable.description && (
                <Card>
                  <CardHeader>
                    <CardTitle>Om stallet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 whitespace-pre-line">{stable.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Available Spots */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Lediga stallplatser ({availableSpots.length} av {stable._count.spots})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {availableSpots.length === 0 ? (
                    <p className="text-gray-500">Inga lediga stallplatser just nu.</p>
                  ) : (
                    <div className="space-y-3">
                      {availableSpots.map((spot) => (
                        <div
                          key={spot.id}
                          className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                        >
                          <div>
                            <p className="font-medium">{spot.label || "Stallplats"}</p>
                            {spot.notes && (
                              <p className="text-sm text-gray-600">{spot.notes}</p>
                            )}
                            {spot.availableFrom && (
                              <p className="text-sm text-gray-500">
                                Ledig från {new Date(spot.availableFrom).toLocaleDateString("sv-SE")}
                              </p>
                            )}
                          </div>
                          {spot.pricePerMonth != null && (
                            <p className="text-lg font-semibold text-green-700 whitespace-nowrap">
                              {spot.pricePerMonth.toLocaleString("sv-SE")} kr/mån
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contact info */}
              {(stable.contactEmail || stable.contactPhone) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Kontakt</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stable.contactPhone && (
                      <a
                        href={`tel:${stable.contactPhone}`}
                        className="flex items-center gap-2 text-gray-700 hover:text-green-700"
                      >
                        <Phone className="h-4 w-4" />
                        {stable.contactPhone}
                      </a>
                    )}
                    {stable.contactEmail && (
                      <a
                        href={`mailto:${stable.contactEmail}`}
                        className="flex items-center gap-2 text-gray-700 hover:text-green-700"
                      >
                        <Mail className="h-4 w-4" />
                        {stable.contactEmail}
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Quick stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Översikt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Totalt antal platser</span>
                    <span className="font-medium">{stable._count.spots}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Lediga platser</span>
                    <span className="font-medium text-green-700">{stable._count.availableSpots}</span>
                  </div>
                </CardContent>
              </Card>

              {/* CTA */}
              {stable.contactEmail && (
                <Button asChild className="w-full">
                  <a href={`mailto:${stable.contactEmail}?subject=Förfrågan om stallplats - ${stable.name}`}>
                    Kontakta stallet
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
