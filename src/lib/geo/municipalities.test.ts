import { describe, it, expect } from 'vitest'
import {
  SWEDISH_MUNICIPALITIES,
  isValidMunicipality,
  searchMunicipalities,
} from './municipalities'

describe('municipalities', () => {
  describe('SWEDISH_MUNICIPALITIES', () => {
    it('should contain all 290 Swedish municipalities', () => {
      expect(SWEDISH_MUNICIPALITIES).toHaveLength(290)
    })

    it('should contain well-known municipalities', () => {
      const names = SWEDISH_MUNICIPALITIES.map(m => m.name)
      expect(names).toContain('Göteborg')
      expect(names).toContain('Stockholm')
      expect(names).toContain('Malmö')
      expect(names).toContain('Alingsås')
      expect(names).toContain('Uppsala')
    })

    it('should have unique municipality names', () => {
      const names = SWEDISH_MUNICIPALITIES.map(m => m.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })

    it('should be sorted alphabetically', () => {
      const names = SWEDISH_MUNICIPALITIES.map(m => m.name)
      const sorted = [...names].sort((a, b) => a.localeCompare(b, 'sv'))
      expect(names).toEqual(sorted)
    })
  })

  describe('isValidMunicipality', () => {
    it('should return true for valid municipality', () => {
      expect(isValidMunicipality('Göteborg')).toBe(true)
    })

    it('should return false for invalid municipality', () => {
      expect(isValidMunicipality('Fantasistad')).toBe(false)
    })

    it('should be case-insensitive', () => {
      expect(isValidMunicipality('göteborg')).toBe(true)
      expect(isValidMunicipality('GÖTEBORG')).toBe(true)
    })

    it('should return false for empty string', () => {
      expect(isValidMunicipality('')).toBe(false)
    })
  })

  describe('searchMunicipalities', () => {
    it('should find municipalities matching query', () => {
      const results = searchMunicipalities('Ali')
      expect(results.map(m => m.name)).toContain('Alingsås')
    })

    it('should be case-insensitive', () => {
      const results = searchMunicipalities('ali')
      expect(results.map(m => m.name)).toContain('Alingsås')
    })

    it('should return empty array for no matches', () => {
      const results = searchMunicipalities('xyznonexistent')
      expect(results).toHaveLength(0)
    })

    it('should return empty array for empty query', () => {
      const results = searchMunicipalities('')
      expect(results).toHaveLength(0)
    })

    it('should match anywhere in the name', () => {
      const results = searchMunicipalities('borg')
      const names = results.map(m => m.name)
      expect(names).toContain('Göteborg')
      expect(names).toContain('Borgholm')
    })
  })
})
