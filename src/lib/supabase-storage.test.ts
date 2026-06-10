/**
 * Unit tests for validateMessageAttachment in supabase-storage.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}))

// 3A.fu.6: mocks for getSupabase production-guard tests below.
// Static mocks so existing tests (validateMessageAttachment, assertSafe…)
// are unaffected — they don't touch fs or @supabase/supabase-js.
// supabase-storage.ts only imports { writeFile, mkdir } from fs/promises,
// so we return a partial mock with just those. vi.hoisted because vi.mock
// is hoisted to the top of the file and cannot reference normal let-vars.
const { mkdirMock, writeFileMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn().mockResolvedValue(undefined),
  writeFileMock: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('fs/promises', () => ({
  __esModule: true,
  default: { mkdir: mkdirMock, writeFile: writeFileMock },
  mkdir: mkdirMock,
  writeFile: writeFileMock,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://stub.example/file' } }),
      }),
    },
  })),
}))

import {
  validateMessageAttachment,
  assertSafeStorageFileName,
  uploadFile,
  _resetSupabaseClientForTesting,
} from './supabase-storage'
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

describe('getSupabase production guard (3A.fu.6)', () => {
  // Reset the module-level supabaseClient cache + env stubs between tests
  // so each test exercises a clean process.env snapshot.
  beforeEach(() => {
    _resetSupabaseClientForTesting()
    vi.unstubAllEnvs()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('NODE_ENV', 'development')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    _resetSupabaseClientForTesting()
  })

  async function callUploadFile() {
    return uploadFile(
      Buffer.from('test'),
      'horses',
      'safe-name.jpg',
      'image/jpeg'
    )
  }

  it('F1: NODE_ENV=development with no env vars uses dev fallback', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const result = await callUploadFile()
    expect(result.data).toBeDefined()
    expect(result.data?.path).toBe('horses/safe-name.jpg')
    expect(result.data?.url).toBe('/uploads/horses/safe-name.jpg')
  })

  it('F2: NODE_ENV=test with no env vars uses dev fallback', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const result = await callUploadFile()
    expect(result.data).toBeDefined()
  })

  it('F3: NODE_ENV=production with no env vars throws fail-loud', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(callUploadFile()).rejects.toThrow(/not configured/i)
  })

  it('F4: VERCEL_ENV=production with no env vars throws fail-loud', async () => {
    vi.stubEnv('NODE_ENV', 'development') // even when NODE_ENV is dev
    vi.stubEnv('VERCEL_ENV', 'production')
    await expect(callUploadFile()).rejects.toThrow(/not configured/i)
  })

  it('F5: VERCEL_ENV=preview with no env vars throws fail-loud', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERCEL_ENV', 'preview')
    await expect(callUploadFile()).rejects.toThrow(/not configured/i)
  })

  it('F6: VERCEL_ENV=development with no env vars uses dev fallback', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERCEL_ENV', 'development')
    const result = await callUploadFile()
    expect(result.data).toBeDefined()
  })

  it('F7: NODE_ENV=production with env vars set uses Supabase, no throw', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://stub.example.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'stub-key')
    const result = await callUploadFile()
    expect(result.data).toBeDefined()
    expect(result.data?.url).toBe('https://stub.example/file')
  })

  it('error message only contains env-var names, no values', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      await callUploadFile()
      throw new Error('Should have thrown')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      expect(msg).toContain('NEXT_PUBLIC_SUPABASE_URL')
      expect(msg).toContain('SUPABASE_SERVICE_ROLE_KEY')
      // Sanity: no secret-like values leaked
      expect(msg).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/) // no JWT
      expect(msg).not.toMatch(/sk_(live|test)_/) // no Stripe-style
    }
  })
})
