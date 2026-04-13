---
title: "Equinet -- Executive Summary & Pitch"
description: "Exekutiv genomgång: affärscase, produkt, teknik och processmodell"
category: architecture
status: active
last_updated: 2026-04-13
tags: [executive, pitch, strategy, product]
sections:
  - Affärsperspektiv
  - Produktperspektiv
  - Tekniskt perspektiv
  - Processperspektiv
  - Vad som återstår
  - Sammanfattning
---

# Equinet -- Executive Summary & Pitch

## 1. Affärsperspektiv: Varför marknaden behöver detta

**Problemet:** Sveriges ~120 000 hästägare anlitar ambulerande specialister -- hovslagare, veterinärer, massörer, tandläkare. Idag bokas dessa via telefon, SMS och Facebook-grupper. Leverantörerna kör mil efter mil utan optimerade rutter. Ingen digital infrastruktur finns.

**Möjligheten:** Det här är frisör- och tandläkarbranschens bokningsproblem, fast med en twist -- tjänsterna kommer till kunden, inte tvärtom. Det skapar behov som Bokadirekt/Calendly inte löser:
- **Ruttplanering** -- leverantören behöver optimera sin dag geografiskt
- **Ruttannonsering** -- "Jag kör genom Enköping på torsdag, 2 lediga tider"
- **Besöksintervall** -- "Denna häst behöver hovslagare var 8:e vecka"
- **Gruppbokningar** -- ett stall bokar gemensamt för att sänka utryckningsmilen

**Marknaden:** Nichad men djup. En hovslagare har 200-400 kunder, besöker varje häst 6-8 gånger/år, tar 800-1500 kr/besök. En enda leverantör omsätter 1-2 MSEK/år. Med 10 leverantörer och 5% av transaktionsvärdet = potentiellt 50-100k ARR bara i Sverige.

**Timing:** Hästbranschen är digitalt underservad. De stora bokningsplattformarna har ignorerat den för att volymen ser liten ut. Men kundlojaliteten är extremt hög -- byter du inte hovslagare om du är nöjd.

---

## 2. Produktperspektiv: Vad som är byggt

**Equinet** är en komplett bokningsplattform för hästtjänster med webb + iOS-app.

**Leverantörens verktygslåda:**
- Bokningshantering (skapa, bekräfta, avboka, omboka, återkommande serier)
- Kundregister med hästkoppling, besökshistorik och AI-drivna kundinsikter
- Ruttplanering med kartvy och optimering
- Ruttannonsering -- kunder ser lediga tider och bokar sig på annonserade rutter
- Röstloggning -- diktera arbetsanteckningar, AI tolkar och kopplar till rätt bokning
- Besöksplanering ("Dags för besök") med automatiska påminnelser
- Affärsinsikter -- populära tjänster, tidsanalys, kundretention
- Gruppbokningar för stallgemenskaper

**Kundens upplevelse:**
- Hitta och boka leverantörer i närheten
- Se sina hästar, besökshistorik och hälsotidslinje
- Omboka själv utan att ringa
- Få påminnelser 24h före besök

**iOS-app:**
- Hybrid med native SwiftUI-vyer (dashboard, bokningar, kunder, tjänster, kalender, profil)
- Push-notiser, kalendersynk till iOS Kalender, widget på hemskärmen
- Offline-stöd med automatisk synk vid återanslutning
- Röstloggning med native taligenkänning

**Betalning:**
- Stripe-integration (kort + Swish) -- kod klar, väntar på företagsverifiering
- Webhook-idempotens för säker betalningshantering
- Prenumerationsinfrastruktur för monetarisering

**20 feature flags** gör att funktionalitet kan slås på/av utan deploy. 13 är aktiva, resten väntar på konfiguration eller affärsbeslut.

---

## 3. Tekniskt perspektiv: Hur det är byggt

| Dimension | Fakta |
|-----------|-------|
| Stack | Next.js 16 (App Router) + TypeScript + Prisma + Supabase + Stripe |
| iOS | Swift/SwiftUI, hybrid WKWebView + native vyer |
| Kodbas | 97k rader webb + 17k rader iOS = 114k rader produktionskod |
| Databas | 43 Prisma-modeller, PostgreSQL via Supabase |
| API | 169 routes, 20 domänservices |
| Arkitektur | DDD-Light med repository pattern för kärndomäner |
| Tester | 4045 unit/integration + 373 E2E = 4418 tester, 70% coverage |
| Säkerhet | Supabase Auth, 28 RLS-policies, rate limiting, HSTS, CSP, webhook-idempotens |
| CI/CD | GitHub Actions, coverage-gate, branch protection, pre-push hooks |
| Hosting | Vercel (webb) + Supabase (databas + auth) |
| Production Readiness | 79% (50/63 NFR-krav uppfyllda) |

**Arkitekturbeslut som särskiljer:**
- **Row Level Security** med 28 policies och 24 bevistester -- databasnivå-skydd, inte bara applikationslogik
- **Offline-first PWA** med mutation queue, circuit breaker och exponentiell backoff -- fungerar utan internet
- **Feature flags i PostgreSQL** med admin-toggle, env-override och 30s server-cache
- **Stripe webhook-idempotens** med event-ID dedup och terminal-state-guards
- **44% testkod** (77k rader tester vs 114k prod) -- investering i kvalitet från dag 1

---

## 4. Processperspektiv: Hur en icke-utvecklare byggde detta

Det här är kanske den mest intressanta delen.

**Equinet är byggt av en person som inte är utvecklare.** Johan är agilist -- hans expertis är processdesign, inte programmering. All kod är skriven av AI-agenter (Claude Code) som styrs av ett processramverk som Johan designat.

**Ramverket i siffror:**
- 26 sprintar, ~140 stories, 1401 commits på 5 månader (november 2025 -- april 2026)
- Stationsflöde: PLAN -> RED -> GREEN -> REVIEW -> VERIFY -> MERGE
- TDD obligatoriskt -- tester skrivs alltid före implementation
- Automatiska quality gates: typecheck + 4045 tester + lint + svenska tecken
- Code review av AI-subagenter (security-reviewer, cx-ux-reviewer, tech-architect)
- Retrospektiv efter varje sprint med lärdomar som matas tillbaka

**Processevolutionen:**

| Fas | Sprintar | Fokus |
|-----|----------|-------|
| Bygga | S1-S9 | Features, en agent åt gången, manuell kvalitetskontroll |
| Mogna | S10-S17 | Auth-migrering (NextAuth -> Supabase), RLS, infrastruktur |
| Polera | S18-S22 | Onboarding, härdning, branch protection, ops-docs |
| Optimera | S23-S26 | Token-effektivitet (-48%), parallella sessioner, subagent-mönster |

**Vad som gör det möjligt:**
- **CLAUDE.md** (257 rader) -- projektets "grundlag" som varje agent läser
- **13 rules-filer** -- kontextspecifika regler som laddas vid behov (76% selektiva)
- **Kodkarta** -- auto-genererad domän-till-fil-mapping som eliminerar 70% av agenternas sökningar
- **Quality gates** -- pre-commit hooks, coverage-gate i CI, branch protection. Agenter kan inte leverera dålig kod.
- **Done-filer med lärdomar** -- varje avslutad story dokumenterar gotchas som förhindrar att samma misstag upprepas

**Bevisade skalningsmonster (S24-S26):**
- Parallella sessioner med domänuppdelning (Opus för svårt, Sonnet för mekaniskt)
- Research-agenter som kartlägger komplex kod innan implementation
- Parallella code reviews som ger 40% snabbare feedback
- Sessionsfiler per agent som eliminerar merge-konflikter

**Det här är inte "AI skrev lite kod åt mig".** Det är ett produktionssystem med 4418 tester, säkerhetshärdning, incident response-plan och 79% production readiness score -- byggt av en person som designade processen som AI:n följer.

---

## 5. Vad som återstår

**Inga kodblockerare.** De tre sakerna som blockerar lansering är externa:

| Vad | Kostnad | Tid |
|-----|---------|-----|
| Apple Developer-konto | $99/år | 15 min config |
| Stripe företagsverifiering | Gratis | Pågår |
| Vercel Pro | $20/mån | 5 min config |

**Driftkostnad vid lansering:** ~$45/mån (Vercel Pro $20 + Supabase Free + Stripe per transaktion).

---

## 6. Sammanfattning

Equinet är en komplett, produktionsklar bokningsplattform för en underservad nisch. Den är tekniskt mogen (4418 tester, RLS, Stripe-idempotens), designad för offline-användning (ambulerande leverantörer med dålig täckning), och byggd med en process som bevisar att en icke-utvecklare kan leverera produktionskvalitet med AI-agenter.

Tre klick och $120 skiljer den från lansering.

---

*Genererad: 2026-04-13 | Baserad på 26 sprintar, 1401 commits, 5 månaders utveckling*
