---
title: Remediation Backlog — fixes.txt findings 2026-05
description: Sprintplan för 39 fynd från fixes.txt-djupauditen (2026-05-18). Sprint 3-A KLAR + Sprint 3-A follow-up HIGH KLART. Sprint 3-B/C/D/E pending. Korsrefererad med vår tidigare S-numrering från staging-security-audit-2026-05.md.
category: security
status: active
last_updated: 2026-05-18
tags:
  - security
  - remediation
  - sprint
  - hotfix
  - fixes-txt
related:
  - fixes.txt
  - staging-security-audit-2026-05.md
  - security-hardening-sprint-backlog.md
  - security-sprint-continuity-2026-05.md
  - sprint-closure-2026-05.md
sections:
  - Översikt
  - Sprint 3-A — CRITICAL hotfixes
  - Sprint 3-B — HIGH (focused fixes)
  - Sprint 3-C — Defense-in-depth pass
  - Sprint 3-D — AI cost-control (original Slice 3)
  - Sprint 3-E — MEDIUM och LOW hygien
  - Beroende-karta
  - Pre-sprint frågor som måste klargöras
---

# Remediation Backlog — fixes.txt findings 2026-05

**Källa:** `docs/security/fixes.txt` (djupaudit 2026-05-18 på `a3b19830`).
**Total scope:** 39 fynd (4 CRITICAL / 10 HIGH / 14 MEDIUM / 11 LOW).
**Status:** Sprint 3-A KLAR (C1-C4 live på staging). Sprint 3-A follow-up HIGH KLART (3 watch-items från retron). Sprint 3-B (H1-H10) ännu inte påbörjat.

## Översikt

| Sprint | Scope | Effort | Trigger | Status |
|---|---|---|---|---|
| **3-A** | C1-C4 CRITICAL hotfixes | 5-8h | Innan extern testare-tillgång eller staging→main merge | ✅ **KLAR** (live på staging) |
| **3-A follow-up** | Watch-items från Sprint 3-A retro: V4, services-bucket ownership, message-attachments-bucket-verifiering, originalName-sanering, prod-bucket-parity, dev-fallback-härdning | ~2h klart + ~1h pending | Efter Sprint 3-A | ✅ **HIGH KLART** (3 av 6 slices: 3A.fu.1-3). MEDIUM/LOW pending: 3A.fu.4-6 |
| **3-B** | H1, H4, H7, H10 — focused HIGH-fixes | 5h | Innan prod-merge | ⏸ pending |
| **3-C** | H2, H3, H5, H6, H8, H9, M11 — defense-in-depth | 9h | Innan publik demo eller prod-launch | ⏸ pending |
| **3-D** | S-1, S-3 — AI cost-control (original Slice 3) | 10-13h | Vid AI-cost-spike eller publik demo | ⏸ pending |
| **3-E** | M1-M14 + L1-L11 hygien | 6-8h | Innan prod-launch eller löpande | ⏸ pending |

**Totalt:** ~35-43h över sex sprintar (inkl. follow-up).

**Avgörande policy:** Inga fynd från Sprint 3-A eller follow-up mergade till `main` ännu. `staging` är säkrad testbädd; ingen prod-deploy utfärdad. OWASP ZAP regression krävs före `staging → main` merge.

---

## Sprint 3-A — CRITICAL hotfixes ✅ KLAR

**Status:** Alla fyra CRITICAL live på `staging`. Merge-commit `30052a37` (C3 sista). Retro publicerad i `docs/retrospectives/2026-05-18-sprint-3a-security-remediation.md`.

| Slice | Commit(s) | PR | Status |
|---|---|---|---|
| 3-A.1 (C1) | C1.1-C1.4 sub-slices, `1e65298f` test-verifiering | — (direkt på staging) | ✅ |
| 3-A.2 (C2) | `584a4d68` (C2.2), `3b0f0b01` (C2.3 hotfix) | — | ✅ |
| 3-A.3 (C3) | Merge `30052a37` | #337 | ✅ |
| 3-A.4 (C4) | `8c9ee9fa` | — | ✅ |

**Mål:** Stäng fyra exploit-vägar som är reachable av authenticated provider. Detta är "fix before next deploy" enligt fixes.txt.

**Förutsättning:** Pausa extern tillgång till staging tills alla fyra är klara. Inga nya provider-konton ska registreras.

### 3-A.1 — C1 Ghost-user collision-fix

**Severity:** CRITICAL — account takeover
**Effort:** 1-2h

**Filer:**
- `src/lib/ghost-user.ts:29-35` (kärna)
- `src/app/api/provider/customers/route.ts:258-291`
- `src/app/api/provider/customers/[customerId]/route.ts:21-60`
- `src/app/api/native/customers/[customerId]/route.ts:23-128`

**Approach:**
1. I `createGhostUser`: returnera existing.id **endast om** `existing.isManualCustomer === true`. Annars `EMAIL_BELONGS_TO_REGISTERED_USER`-fel.
2. I PUT-routes (båda customer-vägar): gate på `isManualCustomer === true` innan `prisma.user.update`. DELETE har redan denna check enligt fixes.txt — kopiera mönster.

**Verifiering:**
- Integration-test: provider POSTar customer med email = existing registered user → 409 EMAIL_BELONGS_TO_REGISTERED_USER.
- Integration-test: provider PUT mot non-manual customer → 403.
- Befintliga manuell-kund-flöden förblir gröna.

**Rollback:** Per-file `git revert`. Isolerad ändring.

### 3-A.2 — C2 Booking-series customerId-ownership

**Severity:** CRITICAL — fake-bookings i offrets namn (52 möjligt per serie)
**Effort:** 1-2h

**Filer:**
- `src/app/api/booking-series/route.ts:111-114`
- `src/domain/booking/BookingService.ts:408-470` (`createManualBooking`)

**Approach:**
I `createManualBooking`: kräv att `customerId` antingen
- Refererar en `providerCustomer`-link för denna provider, **eller**
- Refererar `User` med `isManualCustomer === true`.

Annars `CUSTOMER_NOT_LINKED`-fel → 403 i route.

**Verifiering:**
- Integration-test: provider skapar series med okänt customerId → 403.
- Integration-test: provider skapar series med linked customerId → 200.
- Integration-test: provider skapar series med manuell-kund-id → 200.

### 3-A.3 — C3 Upload path-traversal + ownership

**Severity:** CRITICAL — overskriver andras filer i public bucket
**Effort:** 2-3h

**Filer:**
- `src/app/api/upload/route.ts:60-132`
- `src/lib/supabase-storage.ts:86-95,115`

**Approach:**
1. **Validera entityId med `z.string().uuid()`** — UUID-only.
2. **Lägg ownership-check för services-bucket:** slå upp `service.providerId === user.providerId`. Övriga buckets har redan ownership-checks.
3. **Derivera extension från validerad MIME** — inte från `file.name.split(".").pop()`. Använd `file-type`-paketets MIME → ext-mapping (samma som message-attachments redan gör).
4. **Sätt `upsert: false`** i `uploadFile` ELLER lägg `crypto.randomBytes(8).toString("hex")` i path så collision blir omöjlig.

**Verifiering:**
- Integration-test: upload med `entityId="../../horses/<other-user-id>"` → 400 (invalid UUID).
- Integration-test: upload till services-bucket utan ownership → 403.
- Integration-test: upload med spoofad MIME (HTML asserted as PNG) → 400 (magic-bytes mismatch).
- Integration-test: två uploads till samma entityId inom 1ms → båda får olika paths (eller second fails om `upsert: false`).

### 3-A.4 — C4 Device-token + push-subscription compound-key

**Severity:** CRITICAL — push-notiser hijack
**Effort:** 1h

**Filer:**
- `src/app/api/device-tokens/route.ts:73-84`
- `src/app/api/push-subscriptions/route.ts:54-72`

**Approach (val ett av två):**
- A: Före upsert, `findUnique` på token/endpoint. Om `existing && existing.userId !== caller.id` → 409 TOKEN_OWNED_BY_OTHER_USER.
- B: Migrera Prisma schema till compound unique `(userId, token)` och `(userId, endpoint)`. Upsert WHERE inkluderar `userId`.

**Rekommendation:** Option A. Mindre migration-risk, snabbare leverans.

**Verifiering:**
- Integration-test: user-A registrerar token X → 200. User-B försöker registrera samma token X → 409.
- Befintlig token-refresh-flöde (samma user, samma token) → 200 idempotent.

### 3-A — Verifieringsstrategi (sammantaget)

- Per-fynd integration-test som demonstrerar exploit → 403/409.
- Kör hela test-suite efter varje commit (`npm run check:all`).
- Manuell staging-verifiering:
  - C1: Skapa ghost user med kollega-email, försök PUT → förvänta 409.
  - C2: Skapa booking-series med fake customer-UUID → förvänta 403.
  - C3: `curl -F "entityId=../foo"` mot upload → förvänta 400.
  - C4: Två accounts försöker registrera samma deviceToken → andra failar 409.
- OWASP ZAP scan mot staging efter 3-A komplett.

### 3-A — Rollback-plan

Varje fynd är en isolerad fil-ändring. `git revert <commit>` per fynd. Kombinera till en commit per CVE för enklare rollback.

---

## Sprint 3-A follow-up — Post-3A watch-items

**Bakgrund:** Sprint 3-A:s retro (`docs/retrospectives/2026-05-18-sprint-3a-security-remediation.md`) identifierade 6 watch-items som inte var del av CRITICAL-scopet men som logiskt bör adresseras nära 3-A. HIGH-prio slices (3A.fu.1-3) genomfördes 2026-05-18 i en separat sprint kallad "Sprint 3-A follow-up". MEDIUM/LOW kvarstår.

### 3A.fu.1 — Verifiera `message-attachments`-bucket i staging-Supabase ✅

**Severity:** Operational (blocking smoke).
**Effort:** 15-30 min.
**Resultat:** Bucket bekräftad existera (smoke 201 via `/api/bookings/[id]/messages/attachments`). Ingen kodändring krävdes. Tidigare publik probe-respons "Bucket not found" var Supabase's standardrespons för privata buckets — inte saknad bucket.
**Lärdom:** Publik storage-probe är inte definitivt test för privata buckets. Autentiserad upload är.

### 3A.fu.2 — UUID-validera `bookingId` i messages-routes ✅

**Severity:** HIGH (defense-in-depth-parity med C3 entityId-validering).
**Effort:** 30-45 min.
**PR/Commit:** PR #338 → merge `9e6cb2a7`.
**Filer ändrade (6):**
- `src/app/api/bookings/[id]/messages/route.ts` (+`bookingIdSchema`-konstant, UUID-check i POST + GET)
- `src/app/api/bookings/[id]/messages/read/route.ts` (+zod-import, UUID-check i PATCH)
- `src/app/api/bookings/[id]/messages/attachments/route.ts` (+zod-import, UUID-check i POST)
- Tester för alla tre (+7 regression-tester, befintliga `'booking-abc-123'` / `'booking-1'` fixturer → UUID v4)

**Smoke (8 scenarier mot staging):** Alla PASS — happy paths bevarade, ogiltig UUID rejected med 400 "Ogiltigt bookingId" i alla 4 handlers.

### 3A.fu.3 — Services-bucket ownership i `/api/upload` ✅

**Severity:** HIGH (öppen storage-abuse-vektor).
**Effort:** 30 min.
**PR/Commit:** PR #339 → merge `a2ba326b`.
**Filer ändrade (2):**
- `src/app/api/upload/route.ts` (+`else if (bucket === "services")` block: `entityId === session.user.providerId` exact match, annars 403)
- `src/app/api/upload/route.test.ts` (+3 regression-tester: främmande UUID, egen providerId, customer session)

**Security invariant:** För `bucket: services` — `entityId` MÅSTE matcha `session.user.providerId` exakt. Customer-sessions och andra providers rejected med 403 "Åtkomst nekad".

**Out of scope (Option B/C):** Ingen DB-cross-reference, ingen automatisk `Service.imageUrl`-koppling. Provider-beslut 2026-05-18: namespace-prefix-tolkning (Option A) bekräftad.

### 3A.fu.4 — Sanera `Upload.originalName` ⏸ pending

**Severity:** MEDIUM (defense-in-depth, ingen känd exploit).
**Effort:** ~30 min.
**Surface:** `src/app/api/upload/route.ts:181`, `src/app/api/native/provider/upload/route.ts:104`.
**Approach:** Truncate till ≤255 chars + strippa kontrolltecken (`\x00-\x1f`) innan `prisma.upload.create`. Befintliga consumers (`/provider/verification/page.tsx`) är React-eskaperade → ingen aktuell XSS-väg, men framtida `dangerouslySetInnerHTML`-renderers skulle exponera vektor.

### 3A.fu.5 — Bucket-parity prod ↔ staging för `equinet-uploads` ⏸ pending

**Severity:** MEDIUM (kosmetisk hardening, ingen exploit).
**Effort:** 10 min ändring + verifiering.
**⚠ TOUCHES PRODUCTION:** Prod's `equinet-uploads`-bucket saknar bucket-nivå `file_size_limit` och `allowed_mime_types`. Staging fick dessa konfigurerade efter buckets skapades 2026-05-18. Server-side `validateFile()` enforcear samma limits så praktisk impact är låg, men staging är strikare än prod — divergens.
**Kräver:** Explicit godkännande + tidpunkt för prod Dashboard-ändring.

### 3A.fu.6 — Dev-fallback fail-loud i NODE_ENV=production ⏸ pending

**Severity:** LOW (hygien, ingen aktuell brist).
**Effort:** ~20 min.
**Surface:** `src/lib/supabase-storage.ts:32-44` (`getSupabase()`).
**Approach:** Kasta `Error('Supabase not configured in production')` om env-vars saknas och `NODE_ENV === 'production'`, istället för tyst fallback till `public/uploads/` (vilket är fel i serverless).

---

## Sprint 3-B — HIGH (focused fixes) ⏸ pending

**Status:** Ej påbörjad. Trigger: prod-merge planeras. **OBS:** Inte att förväxla med vår interna planering som tillfälligt kallades "Sprint 3-B (3B.1-6)" och nu omdöpt till "Sprint 3-A follow-up" (se sektion ovan). Backlog-doc:s Sprint 3-B är fortfarande de fyra HIGH-fynd från fixes.txt nedan.

**Mål:** Stäng fyra HIGH-fynd som är "focused fix in one or two files".

### 3-B.1 — H1 route-orders GET ownership-filter

**Severity:** HIGH — IDOR data-disclosure
**Effort:** 30 min

**Fil:** `src/app/api/route-orders/[id]/route.ts:46-107` (GET-handler)

**Approach:** Lägg till samma WHERE-filter som befintliga PATCH:
```typescript
where: { id, OR: [{ customerId: user.id }, { providerId: user.providerId }] }
```

**Verifiering:** Integration-test där annan user hämtar route-order → 404.

### 3-B.2 — H4 CSRF Origin-check i withApiHandler

**Severity:** HIGH — defense-in-depth mot CSRF
**Effort:** 1h

**Fil:** `src/lib/api-handler.ts`

**Approach:** I `withApiHandler`, för non-GET/HEAD-metoder:
```typescript
if (method !== "GET" && method !== "HEAD") {
  const origin = request.headers.get("origin")
  if (origin && origin !== process.env.APP_URL) {
    return NextResponse.json({ error: "Cross-origin denied" }, { status: 403 })
  }
}
```

Skip-allowlist för Stripe webhook och cron (annan path).

**Verifiering:**
- Integration-test: POST med Origin: attacker.com → 403.
- Integration-test: POST med korrekt Origin → 200.
- Stripe webhook fortfarande gröna.

### 3-B.3 — H7 Stale JWT admin window vid demotion

**Severity:** HIGH — admin kan rendera /admin upp till ~1h efter demotion
**Effort:** 2h

**Workflow-fix snarare än kod-fix:**
- När admin demoteras (via admin-UI eller skript), anropa:
  - `supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { ...prev, isAdmin: false } })`
  - `supabaseAdmin.auth.admin.signOut(userId, "global")` (revokerar alla sessions)
- Dokumentera i operational runbook.

**Verifiering:**
- Manuell: demote admin A → A:s session ska nekas vid nästa `/admin`-request inom 1 min.

### 3-B.4 — H10 PaymentIntent customer-binding + receipt från DB

**Severity:** HIGH — payment metadata-trust
**Effort:** 1-2h

**Filer:**
- `src/domain/payment/StripePaymentGateway.ts:25-31`
- `src/domain/payment/PaymentWebhookService.ts:61-62`

**Approach:**
1. Skapa/återanvänd Stripe Customer per user. Sätt `customer: stripeCustomerId` på `paymentIntents.create`.
2. I webhook: använd `payment.bookingId` från DB-correlation, ignorera `metadata.bookingId` för invoiceUrl.

**Verifiering:**
- Integration-test: webhook med metadata.bookingId !== DB.bookingId → använder DB-värdet.
- Stripe Customer-ID stabil mellan betalningar (samma user → samma stripeCustomerId).

---

## Sprint 3-C — Defense-in-depth pass

**Mål:** Stäng resterande HIGH-fynd som inte är akuta enskilt men höjer baseline.

| # | Vad | Filer | Effort |
|---|---|---|---|
| H2 | MIME magic-bytes på public uploads | `src/lib/supabase-storage.ts` (återanvänd `fileTypeFromBuffer`) | 1h |
| H3 | Verification documents → private bucket + signed URLs | `supabase-storage.ts:128-137` | 2h |
| H5 | CSP nonces (Next 15 next/headers pattern) | `next.config.ts`, `middleware.ts`, root layout | 2-3h |
| H6 | Cron x-vercel-cron-check (= original S-9) | `src/lib/cron-auth.ts:33-46` | 30 min |
| H8 | `import "server-only"` i 10 filer | listad i fixes.txt H8 | 1h |
| H9 | Sentry PII scrubbing + Replay-maskning | `sentry.client.config.ts`, `sentry.server.config.ts` | 2h |
| **M11** | **iat fail-closed på admin (gap i S-6 "already covered")** | `src/lib/api-handler.ts:97-110`, `src/lib/roles.ts:120-141` | 30 min |

**Totalt:** ~9h.

### Specifik notering om M11

Min audit klassificerade S-6 som "already covered" eftersom `requireAdminRole` har iat-check. Men fixes.txt M11 visar att om iat-parsing throw:ar så stannar `tokenIssuedAt` undefined och check skippas — fail-open.

**Fix:** I `withApiHandler` `auth: "admin"`-gren, om iat-extraktion failar för admin → returnera 401 istället för att skicka `undefined` vidare. Tre rader.

---

## Sprint 3-D — AI cost-control (original Slice 3)

**Mål:** Per-user daily token budget + per-user rate-limit för AI-endpoints. Skjutet från ursprunglig högsta prioritet eftersom C1-C4 är akutare.

| Slice | Effort | Vad |
|---|---|---|
| 3-D.1 | 4-6h | S-1: Per-user daily token budget med Upstash Redis-counter. 429 vid överskridning. Admin override. |
| 3-D.2 | 3-4h | S-3: Per-user rate-limit alongside IP-limit för AI-routes. |
| 3-D.3 | 2h | Circuit-breaker vid Anthropic 5xx (bonus). |
| 3-D.4 | 1-2h | Anomaly-larm via Slack/email vid AI-kostnad > tröskel. |

**Totalt:** ~10-14h.

Se `sprint-closure-2026-05.md` § 6 "Recommendation framåt" för detaljerad design (Upstash Redis-key-design, daily-reset, env-cap).

---

## Sprint 3-E — MEDIUM och LOW hygien

**Mål:** Resterande M1-M14 + L1-L11 batchat till en hygien-sprint.

### MEDIUM (resterande, M11 fixad i 3-C)

| # | Vad | Effort |
|---|---|---|
| M1 | POST /api/bookings horseId ownership | 30 min |
| M2 | Group-booking participant horseId ownership | 30 min |
| M3 | Stripe checkout successUrl validering | 30 min |
| M4 | Subscription webhook providerId från DB | 1h |
| M5 | env.ts validera server-secrets | 1h |
| M6 | SW cache-invalidation på sign-out | 1h |
| M7 | /auth/callback rate-limit | 15 min |
| M8 | accept-invite + native-session-exchange strict limiter | 30 min |
| M9 | Encryption tag-length assert + 12-byte IV | 30 min |
| M10 | Admin audit log await (inte fire-and-forget) | 30 min |
| M12 | getClientIP fail-closed i prod | 30 min |
| M13 | Routing proxy z.tuple coords validering | 30 min |
| M14 | APNs payload generic copy (GDPR DPA) | 1h |

**Subtotal MEDIUM:** ~8h.

### LOW

L1-L11 batchat. Subtotal: ~3-4h.

**Totalt 3-E:** ~11-12h.

---

## Beroende-karta

```
Sprint 3-A (CRITICAL)
   ├─ C1 (independent)
   ├─ C2 (independent)
   ├─ C3 (independent)
   └─ C4 (independent)
   ↓
   [Verifiering + OWASP ZAP regression]
   ↓
Sprint 3-B (HIGH focused)
   ├─ H1 (independent)
   ├─ H4 (independent, påverkar alla state-changing routes)
   ├─ H7 (workflow-fix, kräver ingen kod-merge)
   └─ H10 (independent, payment-spår)
   ↓
Sprint 3-C (defense-in-depth)
   ├─ H2 (kräver H8?)  ← INTE blockerande, men H8 säkerställer module-isolation
   ├─ H3 (kräver Storage-migration)
   ├─ H5 (CSP nonces — Next 15 pattern)
   ├─ H6 (=S-9, trivial)
   ├─ H8 (10 filer, oberoende)
   ├─ H9 (Sentry config, oberoende)
   └─ M11 (trivial fail-closed fix)
   ↓
Sprint 3-D (AI cost) - parallel-bar med 3-C
   ├─ S-1
   └─ S-3
   ↓
Sprint 3-E (M/L hygien)
```

**Parallelliseringsmöjligheter:**
- 3-A.1, 3-A.2, 3-A.3, 3-A.4 är oberoende — kan göras parallellt om flera dev:er.
- 3-D är oberoende från 3-A/B/C — kan startas parallellt.
- 3-E kan plockas opportunistiskt.

---

## Pre-sprint frågor som måste klargöras

Innan Sprint 3-A startar, klargör med Johan:

1. **Är någon av C1-C4 redan exploiterad?**
   - Granska `AdminAuditLog`, `ProviderCustomer`-rader, booking-series med misstänkta customerId-mönster, upload paths med `..` eller utan UUID-form.
   - Om JA: incident-response före fix. Notifiera berörda users.
   - Om NEJ: fortsätt med fix-sprint utan paus.

2. **Pausa extern staging-tillgång?**
   - Nuvarande external testers (om några): pausa eller bara informera.
   - Demo-knapp på landing (`equinet-staging.johanlindengard.com`): tillfälligt ta bort? Risk att external testare exploiterar C1-C4.

3. **Hur paketeras Sprint 3-A i commits/PR?**
   - Alternativ A: En commit per fynd (4 commits, atomic rollback).
   - Alternativ B: En commit per sprint (1 commit, paketerad rollback).
   - Rekommendation: Alternativ A. Lättare review, atomic revert.

4. **När pushar vi till `main`?**
   - Sprint 1+2 ligger redan på `staging` ej mergat till `main`. Ska Sprint 3-A "leapfrog" Slice 1+2 till `main` direkt? Eller hela paketet samtidigt?
   - Rekommendation: Hela paketet (Sprint 1+2 + Sprint 3-A + verifierade Sprint 3-B/C) i en koordinerad merge.

5. **Behöver vi extern penetrationstest efter Sprint 3-C?**
   - fixes.txt är intern audit. Före prod-launch kan extern leverantör vara värt.
   - Inte BLOCKER, men trigger för Sprint 3-C → prod-launch-fas.

6. **Resursallokering?**
   - Sprint 3-A: ~5-8h koncentrerad sprint. Är detta nästa session, eller spread över flera dagar?
   - Min rekommendation: en sammanhängande session per CRITICAL-fynd (för att hålla fokus).

---

## Status

- **Datum:** 2026-05-18
- **Inga fynd från fixes.txt åtgärdade ännu.**
- **Sprint 3-A pending Johan-beslut.**
- **Demo Maturity:** INTERNAL TESTERS ONLY (se sprint-closure-2026-05.md).

Säg till när Sprint 3-A startar. Default approach: read-only-analys per fynd → plan → implementation per sub-slice → staging-verifiering — samma process som Slice 1+2.
