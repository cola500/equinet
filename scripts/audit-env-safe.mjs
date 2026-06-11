// Read-only safe audit of Vercel environment variables (prod or staging).
//
// Pulls the chosen project's production env into a temp file, reports ONLY
// presence/status per variable (SET / MISSING / EMPTY / WHITESPACE_ONLY), shows
// non-secret booleans as TRUE/FALSE/UNSET and PAYMENT_PROVIDER as mock/stripe/OTHER,
// then DELETES the temp file. Never prints any secret value.
//
// Run via:
//   npm run audit:prod-env:safe        (prod — equinet-app)
//   npm run audit:staging-env:safe     (staging — equinet-staging-app)
//   tsx scripts/audit-env-safe.mjs --project <prod|staging>
//
// Targeting uses a throwaway temp dir linked to the project, so the repo's own
// .vercel link is never touched. CLI-auth only (no VERCEL_TOKEN).
//
// No env change. No deploy. No flag change. Read-only.

/* global console, process */

import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
// Canonical lists live in check-prod-env.ts — imported so this audit never drifts.
// Namespace import (not named) because check-prod-env.ts is CJS under tsx (no
// "type":"module"); the `.default ?? ns` fallback handles tsx's CJS-interop where
// the exports land under `.default` rather than as namespace properties.
import * as checkProdEnvNs from './check-prod-env.ts'
const checkProdEnv = checkProdEnvNs.default ?? checkProdEnvNs
const REQUIRED_PROD_VARS = checkProdEnv.REQUIRED_PROD_VARS
const STRIPE_REQUIRED_VARS = checkProdEnv.STRIPE_REQUIRED_VARS

/** Map a --project selector to the real Vercel project name. Returns null when invalid. */
export function resolveProject(arg) {
  if (arg === undefined || arg === 'prod' || arg === 'production') {
    return { sel: 'prod', name: 'equinet-app' }
  }
  if (arg === 'staging') return { sel: 'staging', name: 'equinet-staging-app' }
  return null
}

/** Classify a raw value (or undefined when the key is absent). Never returns the value. */
export function classify(value) {
  if (value === undefined) return 'MISSING'
  if (value === '') return 'EMPTY'
  if (value.trim() === '') return 'WHITESPACE_ONLY'
  return 'SET'
}

/** Non-secret boolean config → TRUE / FALSE / UNSET / OTHER (never echoes raw value). */
export function boolStatus(value) {
  if (value === undefined || value === '') return 'UNSET'
  const v = value.trim().toLowerCase()
  if (v === 'true') return 'TRUE'
  if (v === 'false') return 'FALSE'
  return 'OTHER'
}

/** PAYMENT_PROVIDER is a non-secret enum → show known values, else OTHER/UNSET. */
export function providerStatus(value) {
  if (value === undefined || value === '') return 'UNSET'
  const v = value.trim().toLowerCase()
  return v === 'mock' || v === 'stripe' ? v : 'OTHER'
}

/** Parse a dotenv-style file into Map<key, rawValue>. Comments/blanks ignored, quotes stripped. */
export function parseEnvFile(content) {
  const map = new Map()
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    map.set(m[1], v)
  }
  return map
}

const row = (key, status) => `  ${key.padEnd(36)} ${status}`

/** Build the human-readable report from a parsed env map. Contains NO secret values. */
export function buildReport(map) {
  const provider = (map.get('PAYMENT_PROVIDER') ?? '').trim().toLowerCase()
  const lines = []

  lines.push('── Beslutsvariabler (icke-hemliga) ──')
  lines.push(row('NEXT_PUBLIC_DEMO_MODE', boolStatus(map.get('NEXT_PUBLIC_DEMO_MODE'))))
  lines.push(row('PAYMENT_PROVIDER', providerStatus(map.get('PAYMENT_PROVIDER'))))
  lines.push(row('DISABLE_CRONS', boolStatus(map.get('DISABLE_CRONS'))))
  lines.push(row('STAGING_PROJECT', boolStatus(map.get('STAGING_PROJECT'))))

  lines.push('')
  lines.push('── Alltid required (check-prod-env REQUIRED_PROD_VARS) ──')
  for (const k of REQUIRED_PROD_VARS) lines.push(row(k, classify(map.get(k))))
  lines.push(row('DIRECT_DATABASE_URL (info)', classify(map.get('DIRECT_DATABASE_URL'))))

  lines.push('')
  lines.push('── Stripe (villkorlig — STRIPE_REQUIRED_VARS) ──')
  if (provider === 'stripe') {
    for (const k of STRIPE_REQUIRED_VARS) lines.push(row(k, classify(map.get(k))))
  } else {
    lines.push('  (hoppas över — PAYMENT_PROVIDER != stripe)')
  }

  return lines.join('\n')
}

/** Read the --project value from argv (supports `--project x` and `--project=x`). */
export function parseProjectArg(argv) {
  const eq = argv.find((a) => a.startsWith('--project='))
  if (eq) return eq.split('=')[1]
  const i = argv.indexOf('--project')
  return i !== -1 ? argv[i + 1] : undefined
}

function main() {
  const project = resolveProject(parseProjectArg(process.argv))
  if (!project) {
    console.error("FEL: --project måste vara 'prod' eller 'staging'.")
    process.exit(1)
  }

  // Link a throwaway temp dir to the chosen project and pull its production env
  // there — the repo's own .vercel link is never touched.
  const tmp = mkdtempSync(join(tmpdir(), 'equinet-env-audit-'))
  const auditFile = join(tmp, '.env.audit')
  try {
    execFileSync('vercel', ['link', '--cwd', tmp, '--project', project.name, '--yes'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    execFileSync('vercel', ['env', 'pull', '--cwd', tmp, '--environment=production', auditFile], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
  } catch {
    console.error(`FEL: kunde inte länka/pulla ${project.sel} (${project.name}).`)
    console.error('Kör `vercel login` och försök igen (CLI-auth krävs).')
    rmSync(tmp, { recursive: true, force: true })
    process.exit(1)
  }

  if (!existsSync(auditFile)) {
    console.error('FEL: audit-filen skapades inte av `vercel env pull`.')
    rmSync(tmp, { recursive: true, force: true })
    process.exit(1)
  }

  try {
    const map = parseEnvFile(readFileSync(auditFile, 'utf8'))
    const label = project.sel === 'staging' ? 'Staging' : 'Production'
    console.log(`${label} env (${project.name}) — säker statusrapport (inga värden visas)\n`)
    console.log(buildReport(map))
    console.log('\n(Endast status visad. Temp-filen raderas nu.)')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) main()
