/**
 * Verifies that local Supabase Storage buckets exist with the exact settings
 * the app expects — private/public, correct file-size limit, correct MIME
 * whitelist.
 *
 * Rotorsak (2026-09-27/28): `supabase start` on a fresh local volume did not
 * create either Storage bucket the app uses — `message-attachments`
 * (message uploads) and `equinet-uploads` (avatars/horses/services/
 * verifications) — causing every local upload to fail with "Bucket not
 * found". Fixed by declaring both buckets in supabase/config.toml
 * (`[storage.buckets.*]`) — the Supabase CLI creates/reconciles declared
 * buckets on every `supabase start` (idempotent: a bucket that already
 * matches is left untouched). This script is the automated check that the
 * declarations actually produce correctly-configured buckets, run in CI
 * right after a genuinely fresh `supabase start` (Migration From Scratch
 * job) so drift here is caught without any manual step. See
 * docs/guides/gotchas.md #43.
 *
 * Usage: npx tsx scripts/verify-local-storage-buckets.ts
 * (requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, e.g. via
 * `.env.local` after `supabase start`)
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { fileURLToPath } from "url"
import {
  MESSAGE_BUCKET,
  MESSAGE_MAX_SIZE,
  MESSAGE_ALLOWED_MIME,
  UPLOADS_BUCKET,
  UPLOADS_MAX_SIZE,
  UPLOADS_ALLOWED_MIME,
} from "../src/lib/supabase-storage"

export interface ExpectedBucketConfig {
  id: string
  public: boolean
  fileSizeLimit: number
  allowedMimeTypes: string[]
}

export interface ActualBucketConfig {
  id: string
  public: boolean
  // Supabase's own Bucket type has these as optional `number | undefined`;
  // widened to also accept `null` since that's what a manually-created
  // bucket without limits (the original bug's symptom) reports.
  file_size_limit?: number | null
  allowed_mime_types?: string[] | null
}

export const EXPECTED_BUCKETS: ExpectedBucketConfig[] = [
  {
    id: MESSAGE_BUCKET,
    public: false,
    fileSizeLimit: MESSAGE_MAX_SIZE,
    allowedMimeTypes: MESSAGE_ALLOWED_MIME,
  },
  {
    // Settings mirror staging's actual bucket config (verified via Supabase
    // metadata query 2026-09-28) and the app's own UPLOADS_* constants.
    // Deliberately NOT mirroring production, whose equinet-uploads bucket
    // is missing these limits (file_size_limit/allowed_mime_types = null) —
    // a separate, already-tracked production drift, unrelated to local dev.
    id: UPLOADS_BUCKET,
    public: true,
    fileSizeLimit: UPLOADS_MAX_SIZE,
    allowedMimeTypes: UPLOADS_ALLOWED_MIME,
  },
]

/** Compares one expected bucket config against the actual bucket (or undefined if missing). Returns human-readable problems; empty array = OK. */
export function diffBucket(
  expected: ExpectedBucketConfig,
  actual: ActualBucketConfig | undefined
): string[] {
  if (!actual) {
    return [`Bucket "${expected.id}" finns inte.`]
  }

  const problems: string[] = []

  if (actual.public !== expected.public) {
    problems.push(
      `Bucket "${expected.id}": public=${actual.public}, förväntat public=${expected.public}.`
    )
  }

  if (actual.file_size_limit !== expected.fileSizeLimit) {
    problems.push(
      `Bucket "${expected.id}": file_size_limit=${actual.file_size_limit}, förväntat ${expected.fileSizeLimit}.`
    )
  }

  const actualMime = [...(actual.allowed_mime_types ?? [])].sort()
  const expectedMime = [...expected.allowedMimeTypes].sort()
  if (JSON.stringify(actualMime) !== JSON.stringify(expectedMime)) {
    problems.push(
      `Bucket "${expected.id}": allowed_mime_types=${JSON.stringify(actual.allowed_mime_types)}, förväntat ${JSON.stringify(expected.allowedMimeTypes)}.`
    )
  }

  return problems
}

/** Verifies every expected bucket against the actual bucket list. */
export function verifyBuckets(
  expected: ExpectedBucketConfig[],
  actual: ActualBucketConfig[]
): { ok: boolean; problems: string[] } {
  const byId = new Map(actual.map((b) => [b.id, b]))
  const problems = expected.flatMap((e) => diffBucket(e, byId.get(e.id)))
  return { ok: problems.length === 0, problems }
}

async function main() {
  config({ path: ".env.local" })
  config({ path: ".env" })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error(
      "[verify-local-storage-buckets] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    )
    process.exit(1)
  }

  const supabase = createClient(url, serviceRoleKey)
  const { data, error } = await supabase.storage.listBuckets()

  if (error) {
    console.error(`[verify-local-storage-buckets] Could not list buckets: ${error.message}`)
    process.exit(1)
  }

  const { ok, problems } = verifyBuckets(EXPECTED_BUCKETS, data ?? [])

  if (!ok) {
    console.error("[verify-local-storage-buckets] FAIL:")
    for (const p of problems) console.error(`  - ${p}`)
    console.error(
      "\nFix: check supabase/config.toml's [storage.buckets.*] declarations, then " +
        "`supabase stop --no-backup && supabase start` to recreate the local volume."
    )
    process.exit(1)
  }

  console.log(
    `[verify-local-storage-buckets] OK: ${EXPECTED_BUCKETS.length} bucket(s) verified (${EXPECTED_BUCKETS.map((b) => b.id).join(", ")}).`
  )
}

// Only run when executed directly (`npx tsx scripts/verify-local-storage-buckets.ts`),
// not when imported by verify-local-storage-buckets.test.ts.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`[verify-local-storage-buckets] Script failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
}
