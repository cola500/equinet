---
title: "Epic: Stallgemenskap och gemensam planering"
description: "Hästägare i samma stall samordnar leverantörsbesök. Slicad enligt Seven Dimensions, med kartläggning av redan byggd (men avstängd) Stable-kod."
category: idea
status: active
last_updated: 2026-06-07
tags: [stable, stall, epic, seven-dimensions, post-launch]
related:
  - docs/ideas/epic-messaging.md
sections:
  - Epic
  - Personas och värde
  - Success-mått
  - Epic Progress
  - Epic Reality Check
  - Nuläge i koden (discovery 2026-06-07)
  - Slicing enligt Seven Dimensions
  - Föreslagna nästa slices
  - Öppna frågor
  - Beslut
  - Nästa steg
---

# Epic: Stallgemenskap och gemensam planering

## Epic

**Som hästägare i ett stall vill jag samordna leverantörsbesök med andra hästägare i samma stall, så att administrationen minskar för både oss och leverantören och besöken planeras tillsammans.**

Många hästägare står i samma stall och använder samma leverantörer (hovslagare, massörer, veterinärer, tandläkare). Idag hanterar varje ägare sina bokningar separat, trots att leverantören ofta besöker flera hästar i samma stall vid samma tillfälle. Det ger mer administration, fler meddelanden och sämre överblick.

## Personas och värde

| Persona | Smärta idag | Förväntat värde |
|---------|-------------|-----------------|
| **Hästägare (primär)** | Bokar separat trots att grannhästen i stallet bokar samma leverantör samma vecka. Ingen överblick över stallets gemensamma behov. | Ser stallets kommande besök, kan anmäla sin häst till ett redan planerat besök. Mindre admin. |
| **Leverantör (primär)** | Planerar resor häst för häst, även när flera står på samma adress. | Ser vilka hästar i ett stall som vill ha besök → planerar flera hästar per resa. Färre, effektivare bokningar. |
| **Stallansvarig (sekundär)** | Ingen digital plats att samla stallets hästägare kring gemensamma aktiviteter. | Skapar och administrerar stallet, bjuder in medlemmar. |

## Success-mått

- Antalet individuella bokningar minskar (flera hästar grupperas till ett besök).
- Leverantörer kan planera flera hästar vid samma besök.
- Hästägare hittar enkelt andra i samma stall.
- Administrationen för både hästägare och leverantörer minskar.
- Stallgemenskapen blir en naturlig del av Equinet.

## Epic Progress

> Epiken är **påbörjad och har levererat grundbyggstenen**. Häst → stalltillhörighet är live som grundfunktion (ingen flagga). Resten av stallägar-flödet finns byggt men avstängt; community/gemensamma besök är obyggt.

### Slice 1 — Häst → Stalltillhörighet

**Status:** Klar (live på staging, 2026-06-07). PR [#378](https://github.com/cola500/equinet/pull/378) + [#379](https://github.com/cola500/equinet/pull/379) + [#380](https://github.com/cola500/equinet/pull/380).

**Levererat:**
- Häst kan kopplas till ett befintligt stall (`StableSelector` på hästprofilens Info-flik).
- Stallnamn visas på hästprofilen.
- Stallnamn visas på hästkortet i listan (visas bara när stall är satt).
- Publik stallsökning fungerar (`/api/stables`, rate-limited, utan kontakt-PII).
- Stall kan väljas om / kopplas bort (omval via `SetNull`).
- Demo-stall **Stall Solbacken** finns i den kanoniska demo-seeden (`scripts/seed-demo-provider.ts`, lokal + staging).
- Verifierat end-to-end på staging: login som Lisa → hästprofil → sök "Solbacken" → välj → namnet visas. `stable_profiles` förblev av.

**Levererat värde:** Hästägaren kan registrera vilket stall hästen står i — den återanvändbara grundbyggsten resten av epiken vilar på (gemensam plats att samordna kring börjar med att veta vilken häst som står var).

**Lärdomar:**
- **Återanvändning > nybygge:** Hela `Stable`-modellen + domän + API + UI fanns redan (byggt ~mars 2026, avstängt). Slicen blev "beskär & aktivera", inte bygga. Discovery före implementation sparade dagar.
- **Flagg-split → flagg-borttagning:** Kärnan bröts först ut till `horse_stable_link`, sedan befordrade PO den till grundfunktion och flaggan togs bort. Stallägar-flödet hölls kvar bakom `stable_profiles`.
- **Vilande kod hade verkliga buggar:** `StableSelector` läste fel svarsform (`data.map` mot `{data:[]}`) → sök gav aldrig träff. Avstängd kod är inte verifierad kod.
- **Säkerhet vid ny exponering:** Att vidga räckvidden (publik sök via grundfunktion) tvingade fram att kontakt-PII (email/telefon) togs bort ur sök-svaret.
- **Seed-systemskuld:** Demo-stallet hamnade först i fel (legacy) seed. Konsolidering gav en kanonisk demo-seed — ny demo-grunddata läggs nu på ett ställe. Se [[feedback_staging_seed_gotchas]].

## Epic Reality Check

| Område | Status | Kommentar |
|--------|--------|-----------|
| Häst → Stall (tillhörighet) | **Levererat** | Live som grundfunktion, ingen flagga. Visas på profil + kort, sök fungerar. |
| Stallsökning (publik) | **Levererat** | `/api/stables`, rate-limited, utan kontakt-PII. |
| Demo-data (Stall Solbacken) | **Levererat** | I kanonisk seed, verifierad på staging. |
| Stallprofiler (`stable_profiles`) | **Finns tekniskt, ej exponerat** | Skapa/redigera stallprofil, se hästar i stallet — byggt men avstängt bakom `stable_profiles` (off). |
| Stallplats-uthyrning (spots) | **Finns tekniskt, ej exponerat** | `StableSpot` + API + UI byggt, avstängt bakom `stable_profiles`. |
| Inbjudningar (invites) | **Delvis / ej exponerat** | E-post-token-invite byggt men avstängt; **ingen medlems-entitet** — "accept" saknar tydlig innebörd. |
| Stallmedlemskap | **Saknas** | Ingen medlems-entitet separat från "äger en häst i stallet". |
| Stallroller (admin/medlem) | **Saknas** | `Stable.userId @unique` = en ägare. Ingen multi-admin, ingen roll. |
| Ansök/godkänn medlemskap | **Saknas** | Bara push-invite finns (avstängt); inget ansöknings-/godkännandeflöde. |
| Häst i flera stall | **Saknas** | `stableId` är single FK → en häst = ett stall. |
| Gemensamma leverantörsbesök | **Saknas** | Epikens kärnvärde. `GroupBookingRequest` finns men är inte stall-kopplad. |
| Leverantörsplanering per stall | **Saknas** | Ingen vy för "vilka hästar i stall X vill ha besök". |
| Aktiviteter/besöksvy per stall | **Saknas** | Ej påbörjat. |

## Nuläge i koden (discovery 2026-06-07)

> **Historisk ögonblicksbild** från discovery-fasen. För aktuell status, se [Epic Progress](#epic-progress) + [Epic Reality Check](#epic-reality-check) ovan. (Sedan dess: häst → stalltillhörighet är **levererad och live** som grundfunktion; raderna "Registrera häst i stall"/"Stallbyte" nedan är nu exponerade, inte bara byggda.)

> **Centralt fynd:** Stora delar av epikens datamodell och stallägar-flöde **är redan byggt** men ligger **avstängt** bakom feature-flaggan `stable_profiles` (`defaultEnabled: false`). Byggdes ~mars 2026 (commit `a7f140dc`, migration `20260309120609_add_stable_models`), före demo-pivoten 2026-04-22, och har legat vilande sedan dess.

**Redan byggt (avstängt):**

- `Stable`-modell (`prisma/schema.prisma`) — namn, full adress, koordinater, kontakt, `profileImageUrl`, `isActive`. **1:1 mot en `User`** (`userId @unique`) = en stallägare.
- `StableSpot` (uthyrningsplatser) och `StableInviteToken` (e-post-token-inbjudan).
- `Horse.stableId` (`String?`, `onDelete: SetNull`) — en häst kan ha en stalltillhörighet.
- Domän + repos: `StableService`, `StableSpotService`, `StableInviteService` (+ factories, tester, I/Mock/Prisma-repositories).
- API: `/api/stable/profile`, `/api/stable/spots`, `/api/stable/invites`, `/api/stables` (publik sök), `/api/horses/[id]/stable`.
- UI: `StableSelector` (på hästprofilen via `HorseInfoSection`), `StableNav`, `StableLayout`.
- RLS-läspolicies (`20260404120000_rls_read_policies`).

**Mappning epikens funktioner → kod:**

| Epikens funktion | Status | Detalj |
|---|---|---|
| Skapa stall | ✅ Byggt | `StableService.create`, `/api/stable/profile` POST |
| Registrera häst i stall | ✅ Byggt | `Horse.stableId` + `StableSelector` |
| Se vilka hästar i stallet | ✅ Byggt | `Stable.horses`-relation |
| Stallbyte | ✅ Byggt | `StableSelector` stödjer omval (SetNull) |
| Bjuda in medlemmar | ⚠️ Delvis | E-post-token-invite finns; **ingen medlems-entitet** — oklart vad "accept" ger utöver att kunna länka häst |
| Ansök om medlemskap / godkänna | ❌ Gap | Inget ansöknings-/godkännandeflöde (bara push-invite) |
| Roller (stalladmin / medlem) | ❌ Gap | `Stable.userId @unique` = en enda ägare. Ingen multi-admin, ingen medlemsroll |
| Häst i flera stall | ❌ Gap | `stableId` är single FK → en häst = ett stall |
| Gemensamma leverantörsbesök ("stallbesök") | ❌ Gap | `GroupBookingRequest` finns men är **inte** stall-kopplad. Epikens kärnvärde, det enda genuint obyggda |
| Se kommande aktiviteter i stallet | ❌ Gap | Ingen aktivitets-/besöksvy per stall |

**Konsekvens för slicing:** Allt runt *stalltillhörighet och stall-entiteten* är klart (behöver bara aktiveras). De äkta gapen är **medlemskap/roller**, **häst i flera stall** och framför allt **gemensamma leverantörsbesök**.

## Slicing enligt Seven Dimensions

Slicing gjord 2026-06-07. Notera att slicens effort skiljer på **aktivera** (befintlig kod på/av + ev. beskärning) och **bygga** (ny kod).

### Slice 1 (Grundbyggsten / MVP-foundation) — Häst → stalltillhörighet + namn på profil

**Dimensioner kombinerade:** Workflow Steps (första steget), Simple/Complex (happy path).

**Leverans:** Hästägaren kan ange vilket stall hästen står i, och stallnamnet visas på hästprofilen. Inget medlemskap, ingen stalladmin, inga inbjudningar, ingen community, ingen gemensam bokning, ingen ny behörighetsmodell.

**Genomförande:** Aktivera — inte bygga. Den smala kärnan (`StableSelector` på hästprofil + häst→stall-API + publik sök) bröts först ut ur `stable_profiles` till en egen flagga `horse_stable_link`. **2026-06-07 beslutade PO** att häst → stalltillhörighet är en **grundfunktion** — flaggan togs bort och funktionen är nu alltid aktiv. Stallägar-flödet (profiler, spots, invites, nav) **förblir avstängt** bakom `stable_profiles`. Demo-stall seedas så det syns i demon.

**Effort:** ~2–4h (mekaniskt: aktivering + seed + verifiering). Status: **levererad** (flagg-borttagning 2026-06-07).

**Demo-data:** Demo-stallet **Stall Solbacken** definieras i den kanoniska demo-seeden `scripts/seed-demo-provider.ts` (lokal + staging) — på ett ställe. Ingen häst auto-kopplas; demo-kunden (Lisa) väljer stallet via UI:t. `prisma/seed-demo.ts` är legacy/local-only och innehåller inte stallet.

**Värde-andel:** Låg i sig — detta är medvetet en återanvändbar **grundbyggsten**, inte epikens värde-MVP. Kärnvärdet ligger i Slice 4.

### Slice 2 — Stallprofil synlig: skapa stall, se hästar i stallet

**Dimensioner:** Workflow Steps.

**Leverans:** Stallägar-flödet (skapa/redigera stallprofil, se hästarna i stallet) aktiveras. Ger en stall-entitet som hästägare faktiskt kan välja i produktion.

**Genomförande:** Aktivera befintlig kod (`/api/stable/profile`, `StableNav`, `StableLayout`), efter verifieringsrunda.

**Effort:** ~halvdag (aktivering + UX-verifiering av vilande kod).

### Slice 3 — Medlemskap och inbjudningar med godkännande

**Dimensioner:** Business Rule Variations (push-invite vs ansök-och-godkänn).

**Leverans:** Medlemskapskoncept (separat från "äger en häst i stallet"), ansöknings-/godkännandeflöde.

**Genomförande:** Bygga — medlems-entitet saknas idag.

**Effort:** Medel.

### Slice 4 (Kärnvärde) — Gemensamt leverantörsbesök

**Dimensioner:** Major Effort, Workflow Steps.

**Leverans:** Leverantör annonserar ett stallbesök ("Hovslagare Anna, Stall Solbacken, 15 aug"). Flera hästägare anmäler sina hästar till samma besök → färre separata bokningar, bättre planering.

**Genomförande:** Bygga. `GroupBookingRequest` finns som grupperings-mekanism men måste stall-kopplas. Detta är det enda riktigt nya och bär epikens värde.

**Effort:** Störst.

### Slice 5 — Roller, synlighet, häst i flera stall

**Dimensioner:** Business Rule Variations, Variations in Data.

**Leverans:** Multi-admin, medlemsroller, synlighetsbegränsning per hästägare, häst i flera stall.

**Genomförande:** Bygga. Kräver schemaändring (single owner → roller; single `stableId` → many-to-many).

**Effort:** Medel.

## Föreslagna nästa slices

Tunna vertikala slices som bygger vidare på den **levererade** grundbyggstenen (häst → stall är live). Ordnade efter värde/ansträngning. De är medvetet smalare än de strategiska Slice 2–5 ovan — varje levererar något verifierbart, inte en hel epic. PO prioriterar.

### Nästa-slice A — Leverantören ser stallnamn på bokning + Dagens rutt

- **Problem:** Leverantören ser inte att flera bokningar gäller hästar på samma stall → planerar häst för häst trots samlokalisering.
- **Hypotes:** Visas stallnamnet (när satt) i leverantörens bokningsdetaljer och Dagens rutt-stopp får hen första signalen om samlokalisering — utan att vi bygger gemensam bokning.
- **Minsta slice:** Read-only visning av `Horse.stable.name` i leverantörens bokningsvy och Dagens rutt-stopp. Data finns redan; ingen ny modell, ingen flagga.
- **Förväntat värde:** Leverantören börjar se stall-kopplingar → planeringsunderlag. Mycket låg ansträngning, direkt nytta.

### Nästa-slice B — Stalladress som besöksplats i Dagens rutt

- **Problem:** Dagens rutt använder kundens **hemkoordinat** som proxy för besöksplats. En kund kan ha hästar på olika stall → fel adress/körsträcka. (Känd skuld i backlog: "Besöksplats-modell → Stall-epic".)
- **Hypotes:** Används stallets koordinat som besöksplats när hästen har ett stall blir rutten korrekt.
- **Minsta slice:** När en bokning gäller en häst med `stableId` och stallet har lat/long → använd den som besöksplats (fallback: kundens koordinat). `Stable` har redan lat/long-fält. (Obs: demo-stallet saknar koordinater idag — seed-justering ingår.)
- **Förväntat värde:** Löser en konkret känd bugg i Dagens rutt och knyter grundbyggstenen till leverantörsnyttan.

### Nästa-slice C — "Andra hästar i ditt stall" (överblick, PII-säker)

- **Problem:** En hästägare vet inte att andra hästar står i samma stall — ingen känsla av gemensam plats.
- **Hypotes:** Ser jag att "3 andra hästar står i Stall Solbacken" börjar community-känslan utan medlemskap/roller.
- **Minsta slice:** På hästprofilen, visa **antal** andra hästar med samma `stableId` (aggregat, inga namn/ägare → ingen PII-läcka). Bygger på `Stable.horses`.
- **Förväntat värde:** Första "gemenskap"-signalen, minimal kod, ingen ny behörighetsmodell. Senare slice kan exponera detaljer bakom samtycke.

### Nästa-slice D — Publik stallprofil (read-only)

- **Problem:** Stallet är bara ett namn på hästen; ingen kan se en stall-sida.
- **Hypotes:** En enkel publik stallprofil (namn, ort, antal hästar) gör stallet till en synlig "plats".
- **Minsta slice:** Aktivera **enbart läs-vyn** av stallprofilen för seedade stall — splitta `stable_profiles` i läs (`stable_profiles_read`) vs ägar-redigering (skapa/spots/invites förblir av). `/api/stables/[stableId]` + `StableProfileView` finns redan.
- **Förväntat värde:** Synlig stall-plats utan att aktivera redigering/uthyrning/inbjudningar. Något större (flagg-split + UX-verifiering av vilande kod).

## Öppna frågor

Från epik-utkastet, med vad koden idag implicit svarar:

| Fråga | Vad koden säger idag | Kvarstår att besluta |
|---|---|---|
| Vem får skapa ett stall? | Vilken User som helst (1:1, `userId @unique`) | Ska det begränsas? |
| Flera administratörer? | Nej — single owner | Slice 5-beslut |
| Kan en häst tillhöra flera stall? | Nej — single FK | Slice 5-beslut (m2m?) |
| Hur hanteras stallbyte? | Byt `stableId` (omval/SetNull), stöds av `StableSelector` | OK |
| Ska alla medlemmar se alla hästar? | Ej definierat (ingen medlemsroll) | Slice 3/5-beslut |
| Ny boknings-typ eller gruppering? | `GroupBookingRequest` finns som gruppering, ej stall-kopplad | Slice 4-beslut: återanvänd vs ny typ |

## Beslut

- **2026-06-07** (Johan + tech lead): Discovery genomförd på branch `discovery/stall-foundation` (worktree från `staging`). Konstaterat att Stable-foundation redan finns men ligger avstängd.
- **Riktning:** "Beskär & aktivera kärnan" — Slice 1 byggdes först som flagg-split (`horse_stable_link`), inte nybygge. Stallskapande hör till epiken (Slice 2+), inte Slice 1.
- **MVP-foundation:** Slice 1 (häst → stalltillhörighet + namn på profil). Resten av stallägar-flödet förblir avstängt.
- **2026-06-07** (PO): Häst → stalltillhörighet befordrad till **grundfunktion**. Flaggan `horse_stable_link` borttagen; funktionen alltid aktiv. `stable_profiles` kvar som separat flagga för stallägar-flödet.

## Nästa steg

- **Slice 1 levererad och live** (häst → stalltillhörighet, grundfunktion, verifierad på staging 2026-06-07 via PR #378/#379/#380). Se [Epic Progress](#epic-progress).
- **Välj nästa slice:** PO prioriterar bland [Föreslagna nästa slices](#föreslagna-nästa-slices) (A–D). Rekommendation: börja med **A** (leverantören ser stallnamn) eller **B** (stalladress som besöksplats) — bägge är tunna, bygger direkt på grundbyggstenen och ger leverantörsnytta utan ny modell.
- De strategiska Slice 2–5 (stallprofiler, medlemskap, gemensamt besök, roller) kvarstår som riktning men cuttas om till tunnare slices när de tas upp.
- Vid implementation: följ `.claude/rules/prisma.md` om seed/migration, lägg backlog-rad i `docs/sprints/status.md`.
