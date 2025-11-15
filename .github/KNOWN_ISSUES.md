# Known Issues

## ~~Next.js 15.0.3 - E2E Test Execution Problem~~ ✅ LÖST!

**Status:** ✅ FIXAT i Next.js 15.5.0
**Discovered:** 2025-11-15
**Resolved:** 2025-11-15
**Affects:** Playwright E2E test execution (Next.js 15.0.3 only)

### Problem Description

Next.js 15.0.3 har en fundamental bug med manifest-filgenerering som förhindrar att E2E-tester kan köras via Playwright. När Playwright startar en egen Next.js dev-server för testning, failar servern med MODULE_NOT_FOUND errors för viktiga manifest-filer.

### Error Messages

```
Error: Cannot find module './vendor-chunks/next-auth.js'
Error: Cannot find module '.next/server/middleware-manifest.json'
Error: Cannot find module '.next/server/routes-manifest.json'
Error: Cannot find module '.next/server/pages-manifest.json'
```

### Impact

- ❌ **E2E-tester kan INTE köras** automatiskt
- ✅ **Dev-server fungerar normalt** för manuell utveckling
- ✅ **Produktionsbyggen påverkas INTE**
- ✅ **Unit-tester fungerar normalt** (Vitest)

### Workarounds

**För utveckling:**
1. Använd manuell testning i browser
2. Dev-server (`npm run dev`) fungerar helt normalt
3. Alla features har testats manuellt och fungerar

**För E2E-tester:**
- Skippas tillfälligt
- Testkod är skriven och committed (kan köras när Next.js är fixat)
- Se `e2e/` för alla test specs

### ✅ Solution Implemented

**2025-11-15: Uppgradera till Next.js 15.5.0**
1. ✅ Uppgraderade till Next.js 15.5.0
2. ✅ Fixade 2 selector-problem i route-planning E2E-tester
3. ✅ Alla 7 route-planning E2E-tester passerar nu!
4. ✅ Manifest-filer genereras korrekt
5. ✅ Dev-server startar snabbt (1.5s) utan fel

**Resultat:**
- E2E-tester kan nu köras automatiskt ✅
- Playwright startar dev-server utan problem ✅
- Redo för CI/CD-integration ✅

### Related Issues

- Next.js GitHub Issue: [Manifest generation bug](https://github.com/vercel/next.js/issues) (sök på "manifest")
- Webpack cache strategy errors i Next.js 15.0.3

### Testing Status

| Test Suite | Status | Notes |
|------------|--------|-------|
| Unit Tests (Vitest) | ✅ Fungerar | Inga problem |
| E2E Tests (Playwright) | ❌ Blockerad | Next.js bug |
| Manuell Testning | ✅ Fungerar | Alla features verifierade |
| Production Build | ✅ Fungerar | Ingen påverkan |

### Files Affected

```
.next/server/middleware-manifest.json
.next/server/routes-manifest.json
.next/server/pages-manifest.json
.next/server/vendor-chunks/*.js
```

### Last Updated

2025-11-15 - Dokumenterat problem och workarounds
