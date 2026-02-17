'use client'

import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card data-testid="empty-state" className={className}>
      <CardContent className="py-12 text-center">
        {Icon && (
          <div className="mb-4" data-testid="empty-state-icon">
            <Icon className="mx-auto h-12 w-12 text-gray-400" />
          </div>
        )}

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>

        {description && (
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {description}
          </p>
        )}

        {action && (
          action.href ? (
            <Link href={action.href}>
              <Button size="lg">{action.label}</Button>
            </Link>
          ) : (
            <Button size="lg" onClick={action.onClick}>
              {action.label}
            </Button>
          )
        )}
      </CardContent>
    </Card>
  )
}
