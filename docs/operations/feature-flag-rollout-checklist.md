---
title: "Feature Flag Rollout Checklist"
description: "Generisk checklista för att sätta en feature flag till defaultEnabled: true i produktion"
category: operations
status: active
last_updated: 2026-04-19
sections:
  - Bakgrund
  - Pre-rollout
  - Rollout
  - Post-rollout
  - Rollback
---

# Feature Flag Rollout Checklist

## Bakgrund

Checklistan säkerställer att en feature är testad i webb och iOS innan flaggan aktiveras för alla användare. S37-rollout av messaging visade att iOS-verifiering kan missas — detta ledde till en trasig upplevelse för iOS-leverantörer i 24h.

**Regel:** Kör denna checklista INNAN `defaultEnabled: true` committas.

---

## Pre-rollout (OBLIGATORISKT)

### Webb-audit

- [ ] Feature är testad med Playwright MCP eller manuell verifiering i dev/staging
- [ ] Rollout-dokument finns i `docs/operations/<feature>-rollout.md`
- [ ] Inga MAJOR-fynd kvarstår från code-reviewer eller security-reviewer
- [ ] `npm run check:all` grön (4/4 gates)

### iOS-audit (OBLIGATORISKT om feature påverkar leverantörer eller kunder)

- [ ] Feature verifierad via mobile-mcp eller manuell test i iOS-simulator
- [ ] Om provider-feature: kontrollera att den finns i **båda**:
  - `src/components/layout/ProviderNav.tsx` (webb-navigation)
  - `ios/Equinet/Equinet/NativeMoreView.swift` (iOS Mer-flik)
- [ ] Om push-integration finns: verifiera deep-link-URL:er fungerar i iOS

### API och data

- [ ] Inga pending Prisma-migrationer (`npm run migrate:status`)
- [ ] API-routes bakom feature flag testad både med flagga on/off

---

## Rollout

```bash
# 1. Uppdatera feature flag
# I src/lib/feature-flag-definitions.ts:
# defaultEnabled: true

# 2. Commit + push
git commit -am "feat: aktivera <feature>-flagga (defaultEnabled: true)"

# 3. Verifiera migration om relevant
npm run migrate:status

# 4. Deploy via vanligt PR-flöde
git push origin feature/<feature>-activation
gh pr create ...
```

---

## Post-rollout (dag 1-7)

- [ ] Sentry: inga nya fel med feature-relaterade stack traces
- [ ] Loggar: inga oväntade 4xx/5xx från feature-routes
- [ ] Manuell test i produktion: feature fungerar end-to-end

---

## Rollback

Om problem uppstår:

1. **Via admin-panelen:** Admin → System → Feature flags → stäng av flaggan
   - Effekt: omedelbar (30s cache-TTL)
2. **Via miljövariabel:** Sätt `FEATURE_<NAMN>=false` i Vercel → deploya om
3. **Via kod:** Sätt `defaultEnabled: false` i `feature-flag-definitions.ts` → commit → deploy

**Ingen databasmigrering behövs** — data bevaras, bara UI och API-gating stängs.
