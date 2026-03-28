---
title: Retrospektiv -- teknisk genomlysning och cleanup Q1 2026
description: Lärdomar från det tekniska förbättringsspåret med Claude Code
category: retro
status: current
last_updated: 2026-03-28
sections:
  - Mål
  - Vad fungerade bra
  - Vad var svårt
  - Hur fungerade Claude
  - Vad gör vi annorlunda
  - Största vinsterna
  - Rekommendation framåt
---

# Retrospektiv -- teknisk genomlysning och cleanup Q1 2026

> 12 commits, 112 ändrade filer, +6571/-2687 rader, 3755 tester, 0 regressioner.

---

## Mål

Förstå om kodbasen hade dolda strukturella risker som skulle bromsa framtida utveckling. Om ja -- åtgärda de viktigaste med låg risk och hög effekt, utan att stoppa produktarbete.

---

## Vad fungerade bra

### Tekniskt

**Batchvis rollmigrering** var sessionens mest effektiva mönster. 47 routes migrerades i 6 batchar utan en enda regression. Nyckeln: varje batch var mekanisk och förutsägbar, med parallella agenter som hanterade 3-4 routes var. Totalt ~3 timmar effektiv tid.

**withApiHandler gav omedelbart värde.** 18 routes, -886 LOC. Piloten (3 routes) visade mönstret, sedan var varje ny batch ren copy-paste av samma approach. Befintliga tester passerade utan ändringar i 15 av 18 routes.

**PaymentService-refaktorn var den renaste ändringen.** Servicen fanns redan med identisk logik -- routen behövde bara anropa den. 281 -> 104 LOC, inga beteendeändringar. Det bästa exemplet på "gör inte nytt, använd det som finns".

**Testsäkring av specialroutes hittade reella brister.** Fortnox OAuth-routen hade 0 tester. IDOR-skyddet i reschedule var odokumenterat (visade sig vara korrekt, men nu bevisat). Route-orders saknade feature flag-tester och cross-role-tester.

### Arbetsprocess

**Analys före implementation** var avgörande. Genomlysningsdocs (architecture-review, code-quality-review, changeability-review) identifierade exakt vilka problem som var verkliga och vilka som bara "såg stora ut". BookingService visade sig inte vara ett god object -- bara centralt. Det sparade en onödig refaktorering.

**Stegvis scope** fungerade bättre än en stor plan. Varje spår (roller -> wrapper -> booking -> payment -> selects -> tester -> flags -> cleanup) var ett eget avgränsat beslut. Vi kunde pausa och byta fokus vid naturliga brytpunkter.

**"Gör det nu eller vänta"-bedömningen** var konsekvent användbar. Varje doc avslutas med "vad bör göras nu vs vid behov". Det förhindrade scope creep.

### Användning av Claude

**Parallella agenter** för mekaniska ändringar var extremt effektivt. Rollmigreringen körde 3 agenter per batch, varje agent hanterade 4-5 filer. Inga merge-konflikter, inga inkonsistenser. Total tid per batch: ~2-3 minuter.

**Utforskningsagenter** för inventering var bättre än manuell kodläsning. Tre parallella explore-agenter kartlade arkitektur, kodkvalitet och dependencies på ~1 minut.

---

## Vad var svårt / ineffektivt

**PaymentService-filerna glömdes bort.** 6 filer med aktiv produktionskod var untracked. Upptäcktes först under repo-cleanup -- kunde ha orsakat problem vid deploy. Lärdomen: efter stora refaktoreringar, kör `git status` och verifiera att alla nya filer som importeras faktiskt är committade.

**Pre-push hook blockerade push.** Lint-fel i en orelaterad fil (`integrations/page.tsx`) blockerade push av alla 16 commits. Felet hade funnits länge men upptäcktes inte förrän push. Lärdomen: kör `npm run lint` som del av check:all, inte bara vid push.

**Docs-sprawl.** Genomlysningen producerade 15+ nya markdown-filer i docs/. De flesta är värdefulla som referens, men docs/-roten blev rörig. En del av dem (roles-migration-progress, api-wrapper-plan) blev historiska mitt i sessionen.

**Wrapper-migrering hade avtagande avkastning.** Batch 1 (pilot) gav 57% LOC-reduktion. Batch 3 gav 30%. Routes med mycket affärslogik (due-for-service: 166 -> 140 LOC) drar inte lika stor nytta. Vi pausade vid rätt tidpunkt, men kunde ha pausat en batch tidigare.

---

## Hur fungerade Claude

### Som bäst

**Mekaniska batchändringar.** Rollmigrering och wrapper-migrering var Claudes sweet spot: tydligt mönster, tydliga regler, parallelliserbart. Noll kreativitet behövdes -- bara konsekvent exekvering.

**Kodanalys och kartläggning.** Explore-agenter som läste 20+ filer och producerade strukturerade rapporter var snabbare och mer konsistenta än manuell granskning. Booking-domänanalysen identifierade exakt vilka metoder som duplicerade vilken validering.

**TDD-disciplin.** Tester skrevs först (RED), implementation sedan (GREEN). Alla 18 wrapper-tester, 14 roles-tester och 19 specialroute-tester följde detta mönster.

### När det blev fel

**IDOR-falskt alarm i reschedule.** Analysen flaggade att reschedule-routen saknade IDOR-skydd ("CRITICAL SECURITY GAP"). Manuell verifiering visade att BookingService redan hade skyddet (rad 502-504). Agenten hade inte läst tillräckligt djupt i service-koden. Lärdomen: säkerhetspåståenden från agenter måste alltid verifieras manuellt.

**Testmockar vid rollmigrering.** Piloten avslöjade att `requireProvider` kräver `providerId` i mock-sessioner. Alla befintliga tester saknade detta. Inte ett Claude-fel, men det krävde en insikt som agenten inte förutsåg. Sedan var mönstret dokumenterat och varje följande batch gick smidigt.

**Docs/handoff.json missidentifierad som duplicat.** Repo-cleanup-inventeringen sa att `handoff.json` i root var duplicat av `docs/handoff.json`. Faktiskt hade de helt olika innehåll. Agenten jämförde filnamn, inte innehåll.

### Vilka uppgiftstyper funkade bäst

| Typ | Kvalitet | Kommentar |
|-----|----------|----------|
| Mekaniska batchändringar | Utmärkt | Rollmigrering, wrapper-migrering |
| Kodanalys och inventering | Bra | Arkitekturgenomgång, flag-audit |
| Testskrivning | Bra | Specialroute-tester, IDOR-bekräftelse |
| Säkerhetsbedömning | Mediokert | Falskt IDOR-alarm -- behöver manuell verifiering |
| Dokumentation | Bra | Strukturerade docs, konsekvent format |
| Repo-cleanup inventering | Bra med förbehåll | Missade filinnehåll-jämförelse |

---

## Vad gör vi annorlunda nästa gång

### Promptstrategi

**"Analysera först, implementera sedan"-mönstret bör formaliseras.** Varje spår bör börja med en inventering/doc, sedan en pilot (2-3 filer), sedan batchar. Aldrig bred migrering utan verifierad pilot.

**Säkerhetspåståenden från agenter ska alltid ha verifieringssteg.** "Agenten säger X är en risk" -> "Verifiera X i faktisk kod" -> "Skriv test som bevisar/motbevisar".

### Arbetsdelning

**Pausa batchmigrering vid avtagande avkastning.** Rollmigrering pausades vid 80% (kvarvarande 12 filer hade specialfall). Wrapper pausades vid 18 routes. Båda korrekt. Regeln: om nästa batch kräver mer instruktioner till agenten än den förra, pausa.

**Kör `git status` + `npm run lint` efter varje session.** Untracked filer och lint-fel bör inte samlas upp.

### Verifiering

**Kör hela pre-push-sviten lokalt före sista commit.** `npm run check:all` bör inkludera lint (inte bara typecheck + tester + swedish).

---

## Största vinsterna

### Tekniskt

- **~1000 LOC boilerplate borttaget** utan beteendeändringar
- **Centrala helpers** (roles.ts, api-handler.ts) som alla nya routes bör använda
- **PaymentService som source of truth** -- eliminerade duplicerad logik
- **2 latenta buggar hittade** (saknad Response-catch i notes/quick-note)
- **2 saknade feature flag gates fixade** (customer_insights, due_for_service)

### I arbetssätt

- **Batch-mönstret** (analys -> pilot -> batch -> pausa) är beprövat och repeterbart
- **Parallella agenter** för mekaniska ändringar spar tid utan att offra kvalitet
- **"Gör vi detta nu eller väntar?"** som avslutning på varje doc förhindrar scope creep

### I repo-kvalitet

- **3755 tester** (upp från 3703), inklusive 19 nya för specialroutes
- **15 nya docs** med aktuella genomgångar av arkitektur, domäner, feature flags
- **Renare rot** (handoff-filer arkiverade, artifacts borttagna)

---

## Rekommendation framåt

### När ska vi göra teknikspår igen?

Inte på ett tag. Kodbasen är i gott skick. Nästa teknikspår bör triggas av:

1. **En feature som är svår att bygga** pga strukturella hinder (t.ex. "vi behöver en ny bokningstyp men createBooking() är för rigid")
2. **Samma typ av bugg upprepas** i samma område (t.ex. "tredje gången en route saknar feature flag gate")
3. **Testsviten börjar ge falska positiver** eller bli opålitlig

### Vad ska vi INTE göra proaktivt

- Migrera kvarvarande 12 rollroutes (de har alla specialfall -- gör det vid behov)
- Bygga wrapper v2 (params-stöd, custom rate-limit-key -- workarounds fungerar)
- Omstrukturera docs/ i undermappar (medel insats, låg effekt)
- Refaktorera BookingService till use-cases (inte motiverat med nuvarande scope)

### Fokus nu

Produktarbete. Demo. Användarvärde.
