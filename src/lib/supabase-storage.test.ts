/**
 * Unit tests for validateMessageAttachment in supabase-storage.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}))

import { validateMessageAttachment, assertSafeStorageFileName } from './supabase-storage'
import { fileTypeFromBuffer } from 'file-type'

function makeHeicBuffer(): Buffer {
  // Minimal HEIC ftyp box: 4 bytes size, 'ftyp', 'heic' brand
  const buf = Buffer.alloc(16)
  buf.writeUInt32BE(16, 0)      // box size
  buf.write('ftyp', 4, 'ascii') // box type
  buf.write('heic', 8, 'ascii') // major brand
  return buf
}

function makeJpegBuffer(): Buffer {
  // JPEG magic bytes: FF D8 FF
  const buf = Buffer.alloc(16)
  buf[0] = 0xff
  buf[1] = 0xd8
  buf[2] = 0xff
  return buf
}

describe('validateMessageAttachment', () => {
  beforeEach(() => {
    vi.mocked(fileTypeFromBuffer).mockResolvedValue(undefined)
  })

  it('rejects disallowed MIME type before reading magic bytes', async () => {
    const result = await validateMessageAttachment(makeJpegBuffer(), 'application/pdf')
    expect(result?.code).toBe('INVALID_TYPE')
  })

  it('rejects oversized buffer', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1)
    const result = await validateMessageAttachment(big, 'image/jpeg')
    expect(result?.code).toBe('TOO_LARGE')
  })

  it('accepts JPEG when file-type detects image/jpeg', async () => {
    vi.mocked(fileTypeFromBuffer).mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' })
    const result = await validateMessageAttachment(makeJpegBuffer(), 'image/jpeg')
    expect(result).toBeNull()
  })

  it('rejects when file-type detects a disallowed MIME', async () => {
    vi.mocked(fileTypeFromBuffer).mockResolvedValue({ mime: 'application/zip', ext: 'zip' })
    const result = await validateMessageAttachment(makeJpegBuffer(), 'image/jpeg')
    expect(result?.code).toBe('MAGIC_BYTES_MISMATCH')
  })

  it('accepts HEIC via ftyp heuristic when file-type returns undefined', async () => {
    vi.mocked(fileTypeFromBuffer).mockResolvedValue(undefined)
    const result = await validateMessageAttachment(makeHeicBuffer(), 'image/heic')
    expect(result).toBeNull()
  })

  it('rejects when file-type returns undefined and HEIC heuristic does not match', async () => {
    vi.mocked(fileTypeFromBuffer).mockResolvedValue(undefined)
    // Plain buffer, not a real HEIC
    const buf = Buffer.from('not a real file')
    const result = await validateMessageAttachment(buf, 'image/jpeg')
    expect(result?.code).toBe('MAGIC_BYTES_MISMATCH')
  })

  it('rejects when file-type returns undefined and content-type is heic but buffer is not HEIC', async () => {
    vi.mocked(fileTypeFromBuffer).mockResolvedValue(undefined)
    const buf = Buffer.from('not a real heic')
    const result = await validateMessageAttachment(buf, 'image/heic')
    expect(result?.code).toBe('MAGIC_BYTES_MISMATCH')
  })

  it('rejects when file-type import throws', async () => {
    vi.mocked(fileTypeFromBuffer).mockRejectedValue(new Error('import failed'))
    const result = await validateMessageAttachment(makeJpegBuffer(), 'image/jpeg')
    expect(result?.code).toBe('MAGIC_BYTES_MISMATCH')
  })
})

describe('assertSafeStorageFileName', () => {
  it('H1: rejects fileName containing forward slash', () => {
    expect(() => assertSafeStorageFileName('foo/bar.jpg')).toThrow('INVALID_FILENAME')
  })

  it('H2: rejects fileName containing backslash', () => {
    expect(() => assertSafeStorageFileName('foo\\bar.jpg')).toThrow('INVALID_FILENAME')
  })

  it('H3: rejects fileName containing parent directory traversal', () => {
    expect(() => assertSafeStorageFileName('..jpg')).toThrow('INVALID_FILENAME')
    expect(() => assertSafeStorageFileName('uuid..jpg')).toThrow('INVALID_FILENAME')
    expect(() => assertSafeStorageFileName('uuid-123./../etc/passwd')).toThrow('INVALID_FILENAME')
  })

  it('H4: rejects fileName containing null byte', () => {
    expect(() => assertSafeStorageFileName('evil\x00.jpg')).toThrow('INVALID_FILENAME')
  })

  it('H5: rejects empty, leading-dot, and too-long fileName', () => {
    expect(() => assertSafeStorageFileName('')).toThrow('INVALID_FILENAME')
    expect(() => assertSafeStorageFileName('.hidden.jpg')).toThrow('INVALID_FILENAME')
    expect(() => assertSafeStorageFileName('a'.repeat(256) + '.jpg')).toThrow('INVALID_FILENAME')
  })

  it('H6: accepts a safe fileName', () => {
    expect(() => assertSafeStorageFileName('uuid-1234.jpg')).not.toThrow()
    expect(() =>
      assertSafeStorageFileName('a0000000-0000-4000-a000-000000000001-1700000000000.png')
    ).not.toThrow()
  })
})
