---
title: "Sprint 9: Produktionshärdning (UTKAST)"
description: "Kritiska items från tech-architect review + demo-feedback. Justeras efter demo."
category: sprint
status: draft
last_updated: 2026-04-02
tags: [sprint, security, production, hardening, demo-feedback]
sections:
  - Sprint Overview
  - Stories
  - Sprint Retro Template
---

# Sprint 9: Produktionshärdning (UTKAST)

**Status:** UTKAST -- justeras efter demo-feedback
**Sprint Duration:** 1 vecka
**Sprint Goal:** Säkra produktionsmiljön innan skalning. Kritiska items från tech-architect review.

---

## Sprint Overview

Tech-architect identifierade blinda fläckar som måste åtgärdas innan vi
onboardar riktiga leverantörer. Den här sprinten fokuserar på det som
inte är synligt för användaren men avgörande för pålitlighet.

---

## Stories

### S9-1: Branch protection + Dependabot -- READY

**Prioritet:** Högst
**Typ:** DevOps
**Beskrivning:** Direkta commits till main med Stripe live-mode är oacceptabelt. Konfigurerar GitHub branch protection och Dependabot.

**Uppgifter:**
1. GitHub -> Settings -> Branches -> Branch protection rule för `main`:
   - Require pull request before merging (1 approval)
   - Require status checks (CI)
   - No force pushes
2. Skapa `.github/dependabot.yml` för npm + GitHub Actions
3. Uppdatera AGENTS.md: Lead mergar via PR istället för direkt push

**Acceptanskriterier:**
- [ ] Direkta commits till main blockerade av GitHub
- [ ] Dependabot skapar PRs för säkerhetsuppdateringar
- [ ] Workflow uppdaterat (Lead skapar PR istället för `git push`)

**OBS:** Detta ändrar Lead:s merge-flow. `LEAD_MERGE=1 git push` ersätts av `gh pr create + gh pr merge`.

**Effort:** 1h
**Stationsflöde:** Förenklat: Green -> Verify -> Merge

---

### S9-2: Stripe webhook idempotens-verifiering -- READY

**Prioritet:** Hög
**Typ:** Säkerhet
**Beskrivning:** Stripe webhooks levereras "at least once". Verifiera att dubbla events inte ger dubbla bokningsbekräftelser.

**Uppgifter:**
1. Skriv integrationstest: kör `payment_intent.succeeded` event 2 gånger med samma payload
2. Verifiera att PaymentWebhookService returnerar tidigt vid redan-succeeded status
3. Verifiera att inga dubbla notiser/email skickas

**Acceptanskriterier:**
- [ ] Test bevisar idempotens (dubbel-event, samma resultat)
- [ ] Befintlig `if (payment.status === "succeeded") return` bekräftad tillräcklig

**Effort:** 1h
**Stationsflöde:** Red -> Green -> Review -> Verify -> Merge

---

### S9-3: Staging-databas (separat Supabase-projekt) -- READY

**Prioritet:** Hög
**Typ:** DevOps
**Beskrivning:** Dev och prod delar potentiellt samma Supabase. Risk: lokal migration ändrar prod-schema.

**Uppgifter:**
1. Skapa nytt Supabase-projekt "equinet-staging"
2. Applicera alla 31 migrationer
3. Uppdatera `.env` med staging-URL som default
4. Dokumentera: vilken URL för dev, staging, prod
5. Uppdatera `docs/operations/environments.md`

**Acceptanskriterier:**
- [ ] Separat Supabase-projekt existerar
- [ ] Migrationer applicerade
- [ ] `.env` pekar på staging (inte prod)
- [ ] Dokumenterat

**Effort:** 2-4h
**Stationsflöde:** Förenklat: Green -> Verify -> Merge

---

### S9-4: customer_insights AI-spike -- READY

**Prioritet:** Medel
**Typ:** Research/spike
**Beskrivning:** `customer_insights` är default on men AI-kopplingen är overifierad. Samma mönster som voice logging spike (S7-4).

**Uppgifter:**
1. Läs CustomerInsightService -- vilken AI-provider? Modell-ID?
2. Finns API-nyckel konfigurerad?
3. Fungerar det end-to-end?
4. Beslut: flagga på eller av

**Leverans:** `docs/research/customer-insights-spike.md`
**Effort:** 1 dag
**Tidbox:** Max 1 session
**Stationsflöde:** Förenklat: Research -> Dokumentera -> Review

---

### S9-5: Onboarding-spike -- READY

**Prioritet:** Medel
**Typ:** Research/spike
**Beskrivning:** Hur registrerar sig leverantör #2 utan seed-data? Vad saknas i self-service-flödet?

**Uppgifter:**
1. Testa registreringsflödet som ny leverantör (equinet-app.vercel.app/register)
2. Dokumentera: vad fungerar, vad saknas, vad är förvirrande
3. Identifiera minimum viable onboarding (vilka steg krävs?)
4. Effort-uppskattning för att fixa luckorna

**Leverans:** `docs/research/onboarding-spike.md`
**Effort:** 0.5 dag
**Stationsflöde:** Förenklat: Research -> Dokumentera -> Review

---

### S9-6: Vercel Analytics + Backup-dokumentation -- READY

**Prioritet:** Låg
**Typ:** DevOps
**Beskrivning:** Snabba vinster: Core Web Vitals via Vercel Analytics (15 min) + dokumentera backup RPO/RTO (1h).

**Uppgifter:**
1. `npm install @vercel/analytics` + `<Analytics />` i root layout
2. Dokumentera RPO/RTO i `docs/operations/backup-policy.md`
3. Testa restore-flow (hur återställer vi Supabase?)

**Effort:** 1.5h
**Stationsflöde:** Förenklat: Green -> Verify -> Merge

---

### S9-N: Demo-feedback stories -- TBD

> Läggs till efter leverantörsdemon.

---

## Prioritetsordning

1. **S9-1** Branch protection (30 min, kritiskt)
2. **S9-2** Webhook idempotens (1h, säkerhet)
3. **S9-3** Staging-databas (2-4h, DevOps)
4. **S9-4** customer_insights spike (1 dag)
5. **S9-5** Onboarding-spike (0.5 dag)
6. **S9-6** Analytics + backup (1.5h)

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### Processändring till nästa sprint?

> Varje sprint MÅSTE resultera i minst en processförbättring.

### Demo-feedback som påverkade sprinten?
