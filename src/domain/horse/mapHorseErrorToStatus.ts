/**
 * Maps HorseError types to HTTP status codes.
 * Shared by all horse routes (DRY -- not duplicated per route).
 */
import type { HorseError } from './HorseService'

export function mapHorseErrorToStatus(error: HorseError): number {
  switch (error.type) {
    case 'HORSE_NOT_FOUND':
    case 'NOTE_NOT_FOUND':
    case 'NO_PROVIDER_ACCESS':
      return 404
    case 'UNAUTHORIZED':
      return 403
    default:
      return 500
  }
}
