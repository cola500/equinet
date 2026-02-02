# Non-Functional Requirements (NFR)

**Projekt**: Equinet - Bokningsplattform för hästtjänster
**Version**: v0.2.0+
**Senast uppdaterad**: 2026-02-02
**Status**: 🟡 Work in Progress

---

## 📋 Översikt

Detta dokument definierar de **icke-funktionella kraven** för Equinet-plattformen. NFRs är kvalitetsmål som systemet måste uppfylla för att vara produktionsredo, men som inte direkt beskriver funktionalitet.

**Kategorier:**
1. Performance & Skalbarhet
2. Säkerhet & Privacy
3. Tillgänglighet (Accessibility)
4. Reliability & Availability
5. Maintainability & Code Quality
6. Usability & User Experience

---

## 🚀 1. Performance & Skalbarhet

### 1.1 Response Time Targets

| Endpoint/Page | Target (p95) | Max Acceptable (p99) | Status |
|---------------|-------------|----------------------|--------|
| `/api/providers` (GET) | <200ms | <500ms | ✅ 97ms (2 providers) |
| `/api/bookings` (GET) | <200ms | <500ms | ⚠️ Ej mätt |
| `/api/services` (GET) | <200ms | <500ms | ⚠️ Ej mätt |
| Provider-lista (client render) | <1s | <2s | ✅ Snabb |
| Dashboard (client render) | <1s | <2s | ✅ Snabb |

**Motivering:**
- <200ms = "instant" upplevelse (Google standard)
- <500ms = acceptabelt för de flesta användare
- >1s = användare upplever systemet som långsamt

### 1.2 Payload Size Targets

| Endpoint | Target Size | Max Acceptable | Status |
|----------|------------|----------------|--------|
| `/api/providers` | <50KB | <100KB | ✅ Optimerad (F-3.4) |
| `/api/bookings` | <30KB | <50KB | ⚠️ Ej verifierat |
| Static assets (JS bundles) | <500KB total | <1MB | ⚠️ Ej mätt |

**Learnings från F-3.4:**
- ✅ Over-fetching reducerat med 40-50% genom att använda Prisma `select` istället för `include`
- ✅ Känslig data (email/phone) borttagen = mindre payload + bättre säkerhet

### 1.3 Skalbarhetsmål

**Aktuell kapacitet:**
- 2 providers i databasen
- ~97ms response time för provider-lista

**Målkapacitet (utan performance-degradering):**
- **100 providers**: <150ms response time ✅ (med indexes från F-3.4)
- **1,000 providers**: <200ms response time ✅ (med indexes)
- **10,000 providers**: <400ms response time ✅ (med indexes)
- **100+ concurrent users**: Ej testat ⚠️

**Database Indexes (implementerat F-3.4):**
```prisma
Provider:
  @@index([isActive, createdAt])  // List queries med filter + sort
  @@index([city])                  // City-search
  @@index([businessName])          // Name-search

Service:
  @@index([providerId, isActive])  // Provider's services lookup

Booking:
  @@index([providerId, bookingDate, status])
  @@index([customerId, bookingDate])
  @@index([serviceId])
```

**Impact:** 10-30x snabbare queries vid 1,000+ providers (enligt tech-arkitekt analys)

### 1.4 Pagination Strategy (framtida)

**Trigger:** När provider-listan når 100+ items

**Implementation:**
- Cursor-based pagination (Prisma native)
- Default: 20-50 items per page
- Client-side: Infinite scroll eller pagination controls
- Estimerat arbete: 1-2 timmar

**Exempel:**
```typescript
const providers = await prisma.provider.findMany({
  take: 50,
  skip: page * 50,
  cursor: lastSeenId ? { id: lastSeenId } : undefined,
})
```

### 1.5 Caching Strategy (framtida)

**Server-Side:**
- Next.js ISR med 60s revalidation för provider-lista
- Redis cache för ofta-lästa data (bookings, availability)

**Client-Side:**
- SWR eller React Query med stale-while-revalidate
- 5 min cache för sökresultat

**CDN:**
- Cloudflare/Vercel Edge för statiska routes
- Image optimization med Next.js `<Image>` component

**Estimerat arbete:** 2-3 timmar

---

## 🔒 2. Säkerhet & Privacy

### 2.1 Implementerat (MVP)

| Requirement | Status | Detaljer |
|-------------|--------|----------|
| Password hashing | ✅ | bcrypt, 10 rounds |
| HTTP-only cookies | ✅ | NextAuth sessions |
| CSRF protection | ✅ | NextAuth built-in |
| SQL injection protection | ✅ | Prisma ORM (parameterized queries) |
| XSS protection | ✅ | React auto-escaping |
| Input validation | ✅ | Zod på både client & server |
| Authorization checks | ✅ | Session + ownership checks |
| GDPR-compliant API | ✅ | Email/phone ej exponerat (F-3.4) |

### 2.2 Säkerhet -- Implementeringsstatus

**Implementerat:**
- [x] **Rate limiting** -- Upstash Redis (5/h login, 10/h bookings, 100/h publika endpoints)
- [x] **HTTPS-only** -- Vercel automatiskt + HSTS via next.config.ts security headers
- [x] **CSP Headers** -- Strict policy i next.config.ts (inkl. worker-src blob: för bildkomprimering)
- [x] **Security Headers** -- X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin (via next.config.ts)
- [x] **Password strength requirements** -- Implementerat (F-3.1)
- [x] **Audit logging** -- logger.security() för känsliga operationer

**Kvarstår:**
- [ ] 2FA för provider-konton
- [ ] Automated security scanning (Snyk, Dependabot)

### 2.3 GDPR Compliance

**Implementerat:**
- ✅ Minimering av personuppgifter (email/phone ej i publikt API)
- ✅ Bcrypt hashing av lösenord

**Implementerat:**
- [x] User data export (GDPR Article 20) -- /api/export/my-data (JSON + CSV)
- [x] Horse data export -- /api/horses/[id]/export

**Kvarstår:**
- [ ] Privacy Policy
- [ ] Cookie consent banner
- [ ] User data deletion ("right to be forgotten")
- [ ] Data retention policy

---

## ♿ 3. Tillgänglighet (Accessibility)

### 3.1 Målnivå

**Target:** WCAG 2.1 Level AA compliance

**Motivering:**
- Level A = minimum (ej tillräckligt)
- Level AA = industry standard (rekommenderat)
- Level AAA = overkill för MVP

### 3.2 Implementerat (MVP)

| Requirement | Status | Exempel |
|-------------|--------|---------|
| ARIA labels | 🟡 Partial | Password requirements (F-3.1) |
| Semantic HTML | ✅ | `<button>`, `<nav>`, `<main>` |
| ARIA live regions | ✅ | Screen reader support i PasswordRequirements |
| Keyboard navigation | 🟡 Partial | Fungerar men ej testat systematiskt |
| Focus indicators | ✅ | Default browser focus rings |

### 3.3 Saknas för WCAG AA

**Kritiska:**
- [ ] **Keyboard navigation testing**
  - Tab order ska vara logisk
  - Alla interaktiva element nåbara med keyboard
  - Escape-tangent stänger modals/dialogs

- [ ] **Color contrast**
  - Verifiera alla text/background-kombinationer
  - Ratio ≥ 4.5:1 för normal text
  - Ratio ≥ 3:1 för large text (18pt+)
  - Tool: Chrome DevTools "Inspect Accessibility"

- [ ] **Screen reader testing**
  - Testa med NVDA (Windows) eller VoiceOver (Mac)
  - Verifiera att alla actions är announced

- [ ] **Mobile touch targets**
  - Min size: 44x44px (Apple HIG)
  - Min spacing: 8px mellan targets

**Nice-to-have:**
- [ ] Skip navigation link
- [ ] Focus trap i modals
- [ ] ARIA labels på alla form inputs

### 3.4 Testing Strategy

```bash
# Automated accessibility testing
npm install --save-dev @axe-core/playwright

# E2E test med accessibility check
test('should be accessible', async ({ page }) => {
  await page.goto('/providers')
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
  expect(accessibilityScanResults.violations).toEqual([])
})
```

---

## 🛡️ 4. Reliability & Availability

### 4.1 Uptime Targets

**MVP Target:** 99.5% uptime
- = ~43 timmar downtime per år
- = ~3.6 timmar per månad
- Realistiskt för MVP utan 24/7 on-call

**Produktion Target:** 99.9% uptime
- = ~8.7 timmar downtime per år
- = ~43 minuter per månad
- Kräver monitoring + incident response

### 4.2 Error Rate Targets

| Error Type | Target | Max Acceptable | Status |
|------------|--------|----------------|--------|
| API 5xx errors | <0.1% | <1% | ⚠️ Ej mätt |
| API 4xx errors | <5% | <10% | ⚠️ Ej mätt |
| Client errors (crashes) | <0.1% | <1% | ⚠️ Ej mätt |

**Monitoring:**
- [x] Sentry för error tracking
- [ ] Vercel Analytics för performance monitoring
- [ ] Custom metrics dashboard (Grafana eller Vercel)

### 4.3 Retry & Error Handling

**Implementerat (F-3.3):**
- ✅ `useRetry` hook med max 3 retries
- ✅ `ErrorState` component för unified error UX
- ✅ Toast notifications med retry-action
- ✅ Loading states under retry

**Pattern:**
```typescript
const { retry, retryCount, isRetrying, canRetry } = useRetry({
  maxRetries: 3,
  onMaxRetriesReached: () => toast.error('Max retries reached')
})

// On error:
<ErrorState
  title="Något gick fel"
  description={error}
  onRetry={() => retry(fetchData)}
  isRetrying={isRetrying}
  retryCount={retryCount}
  canRetry={canRetry}
/>
```

### 4.4 Backup & Disaster Recovery

**Saknas (kritiskt för produktion):**
- [ ] **Automated backups**
  - Frequency: Daglig (minimum)
  - Retention: 30 dagar
  - Tool: Vercel Postgres automated backups

- [ ] **Point-in-time recovery**
  - Ability to restore to any point inom 7 dagar
  - PostgreSQL native feature

- [ ] **Recovery Time Objective (RTO)**
  - Target: <4 timmar från incident till system online
  - Requires: Runbook + incident response plan

- [ ] **Recovery Point Objective (RPO)**
  - Target: <1 timme data loss max
  - Requires: Frequent backups + transaction logs

**Testing:**
- [ ] Restore-test var 3:e månad (verifiera att backups funkar!)

---

## 🧰 5. Maintainability & Code Quality

### 5.1 Test Coverage Targets

| Area | Target Coverage | Min Coverage | Status |
|------|----------------|--------------|--------|
| **Overall** | 70% | 60% | ⚠️ Ej mätt |
| **API Routes** | 80% | 70% | 🟡 ~60% (F-3.3 testad) |
| **Utilities** | 90% | 80% | ✅ 100% (validation.ts) |
| **Hooks** | 80% | 70% | ✅ 100% (useRetry) |
| **Components** | 60% | 50% | 🟡 ~40% |

**Nuvarande status (2026-02-02):**
- ✅ 1144/1144 unit/integration tests passing
- ✅ 66 E2E tests passing

**Coverage command:**
```bash
npm run test:coverage
```

### 5.2 TypeScript Strictness

**Requirement:** ZERO TypeScript errors

**Config:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Verification:**
```bash
npm run typecheck
# Output: No errors ✅
```

### 5.3 Code Review Standards

**Requirements:**
- [ ] All PRs must be reviewed before merge
- [ ] No direct commits to `main` (enforce with branch protection)
- [ ] CI/CD must pass (tests + linting)
- [ ] At least 1 approval required

**Review Checklist:**
- [ ] TypeScript errors: 0
- [ ] Tests written & passing
- [ ] Security considerations addressed
- [ ] Performance implications considered
- [ ] Documentation updated (README, SPRINT docs)

### 5.4 Code Style & Linting

**Tools:**
- [x] ESLint konfiguration (flat config, eslint.config.mjs)
- [ ] Prettier konfiguration
- [x] Husky pre-push hook (test:run, typecheck, check:swedish, lint)
- [ ] lint-staged för staged files

**Kommando:**
```bash
npm run lint        # Kör ESLint
npm run format      # Kör Prettier
```

### 5.5 Dependency Management

**Policy:**
- [ ] **Monthly security audit**: `npm audit`
- [ ] **Dependabot alerts**: Enable på GitHub
- [ ] **Major version updates**: Test thoroughly innan merge
- [ ] **Deprecated packages**: Replace inom 3 månader

**Current dependencies:**
- Next.js 16.1.4 ✅
- Prisma 6.19.0 ✅
- NextAuth v5 (beta.30) ✅
- React 19 ✅

### 5.6 Documentation Standards

**Requirement:** All features må ha dokumentation

**Levels:**
1. **Code comments** (engelsk) - komplex business logic
2. **Component README** - nya shared components
3. **SPRINT docs** - alla features i sprint-planeringen
4. **CLAUDE.md** - utvecklingsprocesser & patterns
5. **README.md** - user-facing features & setup

**Exempel:**
- ✅ F-3.3 Retry-mekanik: Dokumenterat i SPRINT-1.md + kod-kommentarer
- ✅ E2E testing learnings: Dokumenterat i CLAUDE.md
- ✅ Performance-optimering (F-3.4): Dokumenterat i SPRINT-1.md + NFR.md

---

## 👤 6. Usability & User Experience

### 6.1 UX Targets (från Sprint 1)

| Metric | Baseline | Target | How to Measure |
|--------|----------|--------|----------------|
| **Provider Activation Rate** | ~40% | 75%+ | % providers som kompletterar onboarding inom 24h |
| **Error Recovery Rate** | ~30% | 70%+ | % fel där user lyckas efter retry utan page reload |
| **Password Creation Success** | ~70% | 90%+ | % users som skapar giltigt lösenord på första försöket |
| **Support Tickets (avbokning)** | Baseline | -80% | Antal tickets om "är min avbokning bekräftad?" |

**Status:** ⚠️ Ej mätt (MVP har inga users än)

### 6.2 Page Load Performance (Core Web Vitals)

**Targets:**
- **LCP** (Largest Contentful Paint): <2.5s
- **FID** (First Input Delay): <100ms
- **CLS** (Cumulative Layout Shift): <0.1

**Measurement:**
- Google PageSpeed Insights
- Vercel Analytics
- Chrome DevTools Lighthouse

### 6.3 Mobile Responsiveness

**Requirement:** All pages må vara fully responsive

**Breakpoints:**
```css
mobile: 0-640px
tablet: 640-1024px
desktop: 1024px+
```

**Testing:**
- [ ] Chrome DevTools Device Mode
- [ ] Faktiska devices (iPhone, Android)
- [ ] Playwright E2E tests med mobile viewport

### 6.4 Browser Support

**Supported:**
- Chrome/Edge: Last 2 versions ✅
- Firefox: Last 2 versions ✅
- Safari: Last 2 versions ✅

**NOT supported:**
- Internet Explorer (deprecated)
- Opera Mini
- UC Browser

---

## 📊 Monitoring & Metrics (Framtida)

### 7.1 Application Performance Monitoring (APM)

**Tool:** Sentry eller Vercel Analytics

**Metrics to track:**
- API response times (p50, p95, p99)
- Error rates (4xx, 5xx)
- Page load times
- User sessions & active users
- Database query performance

### 7.2 Business Metrics

**Dashboard (framtida):**
- New user registrations (customer vs provider)
- Active providers (% with ≥1 service)
- Bookings per day/week
- Conversion rate (visitor → registration → booking)
- Provider activation rate (F-3.4 onboarding checklist)

### 7.3 Alerting Rules

**Critical alerts (PagerDuty/Email):**
- [ ] API error rate >5% för 5 minuter
- [ ] Database connection errors
- [ ] Uptime <99.5%
- [ ] Payment processing failures

**Warning alerts (Slack):**
- [ ] API p95 response time >500ms
- [ ] Disk usage >80%
- [ ] Memory usage >80%

---

## ✅ NFR Checklist - Production Readiness

### Must-Have (Critical för produktion)

**Performance:**
- [x] Database indexes för alla filter/sort-fält
- [x] API payload optimering (select vs include)
- [ ] Response time monitoring
- [ ] Load testing (100+ concurrent users)

**Security:**
- [x] Password hashing (bcrypt)
- [x] Input validation (Zod)
- [x] GDPR-compliant API (no email/phone exposure)
- [x] Rate limiting (Upstash Redis)
- [x] HTTPS-only + Security headers (next.config.ts)
- [ ] Security audit (Snyk/Dependabot)

**Reliability:**
- [x] Error handling & retry logic
- [ ] Automated backups (daglig)
- [ ] Disaster recovery plan
- [ ] Uptime monitoring

**Code Quality:**
- [x] TypeScript strict mode
- [x] Unit tests (≥70% coverage)
- [x] E2E tests (critical flows)
- [x] ESLint (flat config)
- [x] Pre-push hooks (Husky)

### Should-Have (viktigt men ej blockerande)

**Accessibility:**
- [ ] WCAG AA compliance
- [ ] Screen reader testing
- [ ] Keyboard navigation testing

**Monitoring:**
- [x] APM tool (Sentry)
- [ ] Business metrics dashboard
- [ ] Alerting rules

**UX:**
- [ ] Core Web Vitals <targets
- [ ] Mobile responsiveness testing
- [ ] Cross-browser testing

### Nice-to-Have (framtida förbättringar)

- [ ] 2FA för providers
- [ ] Caching strategy (Redis)
- [ ] CDN för static assets
- [ ] Advanced monitoring (Grafana)

---

## 📝 Maintenance Schedule

### Daglig
- [ ] Check error logs (Sentry dashboard)
- [ ] Monitor uptime (Vercel/Pingdom)

### Veckovis
- [ ] Review performance metrics
- [ ] Triage open issues/bugs

### Månadsvis
- [ ] Security audit (`npm audit`)
- [ ] Dependency updates
- [ ] Review & update NFRs baserat på learnings

### Kvartalsvis
- [ ] Full security review
- [ ] Backup restore-test
- [ ] Performance optimization sprint
- [ ] Accessibility audit

---

**Dokumentägare**: Johan Lindengård
**Senast granskad**: 2026-02-02
