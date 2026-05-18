---
title: Staging Security Audit 2026-05
description: Read-only säkerhetsgenomlysning av staging-miljön (equinet-staging-app) som underlag för Security Hardening Sprint. SUPPLEMENT av fixes.txt 2026-05-18 — se Addendum överst.
category: security
status: active
last_updated: 2026-05-18
tags:
  - security
  - audit
  - staging
  - demo
  - pentest
related:
  - fixes.txt
  - remediation-backlog-fixes-txt-2026-05.md
  - pentest-2026-04-post-migration.md
  - rls-findings.md
  - messaging.md
  - mfa-admin.md
  - ../operations/demo-audit-2026-05-14.md
  - security-hardening-sprint-backlog.md
sections:
  - Addendum 2026-05-18 fixes.txt
  - Executive Summary
  - Methodology
  - Scope
  - Positive findings (befintliga skydd)
  - Attack surface
  - Findings
  - Prioritized remediation
  - Recommended Security Sprint 1
  - Appendix Checklists och referenser
---

# Staging Security Audit 2026-05

## Addendum 2026-05-18 — fixes.txt supplement

**Viktigt: Denna audit är KOMPLETTERAD, inte ersatt, av `docs/security/fixes.txt` (2026-05-18).**

| Aspekt | Denna audit (2026-05-15) | fixes.txt (2026-05-18) |
|---|---|---|
| **Scope** | Demo-yta + UI-flöden + observerade direkt-URL-läckor i staging | Djup kod-walkthrough av auth/IDOR/injection/SSRF/uploads/Stripe/headers på `a3b19830` |
| **Approach** | Browser-verifiering + parallella Explore-agenter mot kategorier | Sju parallella sweeps verifierade direkt mot källkoden |
| **Antal fynd** | 16 (0 CRITICAL / 3 HIGH / 5 MEDIUM / 5 LOW / 3 INFO) | **39 (4 CRITICAL / 10 HIGH / 14 MEDIUM / 11 LOW)** |
| **Maturity-bedömning** | "TRUSTED EXTERNAL TESTER READY" efter Slice 1+2 | **OMVÄRDERAD → INTERNAL TESTERS ONLY tills C1-C4 är fixade** |

### Varför maturity nedgraderas

`fixes.txt` identifierade fyra CRITICAL-fynd som **är exploitable av varje authenticated provider** (inklusive externa testare som registrerar eget konto):

- **C1** Ghost-user email collision → account takeover via PUT customer
- **C2** Booking-series accepterar godtyckligt `customerId` → fake bookings i offrets namn
- **C3** Path traversal i `/api/upload` services-bucket → overskriver andras filer
- **C4** Device-token hijack via blind upsert → push-notiser till attackerare

Min audit hittade dessa inte eftersom jag fokuserade på demo-bypass-ytan, inte djupgranskning av provider-write-paths. **Det betyder att Slice 1+2-fixarna är giltiga och nödvändiga, men inte tillräckliga för "external tester ready"-mognad.**

### Komplementärt scope

Min audit och fixes.txt är **inte motsägande utan komplementära**:

- Min audit stängde demo-mode-läckor som fixes.txt inte täckte (S-2, S-7, S-10, S-13 — alla DONE).
- fixes.txt identifierade kärnsäkerhetshål som min audit missade (C1-C4 + 10 HIGH).

Båda är fortsatt giltiga referenser. Använd `fixes.txt` för core security, denna audit för demo-yta.

### Re-prioritering av remediation

**Före fixes.txt:**
- Slice 3 = S-1 (AI cost) + S-3 (rate-limit), HIGH severity

**Efter fixes.txt:**
- **Sprint 3-A** (NY): C1-C4 hotfixes — HIGHEST priority
- Sprint 3-B: H1, H4, H7, H10
- Sprint 3-C: H2, H3, H5, H6, H8, H9, M11
- Sprint 3-D: original S-1 + S-3 (AI cost) skjuts efter Sprint 3-A/B/C
- Sprint 3-E: M/L hygien

Se `docs/security/remediation-backlog-fixes-txt-2026-05.md` för detaljerad sprintplan.

### Slice 1+2-fixarnas status mot fixes.txt

| Vår sub-slice | fixes.txt-relation | Status |
|---|---|---|
| S-2 hidden routes | Inte i fixes.txt (demo-specifikt) | DONE — fortsatt giltig |
| S-7 push demo-blocker | C4 är separat allvarlig vektor | DONE för demo, **C4 öppen för core** |
| S-10 robots noindex | L8 (lägre prio) | DONE — fortsatt giltig |
| S-13 delete-customer demo-guard | C1 visar PUT-flödet är värre | DONE för demo, **C1 öppen för core** |
| S-4 admin RSC layout-guard | H7 stale JWT är separat | DONE för UI, **H7 öppen** |
| S-6 MFA iat | M11 visar fail-open-fall i samma kod | "Already covered" — **M11 visar att fail-closed saknas** |
| S-8 payment ownership-invariant | M3, M4, H10 är andra payment-ytor | DONE för IDOR, **andra payment-fynd öppna** |

**Tolkning:** Slice 1+2-fixarna är giltiga och behöver inte revertas. Men de täcker en mindre del av attack-ytan än ursprungligen bedömt.

---

**Allt nedanför detta addendum är min ursprungliga audit från 2026-05-15. Se fixes.txt och remediation-backlog för aktuell prioritering.**

---

## Executive Summary

Staging-miljöns säkerhetsposition är **grundsolid**. Tidigare Sprint 14 (RLS go-live, 28 policies) och Sprint S64 (MFA, audit log, secrets-rotation) har lagt en stark grund. Auditen identifierar **0 CRITICAL, 3 HIGH, 5 MEDIUM, 5 LOW och 3 INFO** fynd.

**De tre HIGH-fynden är samtliga ekonomisk/abuse-relaterade, inte data-läckage:**

1. **AI cost-control saknas** — Voice-Log + Customer Insights kan trigga ~28 800 LLM-anrop/dag per IP. Anthropic-fakturan är okontrollerad.
2. **Rate-limit är IP-baserad** även för authenticated AI-routes. Auth-användare delar pool, kan DOS:a varandra.
3. **Hidden provider-routes laddar via direkt-URL** trots demo-mode (`voice-log`, `route-planning`, `announcements`, `due-for-service`, `group-bookings`). Detta är samma fynd som demo-audit 2026-05-14 — fortfarande inte åtgärdat.

**Inga RCE-, SQLi-, eller XSS-ytor identifierades.** Inga `dangerouslySetInnerHTML`, inga markdown-rendrare, inga öppna CORS-policies på API. Magic bytes-validering aktiv på uploads. Stripe webhook har signaturverifiering + event-ID dedup. Demo-email-blocker är live (verifierad igår).

**Rekommenderad åtgärd:** En 5-7 dagars Security Hardening Sprint som primärt adresserar AI-cost-controls, hidden-routes redirect-gate och inkonsekvenser i `withApiHandler`-användningen. Se `security-hardening-sprint-backlog.md`.

---

## Methodology

Auditen kombinerar:

1. **Statisk kod-analys** via parallella Explore-agenter (4 spår: säkerhetsdocs, auth/admin/hidden routes, AI/Stripe/webhooks, upload/markdown/CSP/CORS).
2. **Återanvändning av tidigare mönster:** RLS-bevistest-pattern, API-route-checklist (`.claude/rules/api-routes.md`), defense-in-depth (`docs/security/messaging.md`), pentest-metodik (`pentest-2026-04-post-migration.md`).
3. **Safe browser-verifiering** mot live staging:
   - Response-headers via `curl -sI` (CSP, HSTS, X-Frame-Options, CORS)
   - `robots.txt`
   - Public HTML grep efter exponerade tokens
   - Hidden routes via direkt-URL (`/provider/voice-log`, `/admin`, `/admin/users`)
   - Source map-leakage (`_next/static/chunks/*.map`)
   - Unauthenticated admin API → förvänta 401
4. **Återanvänd förra dygnets demo-audit** (`docs/operations/demo-audit-2026-05-14.md`) — tar dess feature-inventory som baseline.

**Inte gjort (read-only-policy):**
- Inga exploit-försök (SQLi, XSS, IDOR)
- Inga DOS/load-tester
- Inga uppskrivande operationer (`acceptera booking` gjordes igår och är tracked separat)
- Ingen modifiering av prod
- Ingen env-write, ingen deploy, ingen commit

---

## Scope

**In scope:**
- Webb-staging (`equinet-staging.johanlindengard.com`)
- Tillhörande Vercel-projekt `equinet-staging-app` (`prj_KKtKkiDRWp3OX67A52iUHuk3UoF4`)
- Tillhörande Supabase-projekt `zzdamokfeenencuggjjp` (Frankfurt)
- Demo-mode och Erik Järnfot-personan
- Native/iOS-endpoints (`/api/native/*`) som speglar webb-API
- Bakomliggande domain services och repositorys

**Out of scope:**
- Prod (`equinet.johanlindengard.com` / Supabase `xybyzflfxnqqyxnvjklv`)
- iOS-appens egen kod (`ios/Equinet/`) — endast API-ytan
- Tredjeparts-system (Supabase Auth, Stripe, Anthropic) som vi inte äger
- Penetrationstester som faktiskt utför exploit

---

## Positive findings (befintliga skydd)

Dessa skydd är **bekräftade aktiva** och bör skyddas mot regression:

### Auth & Access Control

- **Supabase Auth med Custom Access Token Hook** (PL/pgSQL) injicerar `providerId`, `userType`, `isAdmin` i JWT-claims.
- **RLS deny-all på 21 tabeller** med 24 bevistester i `src/__tests__/rls/`.
- **MFA krävs för admin** (TOTP, 15 min session-timeout via JWT `iat`).
- **`withApiHandler({ auth: "admin"|"provider"|"customer"|"any"|"none" })`** centraliserar auth + audit log + rate-limit på 43 av 182 routes (alla 16 admin-routes använder den).
- **Admin audit log** automatiskt vid `auth: "admin"`.
- **Middleware** skyddar `/api/*`, `/provider/*`, `/customer/*`, `/admin/*` med session-redirect.
- **Bearer JWT-auth för native/iOS** (mobileToken, 90d, HS256, max 5 aktiva per användare, Keychain-lagrad).

### API Security

- **Zod `.strict()` på alla request bodies** är konvention (api-routes.md).
- **Ownership-guards (`findByIdForProvider`/`findByIdForCustomer`)** med atomisk WHERE.
- **`select` (aldrig `include`)** är konvention för att förhindra fält-läckage.
- **Rate-limit fail-closed** (Upstash Redis): `RateLimitServiceError` → 503.
- **Felmeddelanden på svenska** är generiska (inga stack traces läcker).
- **Inga `dangerouslySetInnerHTML`** i hela kodbasen.
- **Inga markdown-rendrare** (`react-markdown`/`marked`/`markdown-it`) — eliminerar hela XSS-klass.

### AI Security

- **Token-limits hardkodade** (Sonnet `max_tokens: 1024`, Haiku `512`).
- **LLM-output validerad** med Zod `safeParse()` + `.default()`.
- **`extractJsonObject`-helper** tolererar prosa runt JSON, säkrare än naiv `JSON.parse`.
- **Voice-log och Insights bakom feature flags** (`voice_logging`, `customer_insights`).
- **Voice-log validerar bookingId mot provider-ownership** (rad 211 i route).

### Payment Security

- **Stripe webhook-signatur** verifieras innan processing (`timingSafeEqual`).
- **Event-ID dedup** via `createMany + skipDuplicates` (atomisk INSERT ON CONFLICT DO NOTHING).
- **Stripe payments bakom feature flag** (`stripe_payments`, default OFF).
- **Subscription bakom feature flag** (`provider_subscription`, default OFF).

### Cron / Webhooks

- **Cron-routes** kräver `Authorization: Bearer <CRON_SECRET>` + HMAC-SHA256 timing-safe jämförelse.
- **`DISABLE_CRONS=true`** kill-switch.
- **Resend/Fortnox är outbound-only** (inga inkommande webhooks).

### Upload / Storage

- **Magic bytes-validering via `file-type`** på meddelande-attachments (fail-closed).
- **MIME-allowlist** (JPEG/PNG/WebP/PDF) på alla uploads.
- **Max-size enforced** (5 MB publik, 10 MB meddelanden).
- **Filnamn genereras server-side** (entity-id + timestamp), aldrig från `file.name` → ingen path traversal.
- **Signed URLs (1h expiry)** för privat `message-attachments`-bucket.
- **Transaktionellt upload-mönster** (upload → DB-create → rollback storage on DB-fail).

### Frontend / HTTP

- **HSTS** `max-age=31536000; includeSubDomains; preload`.
- **CSP** med `default-src 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`, `object-src 'none'`.
- **X-Frame-Options: DENY**.
- **X-Content-Type-Options: nosniff**.
- **Permissions-Policy** stänger camera, microphone, payment, USB.
- **`productionBrowserSourceMaps: false`** — verifierat: `/_next/.../*.js.map` returnerar 404.
- **CORS:** API-routes har INGEN wildcard. Root-HTML har `access-control-allow-origin: *` (Vercel CDN-default, harmless för public content).
- **Inga tokens i localStorage** — endast UI-state.

### Demo Security

- **`demo_email_blocker`** (commit `d9dc2063`, verifierat 2026-05-14): alla outbound mail blockas i demo med `[DEMO_EMAIL_BLOCKED]`-log.
- **Demo-redirect-gate** på 6 sidor (`reviews`, `export`, `settings/integrations`, `verification`, `routes`, `debug`).
- **Subscription/self-reschedule/delete-account dolda** i profil när demo-flag aktiv.

### Operational

- **Staging fullt isolerad från prod** (egen Vercel-app, egen Supabase, egen custom domain, separat Custom Access Token Hook).
- **Sentry konfigurerad** för error monitoring.
- **AdminAuditLog** spårar admin-aktioner.

---

## Attack surface

**Publika ytor (utan auth):**

| Yta | Antal/lista | Notering |
|---|---|---|
| Marketing-sidor | `/`, `/integritetspolicy`, `/anvandarvillkor`, FAQ | Statisk content |
| Provider-katalog | `/providers`, `/providers/[id]` | Public read |
| Stable-sidor | `/stables`, `/stables/[id]` | Public read via `stable_profiles`-flag |
| Auth-flöden | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/accept-invite` | Rate-limited |
| Demo-login | `DemoLoginButton` (autologin Erik Järnfot) | Hardkodade credentials i komponent (avsiktligt) |
| API publika | `/api/feature-flags`, `/api/auth/*`, `/api/health`, `/api/providers/[id]/*` (publik view) | |
| Stripe webhook | `/api/webhooks/stripe` | Signature-verified |
| Cron | `/api/cron/booking-reminders`, `/api/cron/send-reminders`, `/api/cron/data-retention` | Bearer-token + HMAC |

**Auth-skyddade ytor:**

| Yta | Antal | Skydd |
|---|---|---|
| Provider API | ~80 routes | Session + roll + ev. flag |
| Customer API | ~30 routes | Session + roll |
| Admin API | 16 routes | `withApiHandler({ auth: "admin" })` + MFA via middleware |
| Native/iOS API | 29 routes | Bearer JWT + roll |
| Provider UI | 27 sidor | Middleware-redirect + ev. demo-flag |
| Admin UI | 14 sidor | Middleware-redirect (men UI-skal renderar för icke-admin, se finding S-1) |

**Side-effect-ytor (kräver auth men har externa effekter):**

| Yta | Effekt | Demo-blockerad? |
|---|---|---|
| Email-utskick (alla `sendXxxNotification`) | Outbound mail via Resend | ✅ Ja (demo_email_blocker) |
| Push-notiser (APNS) | Push till mobiler | ❌ Nej |
| In-app notifier | DB-rader | ❌ Nej (harmlöst, men creerar smuts) |
| AI-anrop (Voice-Log, Insights) | Anthropic API-anrop, $$ | ❌ Nej (bara rate-limit) |
| Stripe-anrop | Riktig betalning (om flag på) | ✅ Ja (flag default OFF) |
| Storage upload | Filer i Supabase Storage | ❌ Nej |
| Hard-delete (customer) | Permanent data-radering | ❌ Nej |

---

## Findings

Numrerade enligt prioritet (S-1 = högst prioritet). Severity: CRITICAL / HIGH / MEDIUM / LOW / INFO.

### S-1 — HIGH — AI cost-control saknas

**Risk:** Voice-Log och Customer Insights kallar Claude Sonnet 4.6 / Haiku 4.5 med `max_tokens: 1024/512`. Rate-limit är "ai" = 20 req/min per IP. En attacker kan från en enstaka IP göra `20 × 60 × 24 = 28 800` LLM-anrop/dag. Vid genomsnittlig ~0,03 USD/anrop → ~860 USD/dag/IP. Med flera roterande IPs är kostnaden okontrollerad.

**Affekterade filer:**
- `src/app/api/voice-log/route.ts`
- `src/app/api/voice-log/confirm/route.ts`
- `src/app/api/provider/customers/[customerId]/insights/route.ts`
- `src/domain/voice-log/VoiceInterpretationService.ts`
- `src/domain/customer-insight/CustomerInsightService.ts`

**Saknat:**
- Per-user counter (tokens/anrop/dag) med Redis
- Daily spend-cap per provider
- Circuit-breaker vid 4xx från Anthropic
- Anthropic budget-alarm via dashboard

**Rekommendation:** Per-user daily token budget (t.ex. 50k tokens/dag/provider) lagrad i Upstash Redis. Returnera 429 vid överskridning. Vercel cron-job rensar dagligen.

**Effort:** 4-6h.

**Exploitability:** HÖG (auth krävs men attacker kan registrera fler providers utan kostnad).
**Impact:** HÖG (ekonomisk skada, ej dataläckage).

---

### S-2 — HIGH — Hidden provider-routes laddar via direkt-URL i demo

**Risk:** Demo-mode döljer routes från navigation men sidornas `page.tsx` redirectar inte. En demo-användare som gissar URL:en når:

- `/provider/voice-log` (laddar — AI-flöde möjligt)
- `/provider/route-planning` (laddar)
- `/provider/announcements` (laddar — kan trigga broadcast till followers)
- `/provider/due-for-service` (laddar — read-only data)
- `/provider/group-bookings` (laddar)

**Affekterade filer:**
- `src/app/provider/voice-log/page.tsx`
- `src/app/provider/route-planning/page.tsx`
- `src/app/provider/announcements/page.tsx`
- `src/app/provider/due-for-service/page.tsx`
- `src/app/provider/group-bookings/page.tsx`

**Korrekt mönster finns redan** i `reviews/page.tsx`, `export/page.tsx`, `settings/integrations/page.tsx`:

```tsx
const flags = await getFeatureFlagsServer()
if (isDemoModeWithFlags(flags)) {
  redirect("/provider/profile")
}
```

**Rekommendation:** Kopiera redirect-mönstret till de 5 saknade sidorna. Effort: ~15 min totalt.

**Exploitability:** HÖG (URL-gissning räcker).
**Impact:** MEDIUM (kombinerat med S-1 = AI-kostnadsabuse även för demo-users).

---

### S-3 — HIGH — IP-baserad rate-limit för authenticated AI-routes

**Risk:** Alla rate-limiters i `src/lib/rate-limit.ts` är IP-baserade. För publika endpoints (login, register) är detta korrekt. För **authenticated AI-routes** är det fel:

1. **Två providers från samma kontor/ISP** kan DOS varandra på AI-pool.
2. **En attacker med roterande IPs** kringgår limit fullständigt.
3. **In-memory fallback (dev)** har 200/min — 10× högre tröskel än Upstash-pool, vilket maskerar problemet i tests.

**Affekterade filer:**
- `src/lib/rate-limit.ts` (limiter-definitioner)
- Alla AI-endpoints (se S-1)

**Rekommendation:** Lägg till `userId`-aware limiter för auth-routes (`rateLimitByUser(userId, ...)`). IP-limiter behålls som extra lager.

**Effort:** 3-4h.

**Exploitability:** MEDIUM.
**Impact:** MEDIUM-HIGH (kombinerar med S-1).

---

### S-4 — MEDIUM — Admin UI-pages renderar skal för icke-admin

**Risk:** Erik Järnfot (demo-leverantör, **inte admin**) kan navigera till `/admin` och `/admin/users` och se admin-skalet (sidebar, rubriker, kolumnnamn). API:erna returnerar korrekt 403, så **ingen data exponeras**. Men informationsläckaget exponerar admin-routes-struktur, knapp-labels och funktionalitet.

**Bekräftat under audit:**
```
GET /admin → HTTP 200, sidebar med "Användare/Audit Log/System/MFA/..." renderas
Console: 403 från /api/admin/stats och /api/admin/mfa/status
GET /admin/users → HTTP 200, kolumn-headers renderas, 403 från /api/admin/users
```

**Affekterade filer:**
- `src/app/admin/page.tsx` och övriga `src/app/admin/**/page.tsx`
- `middleware.ts` (skyddar bara mot **unauthenticated**, inte fel roll)

**Rekommendation:** Lägg `isAdmin`-check i admin-layoutens server-component → `redirect('/')` vid icke-admin. Befintligt mönster finns i `withApiHandler`-server-side, behöver paralleliseras för UI.

**Effort:** 30 min.

**Exploitability:** HÖG (auth krävs men ej admin).
**Impact:** LÅG (information disclosure, ingen data).

---

### S-5 — MEDIUM — 139 av 182 routes använder INTE `withApiHandler`

**Risk:** Inkonsekvent säkerhetsmönster gör review svårt. Routes som använder direkt `auth()` + manuell rollkontroll kan missa:
- Rate-limiting
- Admin audit-logging
- Standardiserad felhantering
- Generiska felmeddelanden (info-leakage-skydd)

**Affekterade filer:** ~139 route.ts under `src/app/api/`.

**Rekommendation:** Inkrementell migrering. Inte en stor refactor — prioritera enligt:
1. Side-effect-routes (delete, mail, AI, broadcast)
2. Admin-adjacent routes
3. Read-only routes (sist)

**Effort:** Spår av 1 sprint (10-15 routes/sprint).

**Exploitability:** LÅG (latent risk).
**Impact:** MEDIUM (process-risk).

---

### S-6 — MEDIUM — MFA-enforcement bara i middleware, inte i handlers

**Risk:** Admin-routes har `withApiHandler({ auth: "admin" })` som kollar `isAdmin` men **inte** att JWT `iat` är inom MFA-window. Middleware gör den checken, men om middleware skulle slå fel (caching, edge-case) går admin-routes igenom utan MFA-bevis.

**Affekterade filer:**
- `src/lib/api-handler.ts`
- `middleware.ts`

**Rekommendation:** Lägg JWT `iat`-validering även i `withApiHandler` för admin-nivå. Defense-in-depth.

**Effort:** 2h.

**Exploitability:** LÅG (kräver middleware-bug).
**Impact:** HÖG (admin-bypass).

---

### S-7 — MEDIUM — Push-notiser saknar demo-blocker

**Risk:** `demo_email_blocker` lades till i `EmailService.send()` igår, men `PushDeliveryService.sendToDevices()` har ingen motsvarande guard. Om en demo-user accepterar booking, skickas push till seedade `deviceToken` (om sådana finns) — i staging finns inga, men i prod kan en demo-flag aktiveras med riktiga tokens.

**Affekterade filer:**
- `src/domain/notification/PushDeliveryService.ts`

**Rekommendation:** Samma pattern som demo_email_blocker — tidig-exit i `sendToDevices()` med `[DEMO_PUSH_BLOCKED]`-log.

**Effort:** 30 min.

**Exploitability:** LÅG.
**Impact:** LÅG (staging) — MEDIUM (prod om demo-flag aktiveras).

---

### S-8 — MEDIUM — Payment-route delegerar ownership-check till service

**Risk:** `POST /api/bookings/[id]/payment` anropar `PaymentService.processPayment(bookingId, userId)`. Routen själv kollar inte att `bookingId` tillhör `userId`. Om service-implementationen någon gång ändras (refactor, ny path) kan IDOR uppstå.

**Affekterade filer:**
- `src/app/api/bookings/[id]/payment/route.ts`

**Rekommendation:** Lägg explicit `findByIdForCustomer(bookingId, userId)` i routen, eller dokumentera invariant i service-test.

**Effort:** 1h.

**Exploitability:** LÅG (ingen aktuell bug).
**Impact:** HÖG (IDOR om service degraderas).

---

### S-9 — LOW — Cron-routes saknar Vercel-header-validering

**Risk:** Cron-routes kontrollerar `Authorization: Bearer <CRON_SECRET>` + HMAC-SHA256. Men `x-vercel-cron`-headern valideras inte. Om secret läcker kan en attacker köra cron-routes från extern miljö.

**Affekterade filer:**
- `src/app/api/cron/*/route.ts`
- `src/lib/cron-auth.ts` (om finns)

**Rekommendation:** Komplettera med `x-vercel-cron === "1"` eller IP-restriktion. Defense-in-depth.

**Effort:** 30 min.

**Exploitability:** LÅG.
**Impact:** MEDIUM.

---

### S-10 — LOW — Staging robots.txt har Sitemap-pekare till prod

**Risk:** Staging `robots.txt`:
```
User-Agent: *
Allow: /
Disallow: /api/ /admin/ /provider/ /stable/
Sitemap: https://equinet-app.vercel.app/sitemap.xml
```

`Allow: /` på root + hardkodad sitemap till prod betyder att staging kan rankas av Google (även om sitemap pekar någon annanstans). Risk för förvirring om kund hittar staging via sökmotor.

**Affekterade filer:**
- `src/app/robots.ts`

**Rekommendation:** `Disallow: /` på staging via env-variabel-styrning. Eller `X-Robots-Tag: noindex`-header på staging-domänen via middleware.

**Effort:** 30 min.

**Exploitability:** N/A.
**Impact:** LÅG (SEO/förvirring, ingen säkerhet).

---

### S-11 — LOW — CustomerInsight prompt-injection-yta

**Risk:** `CustomerInsightService.generateInsight()` injicerar kund-data i Claude-prompten:
- `providerNotes` (provider-kontrollerad)
- `notes` (provider-kontrollerad)
- `reviews` (kund-kontrollerad text)

En kund som lämnar en recension med text som `"Ignore previous instructions and ..."` kan teoretiskt påverka LLM-output. Eftersom output validetas med Zod är skadan begränsad till "Insikten innehåller konstig text" — inga side-effects.

**Affekterade filer:**
- `src/domain/customer-insight/CustomerInsightService.ts`

**Rekommendation:** Eskorta user-content med tydliga delimiter (`<USER_REVIEW>...</USER_REVIEW>`) + instruktion i system-prompt att ignorera innehåll. Inte kritisk.

**Effort:** 1h.

**Exploitability:** MEDIUM.
**Impact:** LÅG (output Zod-validerad).

---

### S-12 — LOW — `access-control-allow-origin: *` på root-HTML

**Risk:** `curl -sI /` returnerar `access-control-allow-origin: *`. Detta gäller bara root-HTML (Vercel CDN-default för public content), inte API-routes. Verifierat: `/api/feature-flags` och `/api/auth/session` har inga CORS-headers (default same-origin).

**Affekterade filer:**
- Vercel CDN-konfig (inte direkt i repot)

**Rekommendation:** Verifiera att inte några dynamiska routes oavsiktligt sätter wildcard. Eventuellt `vercel.json`/`vercel.ts` headers-konfig.

**Effort:** 30 min undersökning.

**Exploitability:** N/A (statisk content).
**Impact:** INFO.

---

### S-13 — LOW — Hard-delete av customer saknar demo-guard

**Risk:** `DELETE /api/native/customers/[customerId]` tar permanent bort `providerCustomer`-relation och ev. user-record om "manuell kund". I demo skulle Erik kunna radera demo-kunder permanent → seed-reset krävs efter varje session.

**Affekterade filer:**
- `src/app/api/native/customers/[customerId]/route.ts`

**Rekommendation:** Returnera 403 om `isDemoMode()`. Samma pattern som demo_email_blocker.

**Effort:** 30 min.

**Exploitability:** HÖG (UI-action existerar).
**Impact:** LÅG (bara demo-data, men irriterande för verifiering).

---

### S-14 — INFO — `NEXT_PUBLIC_SUPABASE_ANON_KEY` exponerad i HTML

**Risk:** Anon-nyckeln finns i klient-bundle. Detta är **design-intent** för Supabase — RLS + auth-guards skyddar faktisk åtkomst. Nyckeln är bunden till anon-roll med deny-all-default på RLS.

**Affekterade filer:** N/A.

**Rekommendation:** Inget. Säkra att RLS-bevistesterna fortsätter passera i CI.

**Status:** Acceptable design choice.

---

### S-15 — INFO — Demo-credentials hårdkodade

**Risk:** `DemoLoginButton` har `erik.jarnfot@demo.equinet.se / DemoProvider123!` hårdkodade i klient-koden för autologin. Detta är **design-intent** — demo ska vara publik.

**Affekterade filer:** `src/components/landing/DemoLoginButton.tsx`.

**Rekommendation:** Inget. Säkerställ att Erik-kontot ALDRIG har isAdmin = true.

**Status:** Acceptable design choice.

---

### S-16 — INFO — Inga XSS-ytor identifierade

**Risk:** Sökning efter `dangerouslySetInnerHTML` returnerade noll träffar i src/. Inga markdown-rendrare. All user-content renderas via React (default escape). LLM-output Zod-validerad.

**Status:** Bekräftat skydd. Bör flaggas om någon framöver introducerar `react-markdown` etc.

---

## Prioritized remediation

| # | Severity | Finding | Effort | Pre-prod blocker? | Demo-blocker? |
|---|---|---|---|---|---|
| S-1 | HIGH | AI cost-control | 4-6h | ✅ | ✅ |
| S-2 | HIGH | Hidden routes redirect-gate | 15 min | ⚠️ | ✅ |
| S-3 | HIGH | Per-user AI rate-limit | 3-4h | ✅ | ⚠️ |
| S-7 | MEDIUM | Push demo-blocker | 30 min | ⚠️ | ⚠️ |
| S-13 | LOW | Delete customer demo-guard | 30 min | — | ✅ |
| S-4 | MEDIUM | Admin UI role-guard | 30 min | ⚠️ | — |
| S-6 | MEDIUM | MFA i `withApiHandler` | 2h | ✅ | — |
| S-8 | MEDIUM | Payment ownership-check | 1h | ✅ | — |
| S-9 | LOW | Cron Vercel-header | 30 min | — | — |
| S-10 | LOW | Staging robots.txt | 30 min | — | — |
| S-11 | LOW | Prompt-injection delimiters | 1h | — | — |
| S-12 | LOW | Wildcard CORS undersökning | 30 min | — | — |
| S-5 | MEDIUM | `withApiHandler`-migrering | flerspårsspår | — | — |

**Totalt 12 actionable findings** (3 INFO är accept). Hela paketet: ~15-20h effort.

---

## Recommended Security Sprint 1

Föreslagen sprintlängd: **5 arbetsdagar / ~25-30h effort**, parallellt med övrigt arbete.

Se `security-hardening-sprint-backlog.md` för slicad backlog med berarbetad ordning.

**Slice 1 (kvällsturen, 1h totalt):** Quick wins
- S-2 (15 min) — Redirect-gate på 5 sidor
- S-13 (30 min) — Demo delete-guard
- S-7 (30 min) — Push demo-blocker

**Slice 2 (1 dag):** Admin & UI hardening
- S-4 (30 min) — Admin role-guard på UI-pages
- S-6 (2h) — MFA i withApiHandler
- S-10 (30 min) — Robots staging-aware

**Slice 3 (1-2 dagar):** AI cost-control (det viktigaste)
- S-1 + S-3 kombinerade (8-10h) — Per-user budget + rate-limit, Redis counter

**Slice 4 (1 dag):** Routes hardening
- S-8 (1h) — Payment ownership
- S-9 (30 min) — Cron Vercel-header
- S-11 (1h) — Prompt delimiters
- S-12 (30 min) — CORS-undersökning

**Slice 5 (separat, kontinuerligt):** `withApiHandler`-migrering
- S-5: 10-15 routes per sprint, prioritera side-effect-routes först

---

## Appendix: Checklists och referenser

### Återanvändbara mönster från befintliga docs

- **API-route 8-stegs-checklist:** `.claude/rules/api-routes.md`
- **Defense-in-depth pattern:** `docs/security/messaging.md` (5 lager: flag → auth → ownership → RLS → kolumn-GRANT)
- **RLS-bevistest-pattern:** `src/__tests__/rls/rls-proof.integration.test.ts`
- **Rate-limit fail-closed:** `src/lib/rate-limit.ts` + gotcha #5
- **Pentest-metodik:** `docs/security/pentest-2026-04-post-migration.md`

### Verifierings-script (för regression-test)

```bash
# Headers
curl -sI https://equinet-staging.johanlindengard.com/

# CORS på API
curl -sI -H "Origin: https://attacker.example.com" https://equinet-staging.johanlindengard.com/api/feature-flags

# Hidden routes
for r in voice-log announcements route-planning due-for-service group-bookings reviews export; do
  echo -n "/provider/$r: "
  curl -s -o /dev/null -w "%{http_code}\n" "https://equinet-staging.johanlindengard.com/provider/$r"
done

# Admin unauth
curl -s -o /dev/null -w "%{http_code}\n" https://equinet-staging.johanlindengard.com/api/admin/users

# Source maps
curl -s -o /dev/null -w "%{http_code}\n" https://equinet-staging.johanlindengard.com/_next/static/chunks/main.js.map
```

### OWASP ZAP regression

Senast kört 2026-03-29 (`zap-baseline-report.html`). Bör schemaläggas månadsvis mot staging — befintliga rapporter ligger i `docs/security/zap-*`.

### Inte täckt — kandidater för framtida audit

- **iOS-appens client-side**: Keychain-användning, certifikat-pinning, jailbreak-detection
- **Offline-läget**: Service Worker cache, IndexedDB-säkerhet, mutation queue replay-skydd
- **Supabase-konfiguration utöver RLS**: Storage policies, Realtime channels, Edge Functions
- **DNS/TLS/CAA-records**: Cert-pinning, CAA, DNSSEC
- **Dependency audit**: `npm audit` har inte körts som del av denna audit
- **Penetration test med faktisk exploit**: bör beställas externt om compliance-krav

---

**Slut på audit.**

**Inga commits, inga deploys, inga env-writes gjorda.**
**Inget destruktivt test utfört.**
