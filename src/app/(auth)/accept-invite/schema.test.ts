import { describe, it, expect } from 'vitest'
import { acceptInviteSchema } from './schema'

describe('acceptInviteSchema', () => {
  const valid = { password: 'SecurePass1!', confirmPassword: 'SecurePass1!' }

  it('accepts a valid password', () => {
    expect(acceptInviteSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects password without uppercase letter', () => {
    const result = acceptInviteSchema.safeParse({ ...valid, password: 'securepass1!', confirmPassword: 'securepass1!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('stor bokstav'))).toBe(true)
    }
  })

  it('rejects password without lowercase letter', () => {
    const result = acceptInviteSchema.safeParse({ ...valid, password: 'SECUREPASS1!', confirmPassword: 'SECUREPASS1!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('liten bokstav'))).toBe(true)
    }
  })

  it('rejects password without digit', () => {
    const result = acceptInviteSchema.safeParse({ ...valid, password: 'SecurePass!', confirmPassword: 'SecurePass!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('siffra'))).toBe(true)
    }
  })

  it('rejects password without special character', () => {
    const result = acceptInviteSchema.safeParse({ ...valid, password: 'SecurePass1', confirmPassword: 'SecurePass1' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('specialtecken'))).toBe(true)
    }
  })

  it('rejects passwords that do not match', () => {
    const result = acceptInviteSchema.safeParse({ password: 'SecurePass1!', confirmPassword: 'Different1!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('matchar inte'))).toBe(true)
    }
  })
})
