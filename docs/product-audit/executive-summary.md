---
title: "Equinet -- Executive Summary & Pitch"
description: "Exekutiv genomgång: affärscase, produkt, teknik och processmodell"
category: architecture
status: active
last_updated: 2026-04-22
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
- **Meddelanden med kund** per bokning (text + bildbilagor, push-notiser, smart replies)

**Kundens upplevelse:**
- Hitta och boka leverantörer i närheten
- Se sina hästar, besökshistorik och hälsotidslinje
- Omboka själv utan att ringa
- Få påminnelser 24h före besök
- **Skriva med leverantören** i trådvy per bokning, inklusive dela bilder på hovar/skador

**Administratörens verktygslåda:**
- MFA med TOTP-enrollment, AAL2-enforcement på alla admin-routes
- AdminAuditLog med success- och failure-spårning för forensics
- GDPR-retentionspolicy med automatisk cron-körd rensning
- Session-timeout 15 min för admin-aktioner

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
| Kodbas | ~114k rader produktionskod (webb + iOS) |
| Databas | 45 Prisma-modeller, PostgreSQL via Supabase |
| API | 169+ routes, 22+ domänservices |
| Arkitektur | DDD-Light med repository pattern för kärndomäner |
| Tester | 4314 unit/integration + 22 E2E = 4336+ tester (E2E-svit slimmad för testpyramid) |
| Säkerhet | Supabase Auth, 28 RLS-policies, rate limiting, HSTS, CSP, webhook-idempotens, MFA för admin (TOTP + AAL2) |
| CI/CD | GitHub Actions, coverage-gate, branch protection, 6 pre-commit/pre-push hooks som enforcement-as-code |
| Hosting | Vercel (webb) + Supabase (databas + auth + storage) |
| Miljöer | Dedikerad staging-URL + separata Supabase-projekt för staging/prod |

**Arkitekturbeslut som särskiljer:**
- **Row Level Security** med 28 policies och 24 bevistester -- databasnivå-skydd, inte bara applikationslogik
- **Offline-first PWA** med mutation queue, circuit breaker och exponentiell backoff -- fungerar utan internet
- **Feature flags i PostgreSQL** med admin-toggle, env-override och 30s server-cache
- **Stripe webhook-idempotens** med event-ID dedup och terminal-state-guards
- **Supabase Storage med magic bytes-validering** för bildbilagor -- fail-closed, lita aldrig på Content-Type
- **Transaktionellt upload-mönster** -- rollback av Storage om DB-insert failar (orphaned files hellre än orphaned rows)
- **Enforcement-as-code** -- 6 git-hooks som blockerar vanliga procedurbrott (commit på fel branch, skippad review, sprint utan retro) med override-mekanism
- **Test-svit för hooks** -- 37 tester för själva processautomationen

---

## 4. Processperspektiv: Hur en icke-utvecklare byggde detta

Det här är kanske den mest intressanta delen.

**Equinet är byggt av en person som inte är utvecklare.** Johan är agilist -- hans expertis är processdesign, inte programmering. All kod är skriven av AI-agenter (Claude Code) som styrs av ett processramverk som Johan designat.

**Ramverket i siffror:**
- 51 sprintar (50 klara + 1 pågående), ~200 stories, 1895 commits på knappt 6 månader (november 2025 -- april 2026)
- Stationsflöde: PLAN -> RED -> GREEN -> REVIEW -> VERIFY -> MERGE
- TDD obligatoriskt -- tester skrivs alltid före implementation
- Automatiska quality gates: typecheck + 4314 tester + lint + svenska tecken
- Code review av AI-subagenter (security-reviewer, cx-ux-reviewer, tech-architect, ios-expert)
- Maskinläsbar review-matris (glob-baserad): ändrade filer → krävda reviewers
- Retrospektiv efter varje sprint med lärdomar som matas tillbaka
- **Enforcement-hooks** som gör det tekniskt omöjligt att hoppa obligatoriska steg

**Processevolutionen:**

| Fas | Sprintar | Fokus |
|-----|----------|-------|
| Bygga | S1-S9 | Features, en agent åt gången, manuell kvalitetskontroll |
| Mogna | S10-S17 | Auth-migrering (NextAuth -> Supabase), RLS, infrastruktur |
| Polera | S18-S22 | Onboarding, härdning, branch protection, ops-docs |
| Optimera | S23-S26 | Token-effektivitet (-48%), parallella sessioner, subagent-mönster |
| Formalisera | S27-S35 | Feature flag-rollout-process, Seven Dimensions story-refinement, messaging-arkitektur |
| Självtesta | S36-S42 | Self-testing v1-v3, arkitekturcoverage, metacognition-gates, testpyramid-omfördelning |
| Härda | S43-S47 | Process-drift identifierad → enforcement-as-code (6 hooks, 37 tester, override-mönster) |
| Lansera | S48-S52 | iOS auth-fix, miljö-separation, pre-launch-blockers, teater-gap-analys |

**Vad som gör det möjligt:**
- **CLAUDE.md** (257 rader) -- projektets "grundlag" som varje agent läser
- **17+ rules-filer** -- kontextspecifika regler som laddas vid behov (selektiva)
- **Kodkarta** -- auto-genererad domän-till-fil-mapping som eliminerar 70% av agenternas sökningar
- **Quality gates** -- pre-commit hooks, coverage-gate i CI, branch protection. Agenter kan inte leverera dålig kod.
- **Done-filer med lärdomar** -- varje avslutad story dokumenterar gotchas som förhindrar att samma misstag upprepas
- **Enforcement-hooks** med override-mönster `[override: <motivering>]` -- blockerar fel med säkerhetsventil

**Bevisade skalningsmonster (S24-S47):**
- Parallella sessioner med domänuppdelning (Opus för svårt, Sonnet för mekaniskt)
- Research-agenter som kartlägger komplex kod innan implementation
- Parallella code reviews som ger 40% snabbare feedback
- Sessionsfiler per agent som eliminerar merge-konflikter
- **Djävulens-advokat-review** -- tech lead kör review med skepsis-prompt för att fånga vad Dev:s egna reviews missade
- **Seven Dimensions story-refinement** -- feature-idéer slicas systematiskt från epic till MVP-story
- **Teater som gap-analys-metod** -- product owner rollspelar användarflöden för att upptäcka gap mellan kod och upplevelse (premiär 2026-04-22)

**Processkvalitet mätbart:**
- Procedurbrott per sprint: S43-S46 snitt ~8 → S48 2 → S49 0-1. Enforcement fungerar empiriskt.
- 2 real-world-saves under S47 där hookar fångade verkliga procedurbrott

**Det här är inte "AI skrev lite kod åt mig".** Det är ett produktionssystem med 4336+ tester, säkerhetshärdning inklusive MFA och AAL2-enforcement, incident response-plan och enforcement-as-code som gör processen självläkande -- byggt av en person som designade processen som AI:n följer.

---

## 5. Vad som återstår

**Inga kodblockerare för smal-scope-lansering.** De som blockerar är externa:

| Vad | Kostnad | Tid |
|-----|---------|-----|
| Apple Developer-konto | $99/år | 15 min config |
| Stripe företagsverifiering | Gratis | Pågår |
| Vercel Pro | $20/mån | 5 min config |

**Driftkostnad vid lansering:** ~$45/mån (Vercel Pro $20 + Supabase Free + Stripe per transaktion).

**Medvetet utvidgad scope före lansering (S51-S52):**

Teater-gap-analysen 2026-04-22 identifierade att appen saknar tre delar för att kännas "komplett" vid förstagångskundens upplevelse:

1. **Pre-booking messaging** -- kund kan idag inte kontakta leverantör förrän bokning finns (Slice 5 i messaging-epic). Johan valde att implementera före launch.
2. **Pending-transparens** -- kund sitter i limbo efter bokningsförfrågan utan att veta om leverantören sett den.
3. **Pro-aktiv review-uppmaning** -- kunder glömmer recensera eftersom ingen notis triggar.

S52 adresserar alla tre. Total extra scope: ~3.5-4 dagar. Beslutet: bredare produkt vid launch värt fördröjningen.

---

## 6. Sammanfattning

Equinet är en komplett, produktionsklar bokningsplattform för en underservad nisch. Den är tekniskt mogen (4336+ tester, RLS, MFA, Stripe-idempotens), designad för offline-användning (ambulerande leverantörer med dålig täckning), och byggd med en process som bevisar att en icke-utvecklare kan leverera produktionskvalitet med AI-agenter.

Sedan föregående version (2026-04-13) har messaging med bilagor levererats, admin-MFA härdats, iOS auth-desync lösts, miljöerna separerats, och process-hardening v2 gjort 6 procedurbrott-typer tekniskt omöjliga. Teater-metodik har introducerats som ny gap-analys-teknik.

Tre klick och $120 skiljer fortfarande från lansering. S52 är ett medvetet val att lansera bredare snarare än snabbare.

---

*Senast uppdaterad: 2026-04-22 | Baserad på 51 sprintar (50 klara + 1 pågående), 1895 commits, knappt 6 månaders utveckling*
