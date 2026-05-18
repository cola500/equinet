import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { execSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

/**
 * Integration tests for scripts/check-no-secrets.sh.
 *
 * Each test creates a fresh temporary git repo, stages a file with crafted
 * content, runs the script against that repo, and asserts on exit code +
 * output.
 */
const SCRIPT = resolve(__dirname, "check-no-secrets.sh")

function setupRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "secret-scan-"))
  execSync("git init -q", { cwd: dir })
  execSync("git config user.email test@example.com", { cwd: dir })
  execSync("git config user.name Test", { cwd: dir })
  return dir
}

function stageFile(dir: string, file: string, content: string): void {
  writeFileSync(join(dir, file), content)
  execSync(`git add ${file}`, { cwd: dir })
}

function runScript(dir: string): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`bash ${SCRIPT}`, { cwd: dir, encoding: "utf-8" })
    return { code: 0, stdout, stderr: "" }
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    return {
      code: e.status ?? 1,
      stdout: e.stdout?.toString() ?? "",
      stderr: e.stderr?.toString() ?? "",
    }
  }
}

describe("check-no-secrets.sh", () => {
  const repos: string[] = []

  afterAll(() => {
    for (const r of repos) rmSync(r, { recursive: true, force: true })
  })

  function makeRepo(): string {
    const r = setupRepo()
    repos.push(r)
    return r
  }

  it("passes when no files are staged", () => {
    const r = makeRepo()
    const result = runScript(r)
    expect(result.code).toBe(0)
  })

  it("passes for ordinary source code", () => {
    const r = makeRepo()
    stageFile(
      r,
      "ok.ts",
      "const greet = (n: string) => `Hello, ${n}`\nexport default greet\n"
    )
    const result = runScript(r)
    expect(result.code).toBe(0)
  })

  it("blocks Anthropic API keys", () => {
    const r = makeRepo()
    // Prefix split avoids GitHub push-protection matching in this source file
    stageFile(r, "bad.ts", 'const k = "sk-' + 'ant-api03-AAAAAAAAAAAAAAAAAAAAAAAA"\n')
    const result = runScript(r)
    expect(result.code).toBe(1)
    expect(result.stdout).toMatch(/Anthropic/)
  })

  it("blocks Stripe live secret keys", () => {
    const r = makeRepo()
    stageFile(r, "bad.ts", 'const k = "sk_' + 'live_AAAAAAAAAAAAAAAAAAAAAAAA"\n')
    const result = runScript(r)
    expect(result.code).toBe(1)
    expect(result.stdout).toMatch(/Stripe/)
  })

  it("blocks Stripe webhook secrets", () => {
    const r = makeRepo()
    stageFile(r, "bad.ts", 'const k = "whs' + 'ec_AAAAAAAAAAAAAAAAAAAAAAAA"\n')
    const result = runScript(r)
    expect(result.code).toBe(1)
    expect(result.stdout).toMatch(/Stripe webhook/)
  })

  it("blocks AWS access keys", () => {
    const r = makeRepo()
    stageFile(r, "bad.ts", 'const k = "AKI' + 'AIOSFODNN7EXAMPLE"\n')
    const result = runScript(r)
    expect(result.code).toBe(1)
    expect(result.stdout).toMatch(/AWS/)
  })

  it("blocks GitHub personal access tokens", () => {
    const r = makeRepo()
    stageFile(r, "bad.ts", 'const k = "gh' + 'p_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"\n')
    const result = runScript(r)
    expect(result.code).toBe(1)
    expect(result.stdout).toMatch(/GitHub/)
  })

  it("blocks RSA private keys", () => {
    const r = makeRepo()
    stageFile(r, "bad.pem", "-----BEGIN RSA PRIVATE KEY-----\nfoo\n")
    const result = runScript(r)
    expect(result.code).toBe(1)
    expect(result.stdout).toMatch(/RSA private key/)
  })

  it("blocks Supabase service_role JWTs", () => {
    const r = makeRepo()
    // Demo service_role JWT from Supabase CLI — payload literally contains
    // "role":"service_role".
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    stageFile(r, "bad.ts", `const k = "${jwt}"\n`)
    const result = runScript(r)
    expect(result.code).toBe(1)
    expect(result.stdout).toMatch(/service_role/)
  })

  it("does not block Supabase anon JWTs", () => {
    const r = makeRepo()
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    stageFile(r, "ok.ts", `const k = "${jwt}"\n`)
    const result = runScript(r)
    expect(result.code).toBe(0)
  })

  it("blocks Postgres connection strings with credentials", () => {
    const r = makeRepo()
    stageFile(
      r,
      "bad.ts",
      'const url = "postgresql://user:p4ssw0rd@db.example.com:5432/app"\n'
    )
    const result = runScript(r)
    expect(result.code).toBe(1)
    expect(result.stdout).toMatch(/DB connection/)
  })

  it("does not block local Postgres dev connection strings", () => {
    const r = makeRepo()
    stageFile(
      r,
      "ok.ts",
      'const url = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"\n'
    )
    const result = runScript(r)
    expect(result.code).toBe(0)
  })

  it("skips .env.example files", () => {
    const r = makeRepo()
    stageFile(r, ".env.example", 'STRIPE_SECRET_KEY="sk_' + 'live_AAAAAAAAAAAAAAAAAAAAAAAA"\n')
    const result = runScript(r)
    expect(result.code).toBe(0)
  })

  it("honours secret-scan:allow override on the same line", () => {
    const r = makeRepo()
    stageFile(
      r,
      "bad.ts",
      'const k = "sk_' + 'live_AAAAAAAAAAAAAAAAAAAAAAAA" // secret-scan:allow test fixture\n'
    )
    const result = runScript(r)
    expect(result.code).toBe(0)
  })
})
