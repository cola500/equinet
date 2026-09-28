import { describe, it, expect } from "vitest"
import {
  diffBucket,
  verifyBuckets,
  EXPECTED_BUCKETS,
  type ActualBucketConfig,
  type ExpectedBucketConfig,
} from "./verify-local-storage-buckets"

const EXPECTED: ExpectedBucketConfig = {
  id: "message-attachments",
  public: false,
  fileSizeLimit: 10 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/heic", "image/webp"],
}

function makeActual(overrides: Partial<ActualBucketConfig> = {}): ActualBucketConfig {
  return {
    id: "message-attachments",
    public: false,
    file_size_limit: 10 * 1024 * 1024,
    allowed_mime_types: ["image/jpeg", "image/png", "image/heic", "image/webp"],
    ...overrides,
  }
}

describe("EXPECTED_BUCKETS", () => {
  it("declares exactly the message-attachments bucket with app-matching settings", () => {
    expect(EXPECTED_BUCKETS).toEqual([
      {
        id: "message-attachments",
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/heic", "image/webp"],
      },
    ])
  })
})

describe("diffBucket", () => {
  it("returns no problems when the bucket matches exactly", () => {
    expect(diffBucket(EXPECTED, makeActual())).toEqual([])
  })

  it("reports the bucket missing entirely", () => {
    const problems = diffBucket(EXPECTED, undefined)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/finns inte/)
  })

  it("reports a public bucket that should be private", () => {
    const problems = diffBucket(EXPECTED, makeActual({ public: true }))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/public=true.*förväntat public=false/)
  })

  it("reports a wrong file size limit (e.g. bucket created manually without one)", () => {
    const problems = diffBucket(EXPECTED, makeActual({ file_size_limit: null }))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/file_size_limit=null/)
  })

  it("reports a mismatched MIME whitelist", () => {
    const problems = diffBucket(EXPECTED, makeActual({ allowed_mime_types: ["image/jpeg"] }))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/allowed_mime_types/)
  })

  it("does not care about MIME type order", () => {
    const reordered = makeActual({
      allowed_mime_types: ["image/webp", "image/heic", "image/png", "image/jpeg"],
    })
    expect(diffBucket(EXPECTED, reordered)).toEqual([])
  })

  it("reports multiple problems at once", () => {
    const problems = diffBucket(EXPECTED, makeActual({ public: true, file_size_limit: 1 }))
    expect(problems).toHaveLength(2)
  })
})

describe("verifyBuckets", () => {
  it("is ok when every expected bucket matches", () => {
    const result = verifyBuckets([EXPECTED], [makeActual()])
    expect(result).toEqual({ ok: true, problems: [] })
  })

  it("fails when a bucket is missing from the actual list", () => {
    const result = verifyBuckets([EXPECTED], [])
    expect(result.ok).toBe(false)
    expect(result.problems).toHaveLength(1)
  })

  it("ignores unrelated buckets present in the actual list", () => {
    const result = verifyBuckets(
      [EXPECTED],
      [makeActual(), { id: "equinet-uploads", public: false, file_size_limit: null, allowed_mime_types: null }]
    )
    expect(result).toEqual({ ok: true, problems: [] })
  })
})
