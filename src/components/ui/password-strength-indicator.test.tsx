import { render, screen } from '@testing-library/react'
import { PasswordStrengthIndicator } from './password-strength-indicator'
import { describe, it, expect } from 'vitest'

describe('PasswordStrengthIndicator', () => {
  it('should show neutral state for empty password', () => {
    render(<PasswordStrengthIndicator password="" />)

    // Component should be visible
    expect(screen.getByTestId('password-strength-indicator')).toBeInTheDocument()

    // All requirements should be neutral (gray)
    expect(screen.getByTestId('requirement-minLength')).toHaveClass('text-gray-400')
    expect(screen.getByTestId('requirement-hasCase')).toHaveClass('text-gray-400')
    expect(screen.getByTestId('requirement-hasNumber')).toHaveClass('text-gray-400')
    expect(screen.getByTestId('requirement-hasSpecialChar')).toHaveClass('text-gray-400')
  })

  it('should validate minLength requirement', () => {
    const { rerender } = render(<PasswordStrengthIndicator password="Test12" />)

    // Too short - should be unmet (gray-500)
    expect(screen.getByTestId('requirement-minLength')).toHaveClass('text-gray-500')

    // Long enough - should be met (green-600)
    rerender(<PasswordStrengthIndicator password="Test1234" />)
    expect(screen.getByTestId('requirement-minLength')).toHaveClass('text-green-600')
  })

  it('should validate hasCase requirement (uppercase + lowercase)', () => {
    const { rerender } = render(<PasswordStrengthIndicator password="test1234!" />)

    // No uppercase - unmet
    expect(screen.getByTestId('requirement-hasCase')).toHaveClass('text-gray-500')

    // Has both - met
    rerender(<PasswordStrengthIndicator password="Test1234!" />)
    expect(screen.getByTestId('requirement-hasCase')).toHaveClass('text-green-600')
  })

  it('should validate hasNumber requirement', () => {
    const { rerender } = render(<PasswordStrengthIndicator password="Testtest!" />)

    // No number - unmet
    expect(screen.getByTestId('requirement-hasNumber')).toHaveClass('text-gray-500')

    // Has number - met
    rerender(<PasswordStrengthIndicator password="Test1234!" />)
    expect(screen.getByTestId('requirement-hasNumber')).toHaveClass('text-green-600')
  })

  it('should validate hasSpecialChar requirement', () => {
    const { rerender } = render(<PasswordStrengthIndicator password="Test1234" />)

    // No special char - unmet
    expect(screen.getByTestId('requirement-hasSpecialChar')).toHaveClass('text-gray-500')

    // Has special char - met
    rerender(<PasswordStrengthIndicator password="Test1234!" />)
    expect(screen.getByTestId('requirement-hasSpecialChar')).toHaveClass('text-green-600')
  })

  it('should show success message when all requirements met', () => {
    render(<PasswordStrengthIndicator password="Test1234!" />)

    // Success message should be visible
    expect(screen.getByText(/lösenordet uppfyller alla krav/i)).toBeInTheDocument()
  })

  it('should not show success message when requirements not fully met', () => {
    render(<PasswordStrengthIndicator password="test1234" />)

    // Success message should NOT be visible (missing uppercase and special char)
    expect(screen.queryByText(/lösenordet uppfyller alla krav/i)).not.toBeInTheDocument()
  })

  it('should have proper ARIA attributes', () => {
    render(<PasswordStrengthIndicator password="Test1234!" />)

    // ARIA live region for screen readers
    expect(screen.getByRole('status')).toBeInTheDocument()

    // List with label
    expect(screen.getByRole('list', { name: /lösenordskrav/i })).toBeInTheDocument()

    // Success alert
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('should show grouped layout with Längd and Innehåll sections', () => {
    render(<PasswordStrengthIndicator password="" />)

    expect(screen.getByText('Längd')).toBeInTheDocument()
    expect(screen.getByText('Innehåll')).toBeInTheDocument()
  })
})
