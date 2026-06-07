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
  - Nuläge i koden (discovery 2026-06-07)
  - Slicing enligt Seven Dimensions
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

## Nuläge i koden (discovery 2026-06-07)

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

- **Slice 1 levererad** (flagg-borttagning 2026-06-07). Häst → stall är alltid aktiv.
- Slice 2–5 (stallprofiler, medlemskap, gemensamt besök, roller) prioriteras separat — fortsatt bakom `stable_profiles` / framtida epik-arbete.
- Vid implementation: följ `.claude/rules/prisma.md` om seed/migration, lägg backlog-rad i `docs/sprints/status.md`.
- Slice 2–5 prioriteras separat när Slice 1 är på plats.
