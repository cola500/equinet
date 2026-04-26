import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CustomerMergeDialog } from './CustomerMergeDialog'
import type { Customer } from './types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const mockCustomer: Customer = {
  id: 'customer-1',
  firstName: 'Anna',
  lastName: 'Ghost',
  email: 'anna@ghost.equinet.se',
  isManualCustomer: true,
  bookings: [],
  horses: [],
}

const defaultProps = {
  customer: mockCustomer,
  open: true,
  onOpenChange: vi.fn(),
  onSuccess: vi.fn(),
}

describe('CustomerMergeDialog', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls onSuccess and closes dialog after successful merge', async () => {
    vi.useFakeTimers()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mergedInto: 'real-user-id' }),
    })

    render(<CustomerMergeDialog {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('kund@example.com'), {
      target: { value: 'real@example.com' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /slå ihop/i }))
      await vi.runAllTimersAsync()
    })

    expect(screen.getByText(/kunden har slagits ihop/i)).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1500)
      await vi.runAllTimersAsync()
    })

    expect(defaultProps.onSuccess).toHaveBeenCalledOnce()
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)

    vi.useRealTimers()
  })

  it('shows error and does not call onSuccess on merge failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Kunden är inte en manuellt tillagd kund' }),
    })

    render(<CustomerMergeDialog {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('kund@example.com'), {
      target: { value: 'real@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /slå ihop/i }))

    await waitFor(() => {
      expect(screen.getByText('Kunden är inte en manuellt tillagd kund')).toBeInTheDocument()
    })

    expect(defaultProps.onSuccess).not.toHaveBeenCalled()
    expect(defaultProps.onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
