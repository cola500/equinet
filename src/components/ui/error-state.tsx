'use client'

import { AlertCircle, RefreshCw, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void | Promise<void>
  isRetrying?: boolean
  retryCount?: number
  maxRetries?: number
  canRetry?: boolean
  showContactSupport?: boolean
}

export function ErrorState({
  title = 'Något gick fel',
  description = 'Ett oväntat fel inträffade',
  onRetry,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  canRetry = true,
  showContactSupport = false,
}: ErrorStateProps) {
  return (
    <Card data-testid="error-state">
      <CardContent className="py-12 text-center">
        <div className="mb-4">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" aria-label="Fel-ikon" />
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>

        {description && (
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {description}
          </p>
        )}

        {retryCount > 0 && canRetry && (
          <p className="text-sm text-gray-500 mb-4" data-testid="retry-count">
            Försök {retryCount} av {maxRetries}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry && canRetry ? (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              size="lg"
              data-testid="retry-button"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Försöker igen...' : 'Försök igen'}
            </Button>
          ) : !canRetry && retryCount >= maxRetries ? (
            <div className="text-center" data-testid="max-retries-reached">
              <p className="text-sm text-red-600 mb-4">
                Maximalt antal försök uppnått
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                size="lg"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Ladda om sidan
              </Button>
            </div>
          ) : null}

          {showContactSupport && (
            <Button variant="outline" asChild size="lg">
              <a href="mailto:support@equinet.se">
                <Mail className="mr-2 h-4 w-4" />
                Kontakta support
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
