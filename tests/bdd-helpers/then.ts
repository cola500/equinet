/**
 * BDD Test Helpers - Then (Assertions)
 *
 * These helpers make assertions using business language.
 * Example: then.expectSuccess() instead of expect(response.status).toBe(200)
 */

import { expect } from 'vitest'

export const then = {
  /**
   * Then the response should be successful
   * @example
   * await then.expectSuccess(response, {
   *   status: 200,
   *   bookingCount: 2
   * })
   */
  expectSuccess: async (
    response: Response,
    assertions: {
      status: number
      bookingCount?: number
      firstBookingDate?: string
      allBelongToProvider?: string
      hasProperty?: string
    }
  ) => {
    expect(response.status).toBe(assertions.status)
    const data = await response.json()

    if (assertions.bookingCount !== undefined) {
      expect(data).toHaveLength(assertions.bookingCount)
    }

    if (assertions.firstBookingDate) {
      expect(data[0].bookingDate).toContain(assertions.firstBookingDate)
    }

    if (assertions.allBelongToProvider) {
      expect(
        data.every((item: any) => item.providerId === assertions.allBelongToProvider)
      ).toBe(true)
    }

    if (assertions.hasProperty) {
      expect(data).toHaveProperty(assertions.hasProperty)
    }

    return data
  },

  /**
   * Then the response should be unauthorized (401)
   * @example
   * await then.expectUnauthorized(response, {
   *   errorMessage: 'Unauthorized'
   * })
   */
  expectUnauthorized: async (
    response: Response,
    assertions: {
      errorMessage: string
    }
  ) => {
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe(assertions.errorMessage)
  },

  /**
   * Then the response should be forbidden (403)
   * @example
   * await then.expectForbidden(response, {
   *   errorMessage: 'Access denied'
   * })
   */
  expectForbidden: async (
    response: Response,
    assertions: {
      errorMessage: string
    }
  ) => {
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe(assertions.errorMessage)
  },

  /**
   * Then the response should be a validation error (400)
   * @example
   * await then.expectValidationError(response, {
   *   errorMessage: 'Validation error',
   *   missingFields: ['serviceId', 'bookingDate']
   * })
   */
  expectValidationError: async (
    response: Response,
    assertions: {
      errorMessage?: string
      missingFields?: string[]
    }
  ) => {
    expect(response.status).toBe(400)
    const data = await response.json()

    if (assertions.errorMessage) {
      expect(data.error).toContain(assertions.errorMessage)
    } else {
      expect(data.error).toContain('Validation')
    }

    if (assertions.missingFields) {
      assertions.missingFields.forEach((field) => {
        expect(JSON.stringify(data.details || data)).toContain(field)
      })
    }
  },

  /**
   * Then the response should be not found (404)
   * @example
   * await then.expectNotFound(response, {
   *   errorMessage: 'Provider not found'
   * })
   */
  expectNotFound: async (
    response: Response,
    assertions: {
      errorMessage: string
    }
  ) => {
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe(assertions.errorMessage)
  },

  /**
   * Then the response should be created (201)
   * @example
   * await then.expectCreated(response, {
   *   id: 'booking-123',
   *   status: 'pending'
   * })
   */
  expectCreated: async (
    response: Response,
    assertions: {
      id?: string
      status?: string
      hasProperty?: string
    }
  ) => {
    expect(response.status).toBe(201)
    const data = await response.json()

    if (assertions.id) {
      expect(data.id).toBe(assertions.id)
    }

    if (assertions.status) {
      expect(data.status).toBe(assertions.status)
    }

    if (assertions.hasProperty) {
      expect(data).toHaveProperty(assertions.hasProperty)
    }

    return data
  },

  /**
   * Then the response should be a server error (500)
   * @example
   * await then.expectServerError(response)
   */
  expectServerError: async (response: Response) => {
    expect(response.status).toBe(500)
  },

  /**
   * Then the response should be a conflict (409)
   * @example
   * await then.expectConflict(response, {
   *   errorMessage: 'Time slot already booked'
   * })
   */
  expectConflict: async (
    response: Response,
    assertions: {
      errorMessage: string
    }
  ) => {
    expect(response.status).toBe(409)
    const data = await response.json()
    expect(data.error).toContain(assertions.errorMessage)
  },

  /**
   * Then the response should be bad request (400)
   * @example
   * await then.expectBadRequest(response, {
   *   errorMessage: 'Invalid service'
   * })
   */
  expectBadRequest: async (
    response: Response,
    assertions: {
      errorMessage: string
    }
  ) => {
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe(assertions.errorMessage)
  },
}
