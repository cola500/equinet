---
title: "Sprint 48: iOS auth-desync-fix + miljö-hardening"
description: "Lös pre-launch-blocker i iOS auth-flödet + strukturera miljöerna (staging/prod-separation)."
category: sprint
status: planned
last_updated: 2026-04-20
tags: [sprint, ios, auth, environments, staging, pre-launch]
sections:
  - Sprint Overview
  - Stories
  - Risker
  - Definition of Done
---

# Sprint 48: iOS auth-desync-fix + miljö-hardening

## Sprint Overview

**Mål:** Två oberoende pre-launch-hinder:
1. **Fixa iOS auth-desync** (S46-3-fynd) — grundläggande installations-flöde på ny enhet är brustet
2. **Strukturera miljöerna** — dedikerad staging, iOS-scheman per miljö, `.env`-hierarki-städning

**Scope-avgränsning:** iOS prod-separation (separat bundle ID för prod) väntar tills **Apple Developer Program är köpt** (99 USD). S48 fokuserar på local-dev + staging för iOS. Vercel prod-URL fortsätter vara `equinet-app.vercel.app` (egen domän köps senare).

**S47-hooks live under sprinten** — förväntat beteende:
- Plan-commit-gate blockerar om planen saknas
- Branch-check blockerar kod-commit på main
- Review-obligatorisk-gate kräver rätt subagents per ändrad fil
- Sprint-retro-gate blockerar retro-commit på main utan feature branch

Procedurbrott-mål: **≤2** (mot S47:s 6).

---

## Stories

### S48-0: iOS auth-desync-fix (pre-launch blocker)

**Prioritet:** 0
**Effort:** 1-2h
**Domän:** `ios/Equinet/Equinet/AuthManager.swift` + ev. `NativeSessionExchange`-logik

**Bakgrund:** S46-3-audit upptäckte att native login via Supabase Swift SDK sätter Supabase JWT i Keychain, men:
- Startar inte MobileToken-exchange (`/api/auth/native-session-exchange`)
- Populerar inte WebView cookie-store

**Konsekvens:** Ny enhet + native login → WebView-sidor (Meddelanden, Bokningar) visar "Kunde inte ladda"-fel. Grundläggande installations-flöde är brustet.

**Aktualitet verifierad:**
- Återtesta på simulator med fresh-install: logga in native, öppna WebView-sida (t.ex. Meddelanden)
- Verifiera att auth-desync fortfarande finns (eller om något annat arbete råkat fixa det)
- Grep efter `signIn` + `native-session-exchange` i `AuthManager.swift` för att förstå nuvarande flöde

**Implementation:**

1. **Undersök** `AuthManager.swift`:
   - Vad händer efter `Supabase.auth.signIn()`?
   - Triggar något session-exchange? Om ja, under vilka villkor?
2. **Fixa** så att session-exchange **alltid** triggas efter lyckad native login:
   - Anropa `/api/auth/native-session-exchange` med Supabase JWT → få MobileToken tillbaka
   - Sätt session-cookie i WebView cookie-store (`WKHTTPCookieStore`)
3. **Testa** med simulator:
   - Fresh install → native login → öppna Meddelanden (WebView) → ska visa tråd-lista
   - Fresh install → native login → öppna Bokningar (WebView) → ska visa bokningar
4. **Dokumentera** i `.claude/rules/ios-learnings.md`: "QA-fresh-install-testflöde"

**Säkerhetskrav:**
- Bearer JWT för `/api/auth/native-session-exchange` (inte session-cookie — endpointen är just till för att **skapa** cookien)
- MobileToken lagras fortsatt i Keychain (App Group)
- WebView cookie-store populeras med session-cookie från response

**Acceptanskriterier:**
- [ ] Fresh install + native login + WebView-sida → ingen "Kunde inte ladda"
- [ ] Session-cookie sätts konsekvent efter native login (inte conditional)
- [ ] iOS-tester (XCTest) utökade med AuthManager-scenariot
- [ ] `ios-learnings.md` dokumenterar QA-testflöde
- [ ] Visuell verifiering via mobile-mcp

**Reviews:**
- `code-reviewer` (obligatorisk per review-matris för `.swift`-filer)
- `ios-expert` (obligatorisk)
- `security-reviewer` (auth-relaterad, MEN review-matrisen fångar det inte automatiskt — **Dev måste köra manuellt**. Detta är en känd lucka från S47-0 (auth-UI-gap) som delvis gäller auth-kod i iOS också.)

**Arkitekturcoverage:** N/A (bugg-fix, ingen designstory)

---

### S48-1: Miljö-hardening — staging-struktur + env-hierarki

**Prioritet:** 1
**Effort:** 1 dag
**Domän:** Vercel-konfiguration + iOS scheman + `scripts/status.sh` + docs

**Bakgrund:** "Hitta rätt miljö"-problemet från 2026-04-20-diskussion:
- `.env.local` trumfar `.env` (Vercel CLI-trigger)
- Staging = Vercel Preview (ad-hoc per PR, inte stabil URL)
- iOS staging == production (samma URL)
- `environments.md` delvis inaktuell (Docker vs Supabase CLI)

**Scope (vad som faktiskt kan göras nu):**

#### S48-1.1: Dedikerad staging-deployment

- Konfigurera Vercel med **aliaserad staging-URL**: `equinet-staging.vercel.app`
- Staging pekar på Supabase-projekt `zzdamokfeenencuggjjp` (redan existerande)
- Staging-deployments triggras via specifik branch (`staging`?) eller via Vercel CLI
- Dokumentera i `environments.md`

#### S48-1.2: iOS staging-scheme med rätt URL

- `AppConfig.swift` staging-case pekar på `equinet-staging.vercel.app` (inte prod-URL)
- Bundle ID för staging: **väntar** — kräver Apple Developer Program
- För nu: scheme-switching via `-STAGING` CLI-argument fortsätter fungera som idag, men pekar rätt

#### S48-1.3: `.env`-hierarki-städning

- Dokumentera exakt prioritet: `.env.example` → `.env` → `.env.local` (Next.js-regel)
- Förtydliga gotcha i `docs/guides/gotchas.md` (Vercel CLI skriver `.env.local` med remote-creds)
- Uppdatera `.env.example` med korrekt lokal + staging-exempel (kommentarer)

#### S48-1.4: `npm run status` utökas med aktiv miljö

- `scripts/status.sh` visar:
  - Current env: local / staging / production (baserat på `DATABASE_URL`-host)
  - Supabase-projekt-ref (om remote)
  - Vercel-environment (om URL pekar på Vercel)
- Rött varningsmeddelande om lokal dev pekar på **remote** Supabase

#### S48-1.5: Uppdatera `environments.md`

- Ta bort Docker PostgreSQL (ersatt av Supabase CLI i S17-7)
- Dokumentera staging-deployment (ny S48-1.1)
- Matris med URL × Supabase-projekt × auth-källa per miljö

**Acceptanskriterier:**
- [ ] `equinet-staging.vercel.app` är en stabil URL (inte per-PR-preview)
- [ ] iOS staging-scheme pekar rätt
- [ ] `npm run status` visar aktiv miljö tydligt
- [ ] `environments.md` reflekterar faktiskt läge (inte Docker-referenser)
- [ ] `.env.example` har korrekta kommentarer för varje miljö

**Reviews:**
- `code-reviewer` (obligatorisk för `scripts/` + docs)
- `tech-architect` (arkitekturell — miljö-struktur påverkar alla)

**Arkitekturcoverage:** Uppdaterar `environments.md` som är designdokument.

---

### S48-2 (valfri): gh pr merge-wrapper

**Prioritet:** 2 (valfri, beror på tid)
**Effort:** 30-45 min
**Domän:** `scripts/gh-pr-merge.sh` + `.gitconfig` alias

Stänger S47-4-luckan: Dev self-merge av non-rule-docs PR.

**Implementation:**

```bash
# scripts/gh-pr-merge.sh
#!/usr/bin/env bash
PR="$1"
shift
bash "$(dirname "$0")/check-own-pr-merge.sh" "$PR" || exit 1
gh pr merge "$PR" "$@"
```

Git alias: `merge-pr = !bash scripts/gh-pr-merge.sh`

Använd: `git merge-pr 123 --merge --delete-branch`

**Acceptanskriterier:**
- [ ] Scriptet kör check-own-pr-merge FÖRE gh pr merge
- [ ] Git alias fungerar
- [ ] Dokumenterat i `commit-strategy.md`

**Reviews:** `code-reviewer`

---

## Risker

| Risk | Sannolikhet | Mitigering |
|------|-------------|-----------|
| iOS auth-desync-fix bryter befintligt login-flöde | Medel | Testa både fresh-install OCH befintlig-install. iOS-tester före merge. |
| Staging-deployment kostar pengar (Vercel) | Låg | Vercel Hobby tillåter oändliga preview, stable alias gratis på Pro. Om Hobby räcker: OK. |
| S47-hooks blockerar Dev vid legitimt arbete | Låg | Override-mekanismen finns. Dokumentera vid användning i commit-msg. |
| Apple Developer-begränsningar stoppar iOS-arbete | Låg | Scope-avgränsat — prod-separation väntar tills Apple köpt. |

---

## Definition of Done (sprintnivå)

- [ ] iOS auth-desync fixad + verifierad på simulator
- [ ] Staging-deployment live på `equinet-staging.vercel.app`
- [ ] iOS staging-scheme pekar rätt URL
- [ ] `npm run status` visar aktiv miljö
- [ ] `environments.md` uppdaterad
- [ ] `npm run check:all` grön
- [ ] Procedurbrott ≤ 2 (testar S47-enforcement i verkligt arbete)
- [ ] Sprint-avslut via feature branch + PR (per S47-5-regeln)

**Inte i scope:**
- iOS prod-separation (Apple Developer)
- Egen domän (equinet.se)
- `gh pr merge`-wrapper (S48-2, valfri)
- Auth-UI-rad i review-matrisen (egen backlog-rad)
