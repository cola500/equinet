---
title: "Sprint 53: Webb demo-värdig (leverantörsvinklad)"
description: "Kort sprint för att göra webben demo-värdig för en leverantörspublik. S51/S52 avbrutna 2026-04-22."
category: sprint
status: planned
last_updated: 2026-04-22
tags: [sprint, demo, provider, web]
sections:
  - Sprint Overview
  - Stories
  - Definition of Done
---

# Sprint 53: Webb demo-värdig (leverantörsvinklad)

## Sprint Overview

**Mål:** Göra webben demo-värdig för EN pilot-leverantör (hovslagare/veterinär/liknande) som utvärderar om Equinet är värt att använda.

**Demo-värdig = "kan visas utan att rodna".** Inte lansering. Inte produktionsklart.

**Pivot-kontext:** S51 + S52 avbrutna 2026-04-22 efter process-kost-retron. Johan valde demo-fokus istället för pre-launch-härdning. Se `memory/project_pivot_to_demo.md`.

**Scope-princip:** `demo_mode`-flaggan (`src/lib/demo-mode.ts`) döljer redan allt utom provider-kärnan (dashboard, calendar, bookings, customers, services, profile). Vi polerar bara dessa 6 paths.

**Effort-mål:** ≤ 1 arbetsdag totalt. Inte mer.

---

## Stories

### S53-0: Demo-flöde smoke-test + pinsam-fixes

**Prioritet:** 0
**Effort:** 2-3h
**Domän:** `src/app/provider/*` (de 6 demo-tillåtna paths)

**Vad:** Klicka igenom hela leverantörsflödet i Playwright MCP med `demo_mode=true`. Dokumentera varje "rodna"-moment — hydration-warnings, console-errors, tomt state, null-crashes, stavfel, brutna bilder.

**Flöde att gå igenom:**
1. `/login` → logga in som provider
2. `/provider/dashboard` — vad renderas? Alla kort fungerar?
3. `/provider/calendar` — visa + klicka på bokning
4. `/provider/bookings` — lista + detaljvy + messaging-tråd
5. `/provider/customers` — lista + detaljvy + anteckningar
6. `/provider/services` — lista + skapa/redigera
7. `/provider/profile` — redigera profil

**Fix-regel:** Varje fynd som går att fixa på <30 min → fixa direkt i denna story. Övrigt → backlog-rad.

**Acceptanskriterier:**
- [ ] Alla 7 steg genomgångna, screenshots sparade i `docs/metrics/demo-walkthrough-2026-04-23/`
- [ ] Console i browser tom vid varje sida (eller kända warnings dokumenterade)
- [ ] Fynd som fixades: listade med commit-hash
- [ ] Fynd som inte fixades: backlog-rader med repro-steg

**Reviews:** Ingen subagent-review (audit-story, triviala fix-or-document-loop)

---

### S53-1: FAQ-rotorsak + SEO-återställning

**Prioritet:** 1
**Effort:** 45-60 min
**Domän:** `src/app/page.tsx` + ev. `src/components/ui/accordion.tsx`

**Ärvd från S51-4** (se sprint-51.md för kontext). Commit `908aee19` gömde FAQ-svar från SSR för att kringgå React 19 hydration-mismatch. Regressionen: Google indexerar inte FAQ-svar, och hydration-warning syns i console för demo-publiken.

**Fix-alternativ** (i ordning):
- A: Uppgradera Radix (om nyare version fixar)
- B: Byta till native `<details>/<summary>` (zero-JS, ingen hydration-risk, fullt SEO-bart)
- C: Riktad `suppressHydrationWarning` som sista utväg

Acceptans + review-matris enligt sprint-51.md S51-4.

---

### S53-2: Demo-seed för en leverantör

**Prioritet:** 2
**Effort:** 1.5-2h
**Domän:** `scripts/seed-demo-provider.ts` (ny) + `docs/operations/demo-setup.md` (ny)

**Vad:** Script som skapar en realistisk demo-leverantör:

- **Provider:** "Erik Järnfot" (hovslagare), profilbild (valfri placeholder), beskrivning, besöksområde, verifierad
- **Tjänster:** 4-5 st (omskoning, verkning, akutbesök, ungdomsverkning, bedömning)
- **Kunder:** 8-10 st med 1-2 hästar vardera
- **Bokningar:** 15-20 st (mix av past/future, olika status)
- **Recensioner:** 6-8 st med varierat betyg
- **Anteckningar:** Några kund- och bokningsanteckningar

**Krav:**
- Idempotent — kan köras flera gånger, upsert-baserad
- Markera med `E2E-spec:demo-provider` så data kan städas
- Dokumentera inloggning i `docs/operations/demo-setup.md`

**Acceptanskriterier:**
- [ ] Script kör utan fel mot lokal DB
- [ ] Kör igen → inga dubbletter
- [ ] Manuell demo-walkthrough efteråt visar trovärdig data (inga "Testbokning 42"-strängar)
- [ ] Docs-fil med inloggning + hur demo återställs

**Reviews:** `code-reviewer` (obligatorisk för scripts/)

---

### S53-3 (valfri): "Se demo"-knapp på landningssidan

**Prioritet:** 3 (valfri)
**Effort:** 30-45 min
**Domän:** `src/app/page.tsx` + ny API-route

**Vad:** På landningssidan, när `demo_mode=true` är aktiv: lägg till knapp "Se demo som leverantör" som auto-loggar in som demo-providern (via test-login-endpoint eller pre-seeded session).

Gör det frictionless att starta demo — en klick från kall start till provider-dashboard.

**Utesluts om S53-0 + S53-2 tar hela dagen.** Demo kan köras via manuell inloggning också.

**Reviews:** `code-reviewer` (obligatorisk)

---

## Definition of Done (sprintnivå)

- [ ] S53-0 done: flöde dokumenterat + snabba fynd fixade
- [ ] S53-1 done: FAQ renderar korrekt i SSR utan hydration-warning
- [ ] S53-2 done: demo-leverantör seed-bar med ett kommando
- [ ] (valfri) S53-3 done: "Se demo"-knapp funkar
- [ ] `npm run check:all` 4/4 grön
- [ ] Manuell demo-genomkörning: jag kan visa webben utan att rodna
- [ ] Sprint-avslut via feature branch + PR

**Inte i scope:**
- iOS
- Messaging-polish (döljs av demo_mode-flaggan — utanför provider-kärnan)
- Admin-verktyg
- Stripe
- Pre-booking messaging (ex-S52)
- MFA-polish (ex-S51-0.1 minor-fynd)
- Staging/prod-hardening

**Post-sprint:** Visa för pilot-leverantör → få feedback → prioritera om.
