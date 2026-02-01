/**
 * BookingStatus Value Object
 *
 * Encapsulates booking status with state machine transition validation.
 * Prevents invalid transitions (e.g. pending -> completed).
 *
 * State Machine:
 *   pending   -> [confirmed, cancelled]
 *   confirmed -> [completed, cancelled]
 *   cancelled -> []  (terminal)
 *   completed -> []  (terminal)
 */
import { ValueObject } from '@/domain/shared/base/ValueObject'
import { Result } from '@/domain/shared/types/Result'

export type StatusValue = 'pending' | 'confirmed' | 'cancelled' | 'completed'

const VALID_STATUSES: StatusValue[] = ['pending', 'confirmed', 'cancelled', 'completed']

const TRANSITIONS: Record<StatusValue, StatusValue[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  cancelled: [],
  completed: [],
}

interface BookingStatusProps {
  value: StatusValue
}

export class BookingStatus extends ValueObject<BookingStatusProps> {
  private constructor(props: BookingStatusProps) {
    super(props)
  }

  static create(value: string): Result<BookingStatus, string> {
    if (!VALID_STATUSES.includes(value as StatusValue)) {
      return Result.fail(
        `Ogiltig bokningsstatus: "${value}". Giltiga värden: ${VALID_STATUSES.join(', ')}`
      )
    }

    return Result.ok(new BookingStatus({ value: value as StatusValue }))
  }

  get value(): StatusValue {
    return this.props.value
  }

  get isTerminal(): boolean {
    return TRANSITIONS[this.props.value].length === 0
  }

  get allowedTransitions(): StatusValue[] {
    return [...TRANSITIONS[this.props.value]]
  }

  canTransitionTo(target: BookingStatus): boolean {
    return TRANSITIONS[this.props.value].includes(target.value)
  }

  transitionTo(target: BookingStatus): Result<BookingStatus, string> {
    if (!this.canTransitionTo(target)) {
      return Result.fail(
        `Kan inte ändra status från "${this.props.value}" till "${target.value}". ` +
          `Tillåtna övergångar: ${this.allowedTransitions.length > 0 ? this.allowedTransitions.join(', ') : 'inga (terminal status)'}`
      )
    }

    return Result.ok(target)
  }
}
