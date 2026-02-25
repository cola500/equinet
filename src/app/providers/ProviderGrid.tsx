import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StarRating } from "@/components/review/StarRating"
import type { ProviderData } from "@/hooks/useProviderSearch"

interface ProviderGridProps {
  providers: ProviderData[]
}

export function ProviderGrid({ providers }: ProviderGridProps) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {providers.map((provider, index) => (
        <Card
          key={provider.id}
          className="animate-fade-in-up hover:shadow-lg transition-shadow"
          data-testid="provider-card"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              {provider.profileImageUrl ? (
                <img
                  src={provider.profileImageUrl}
                  alt={provider.businessName}
                  className="h-12 w-12 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <span className="text-green-700 font-semibold text-lg">
                    {provider.businessName.charAt(0)}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <CardTitle className="truncate">{provider.businessName}</CardTitle>
                <CardDescription>
                  {provider.city && `${provider.city} • `}
                  {provider.user.firstName} {provider.user.lastName}
                </CardDescription>
              </div>
            </div>
            {provider.reviewStats &&
              provider.reviewStats.totalCount > 0 &&
              provider.reviewStats.averageRating !== null && (
                <div className="flex items-center gap-1.5 mt-1">
                  <StarRating
                    rating={Math.round(provider.reviewStats.averageRating)}
                    readonly
                    size="sm"
                  />
                  <span className="text-sm font-medium">
                    {provider.reviewStats.averageRating.toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({provider.reviewStats.totalCount})
                  </span>
                </div>
              )}
            {provider.nextVisit && (
              <div className="mt-2 text-sm text-purple-600">
                Nästa besök: {provider.nextVisit.location} -{" "}
                {formatShortDate(provider.nextVisit.date)}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {provider.description && (
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {provider.description}
              </p>
            )}

            {provider.services.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Tjänster:</p>
                <div className="space-y-1">
                  {provider.services.slice(0, 3).map((service) => (
                    <div key={service.id} className="text-sm flex justify-between">
                      <span>{service.name}</span>
                      <span className="text-gray-600">{service.price} kr</span>
                    </div>
                  ))}
                  {provider.services.length > 3 && (
                    <p className="text-xs text-gray-500">
                      +{provider.services.length - 3} fler tjänster
                    </p>
                  )}
                </div>
              </div>
            )}

            <Link href={`/providers/${provider.id}`}>
              <Button className="w-full">Se profil & boka</Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Format date as "3 feb"
import { format } from "date-fns"
import { sv } from "date-fns/locale"

function formatShortDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00")
  return format(date, "d MMM", { locale: sv })
}
