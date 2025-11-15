import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorState } from './error-state'
import { describe, it, expect, vi } from 'vitest'

describe('ErrorState', () => {
  it('should render with default title and description', () => {
    render(<ErrorState />)

    expect(screen.getByText('Något gick fel')).toBeInTheDocument()
    expect(screen.getByText('Ett oväntat fel inträffade')).toBeInTheDocument()
  })

  it('should render custom title and description', () => {
    render(
      <ErrorState
        title="Kunde inte hämta data"
        description="Kontrollera din internetanslutning"
      />
    )

    expect(screen.getByText('Kunde inte hämta data')).toBeInTheDocument()
    expect(screen.getByText(/kontrollera din internetanslutning/i)).toBeInTheDocument()
  })

  it('should render retry button when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)

    const retryButton = screen.getByTestId('retry-button')
    expect(retryButton).toBeInTheDocument()
    expect(retryButton).toHaveTextContent('Försök igen')
  })

  it('should call onRetry when retry button clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)

    await user.click(screen.getByTestId('retry-button'))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('should show loading state when isRetrying=true', () => {
    render(<ErrorState onRetry={vi.fn()} isRetrying={true} />)

    const retryButton = screen.getByTestId('retry-button')
    expect(retryButton).toBeDisabled()
    expect(retryButton).toHaveTextContent('Försöker igen...')
  })

  it('should show retry count when retryCount > 0', () => {
    render(<ErrorState onRetry={vi.fn()} retryCount={2} maxRetries={3} />)

    expect(screen.getByTestId('retry-count')).toHaveTextContent('Försök 2 av 3')
  })

  it('should hide retry button when canRetry=false', () => {
    render(<ErrorState onRetry={vi.fn()} retryCount={3} maxRetries={3} canRetry={false} />)

    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
    expect(screen.getByTestId('max-retries-reached')).toBeInTheDocument()
    expect(screen.getByText(/maximalt antal försök uppnått/i)).toBeInTheDocument()
  })

  it('should show reload button when max retries reached', () => {
    render(<ErrorState onRetry={vi.fn()} retryCount={3} maxRetries={3} canRetry={false} />)

    const reloadButton = screen.getByRole('button', { name: /ladda om sidan/i })
    expect(reloadButton).toBeInTheDocument()
  })

  it('should show contact support button when showContactSupport=true', () => {
    render(<ErrorState showContactSupport={true} />)

    const supportLink = screen.getByRole('link', { name: /kontakta support/i })
    expect(supportLink).toBeInTheDocument()
    expect(supportLink).toHaveAttribute('href', 'mailto:support@equinet.se')
  })

  it('should render error icon', () => {
    render(<ErrorState />)

    const errorIcon = screen.getByLabelText('Fel-ikon')
    expect(errorIcon).toBeInTheDocument()
  })

  it('should not show retry count when retryCount=0', () => {
    render(<ErrorState onRetry={vi.fn()} retryCount={0} maxRetries={3} />)

    expect(screen.queryByTestId('retry-count')).not.toBeInTheDocument()
  })
})
