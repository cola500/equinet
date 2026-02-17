import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from './empty-state'
import { describe, it, expect, vi } from 'vitest'
import { Calendar } from 'lucide-react'

describe('EmptyState', () => {
  it('should render title', () => {
    render(<EmptyState title="Inga bokningar" />)

    expect(screen.getByText('Inga bokningar')).toBeInTheDocument()
  })

  it('should render description when provided', () => {
    render(
      <EmptyState
        title="Inga bokningar"
        description="Det finns inga bokningar att visa just nu."
      />
    )

    expect(screen.getByText('Det finns inga bokningar att visa just nu.')).toBeInTheDocument()
  })

  it('should not render description when not provided', () => {
    render(<EmptyState title="Inga bokningar" />)

    const card = screen.getByTestId('empty-state')
    expect(card.querySelectorAll('p')).toHaveLength(0)
  })

  it('should render icon when provided', () => {
    render(<EmptyState title="Inga bokningar" icon={Calendar} />)

    expect(screen.getByTestId('empty-state-icon')).toBeInTheDocument()
  })

  it('should not render icon when not provided', () => {
    render(<EmptyState title="Inga bokningar" />)

    expect(screen.queryByTestId('empty-state-icon')).not.toBeInTheDocument()
  })

  it('should render link action with href', () => {
    render(
      <EmptyState
        title="Inga bokningar"
        action={{ label: 'Skapa bokning', href: '/provider/bookings' }}
      />
    )

    const link = screen.getByRole('link', { name: 'Skapa bokning' })
    expect(link).toHaveAttribute('href', '/provider/bookings')
  })

  it('should render button action with onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <EmptyState
        title="Inga hästar"
        action={{ label: 'Lägg till häst', onClick }}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Lägg till häst' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('should not render action when not provided', () => {
    render(<EmptyState title="Inga recensioner" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
