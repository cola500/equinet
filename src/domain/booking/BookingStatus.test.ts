import { describe, it, expect } from 'vitest'
import { BookingStatus, StatusValue } from './BookingStatus'

describe('BookingStatus', () => {
  describe('create', () => {
    it('should create from valid status string', () => {
      const result = BookingStatus.create('pending')
      expect(result.isSuccess).toBe(true)
      expect(result.value.value).toBe('pending')
    })

    it.each(['pending', 'confirmed', 'cancelled', 'completed'] as StatusValue[])(
      'should create from "%s"',
      (status) => {
        const result = BookingStatus.create(status)
        expect(result.isSuccess).toBe(true)
        expect(result.value.value).toBe(status)
      }
    )

    it('should fail for invalid status string', () => {
      const result = BookingStatus.create('invalid')
      expect(result.isFailure).toBe(true)
      expect(result.error).toContain('invalid')
    })

    it('should fail for empty string', () => {
      const result = BookingStatus.create('')
      expect(result.isFailure).toBe(true)
    })
  })

  describe('isTerminal', () => {
    it('should return true for cancelled', () => {
      const status = BookingStatus.create('cancelled').value
      expect(status.isTerminal).toBe(true)
    })

    it('should return true for completed', () => {
      const status = BookingStatus.create('completed').value
      expect(status.isTerminal).toBe(true)
    })

    it('should return false for pending', () => {
      const status = BookingStatus.create('pending').value
      expect(status.isTerminal).toBe(false)
    })

    it('should return false for confirmed', () => {
      const status = BookingStatus.create('confirmed').value
      expect(status.isTerminal).toBe(false)
    })
  })

  describe('allowedTransitions', () => {
    it('should allow pending -> confirmed and cancelled', () => {
      const status = BookingStatus.create('pending').value
      expect(status.allowedTransitions).toEqual(['confirmed', 'cancelled'])
    })

    it('should allow confirmed -> completed and cancelled', () => {
      const status = BookingStatus.create('confirmed').value
      expect(status.allowedTransitions).toEqual(['completed', 'cancelled'])
    })

    it('should allow no transitions from cancelled', () => {
      const status = BookingStatus.create('cancelled').value
      expect(status.allowedTransitions).toEqual([])
    })

    it('should allow no transitions from completed', () => {
      const status = BookingStatus.create('completed').value
      expect(status.allowedTransitions).toEqual([])
    })
  })

  describe('canTransitionTo', () => {
    it('should allow pending -> confirmed', () => {
      const pending = BookingStatus.create('pending').value
      const confirmed = BookingStatus.create('confirmed').value
      expect(pending.canTransitionTo(confirmed)).toBe(true)
    })

    it('should allow pending -> cancelled', () => {
      const pending = BookingStatus.create('pending').value
      const cancelled = BookingStatus.create('cancelled').value
      expect(pending.canTransitionTo(cancelled)).toBe(true)
    })

    it('should NOT allow pending -> completed', () => {
      const pending = BookingStatus.create('pending').value
      const completed = BookingStatus.create('completed').value
      expect(pending.canTransitionTo(completed)).toBe(false)
    })

    it('should allow confirmed -> completed', () => {
      const confirmed = BookingStatus.create('confirmed').value
      const completed = BookingStatus.create('completed').value
      expect(confirmed.canTransitionTo(completed)).toBe(true)
    })

    it('should allow confirmed -> cancelled', () => {
      const confirmed = BookingStatus.create('confirmed').value
      const cancelled = BookingStatus.create('cancelled').value
      expect(confirmed.canTransitionTo(cancelled)).toBe(true)
    })

    it('should NOT allow confirmed -> pending', () => {
      const confirmed = BookingStatus.create('confirmed').value
      const pending = BookingStatus.create('pending').value
      expect(confirmed.canTransitionTo(pending)).toBe(false)
    })

    it('should NOT allow transitions from terminal states', () => {
      const cancelled = BookingStatus.create('cancelled').value
      const completed = BookingStatus.create('completed').value
      const pending = BookingStatus.create('pending').value
      const confirmed = BookingStatus.create('confirmed').value

      expect(cancelled.canTransitionTo(pending)).toBe(false)
      expect(cancelled.canTransitionTo(confirmed)).toBe(false)
      expect(completed.canTransitionTo(pending)).toBe(false)
      expect(completed.canTransitionTo(confirmed)).toBe(false)
    })

    it('should NOT allow transitioning to same state', () => {
      const pending = BookingStatus.create('pending').value
      const pending2 = BookingStatus.create('pending').value
      expect(pending.canTransitionTo(pending2)).toBe(false)
    })
  })

  describe('transitionTo', () => {
    it('should return new status on valid transition', () => {
      const pending = BookingStatus.create('pending').value
      const confirmed = BookingStatus.create('confirmed').value

      const result = pending.transitionTo(confirmed)
      expect(result.isSuccess).toBe(true)
      expect(result.value.value).toBe('confirmed')
    })

    it('should fail on invalid transition', () => {
      const pending = BookingStatus.create('pending').value
      const completed = BookingStatus.create('completed').value

      const result = pending.transitionTo(completed)
      expect(result.isFailure).toBe(true)
      expect(result.error).toContain('pending')
      expect(result.error).toContain('completed')
    })

    it('should fail when transitioning from terminal state', () => {
      const cancelled = BookingStatus.create('cancelled').value
      const pending = BookingStatus.create('pending').value

      const result = cancelled.transitionTo(pending)
      expect(result.isFailure).toBe(true)
    })
  })

  describe('equality', () => {
    it('should be equal when same status', () => {
      const a = BookingStatus.create('pending').value
      const b = BookingStatus.create('pending').value
      expect(a.equals(b)).toBe(true)
    })

    it('should not be equal when different status', () => {
      const a = BookingStatus.create('pending').value
      const b = BookingStatus.create('confirmed').value
      expect(a.equals(b)).toBe(false)
    })
  })
})
