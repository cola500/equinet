---
title: "Sprint 38: iOS messaging audit + docs-complement"
description: "Verifiera messaging i iOS-WebView, bestäm native-port-behov. Städa docs-gap från S35-S37."
category: sprint
status: planned
last_updated: 2026-04-18
tags: [sprint, messaging, ios, audit, docs]
sections:
  - Sprint Overview
  - Stories
  - Beroenden efter S38-0
---

# Sprint 38: iOS messaging audit + docs-complement

## Sprint Overview

**Mål:** Verifiera att messaging (som idag körs via WebView i iOS-appen efter S37-rollout) fungerar friktionsfritt, och utifrån fynd besluta om native-port behövs nu eller kan vänta. Plus: städa docs-gap från S35-S37 som M7 flaggat.

**Princip:** Data före beslut. Slice 1 är audit — resultatet styr om resten av sprinten blir native-port eller en annan feature.

---

## Stories

### S38-0: iOS messaging audit via mobile-mcp

**Prioritet:** 0 (data-first, bestämmer resten av sprinten)
**Effort:** 1-2h
**Domän:** ios (`ios/Equinet/` + mobile-mcp, ingen kodändring förväntad)

Systematisk audit av hur messaging fungerar i iOS-appen idag när flaggan är `default: true`. Mönstret följer S33-1 (iOS UX-audit) och S36-2 (messaging webb-audit).

**Aktualitet verifierad:**
- Bekräfta att `messaging: defaultEnabled: true` på main (post-S37)
- Verifiera att iOS Simulator + mobile-mcp fungerar (senaste användning: S33-1)
- Kontrollera att push-setup fungerar lokalt (kan kräva TestFlight för fullständig push-test)

**Implementation:**

**Steg 1: Setup**
- Bygg iOS-appen med senaste main
- Starta Simulator, logga in som `provider@example.com` via `--debug-autologin`
- Skapa testdata: bokning mellan kund och leverantör (om inte finns), kund skickar meddelande (via webb eller seed)

**Steg 2: Audit-punkter**

| Flöde | Vad att verifiera | Verktyg |
|-------|-------------------|---------|
| Öppna messaging-inkorg från TabBar | Fungerar? Laddningstid? Skeleton eller flash? | mobile-mcp screenshot |
| Klicka på tråd | Navigerar korrekt? Skriv-fält fungerar? | mobile-mcp |
| Skriva meddelande (tangentbord) | iOS-tangentbord dyker upp? Går att skicka? | mobile-mcp + manuell |
| VoiceTextarea | Fungerar dikteringen i WebView eller bara native? | mobile-mcp |
| Push-notifiering vid nytt meddelande | Kommer notifieringen? | Kräver 2 devices eller trigger manuellt |
| Push deep-link → tråd | Öppnar direkt i rätt tråd eller bara appen? | mobile-mcp |
| Offline-läsning | Kan läsa befintliga trådar utan nät? | Airplane mode + simctl |
| Keyboard-hantering i tråd | Tråd scrollar upp när tangentbord öppnas? | mobile-mcp |
| Haptic vid skicka | Finns feedback? (WebView saknar troligen) | Manuell på riktig enhet |
| Svenska tecken | å/ä/ö renderar korrekt? | mobile-mcp |

**Steg 3: Sammanställ rapport**

`docs/retrospectives/<datum>-ios-messaging-audit.md` med:
- Per flöde: status (bra / mindre fynd / större fynd / trasigt)
- Fynd-tabell: kategori + allvar (blocker/major/minor) + fix-förslag
- **Rekommendation:** native-port nu / native-port senare / acceptabelt som WebView

**Steg 4: Beslut**

Baserat på rapport, avgör nästa stories i S38:
- **Om WebView är "tillräckligt bra"** → S38 fokuserar på docs + andra feature
- **Om några fynd är kritiska** → S38-2+ blir fix-stories (native-port om nödvändigt, annars WebView-tweaks)

**Acceptanskriterier:**
- [ ] Alla 10 audit-punkter genomförda med resultat
- [ ] Audit-rapport skriven
- [ ] Rekommendation + prioritering av native-port dokumenterad
- [ ] Beslut om S38-2+ fattat baserat på rapporten

**Reviews:** cx-ux-reviewer (för tolkning av UX-fynd), ios-expert (om native-specifika problem hittas)

**Arkitekturcoverage:** N/A (ren audit).

---

### S38-1: Messaging docs-complement (M7-gap från S35-S37)

**Prioritet:** 1
**Effort:** 30 min
**Domän:** docs (`docs/testing/testing-guide.md` + `NFR.md` + ev. `docs/security/`)

Åtgärda verkliga M7-gap från senaste sprintar. Hjälpartiklar + README + feature-docs finns redan — det som saknas är interna docs.

**Aktualitet verifierad:**
- Kör `npm run metrics:report` och bekräfta att s35-3 + s35-1-5 fortfarande flaggas i M7
- Grep testing-guide för "meddelanden" / "messaging" → 0 träffar bekräftat 2026-04-18

**Implementation:**

**Steg 1: Uppdatera `docs/testing/testing-guide.md`**

Lägg till messaging-scenario enligt mönstret:

```markdown
### Meddelanden (messaging)
- [ ] Kund skickar meddelande från bokningsdetalj-dialog → leverantör ser i inkorg
- [ ] Leverantör svarar från inkorg → kund ser i sin tråd
- [ ] Push-notifiering triggas vid nytt meddelande (verifiera i dev-loggar)
- [ ] Rate limit: >30 meddelanden/min från en user → 429
- [ ] Avbokad/no-show bokning blockerar nya meddelanden (409)
- [ ] Läs-markering: meddelanden markeras som lästa när tråd öppnas
```

**Steg 2: Uppdatera `NFR.md`**

Hitta RLS-sektionen (om finns), lägg till messaging-rad:
- "Messaging (Conversation + Message): 8 RLS-policies + kolumn-nivå-GRANT på `Message.readAt` enligt `column-level-grant-rls-pattern`"
- Uppdatera "Testning"-sektion om totalt antal tester ändrats sedan senaste NFR-update

**Steg 3: Skapa `docs/security/messaging.md` (minimal)**

Ny fil med frontmatter + kort beskrivning:
- Defense-in-depth: applikationslager (service) + databaslager (RLS + kolumn-nivå GRANT)
- Rate limiting: 30/user + 10/conversation per min
- Feature flag-gating två nivåer
- Länkar till `messaging-domain.md` för detaljer

**Acceptanskriterier:**
- [ ] `testing-guide.md` har messaging-scenario
- [ ] `NFR.md` nämner messaging-RLS
- [ ] `docs/security/messaging.md` skapad med frontmatter
- [ ] `npm run docs:validate` grön
- [ ] `npm run metrics:report` visar färre M7-gap (s35-3 + s35-1-5 försvinner eller flyttas)

**Reviews:** code-reviewer (trivial docs-story, kan skippas)

**Arkitekturcoverage:** N/A.

---

## Beroenden efter S38-0

Efter S38-0-audit tas beslut om resten av sprinten:

**Scenario A — audit visar "WebView är tillräckligt bra":**
- S38 stängs med bara S38-0 + S38-1
- Backlog: "iOS native messaging-port (nice-to-have)" som låg prio
- Möjligt att lägga till oplanerad story i S38 om tid finns (t.ex. från backlog)

**Scenario B — audit hittar majors men inte blockers:**
- S38-2: fix 2-3 specifika problem (push deep-link, keyboard, etc.)
- Native-port skjuts till separat sprint

**Scenario C — audit hittar blockers:**
- S38-2+: native-port av en eller två vyer (troligen inkorg eller tråd)
- Scope beslutas baserat på rapporten

## Definition of Done (sprintnivå)

- [ ] S38-0 genomförd med rapport + rekommendation
- [ ] S38-1 M7-gap stängda
- [ ] Beslut om native-port dokumenterat (ja/nej, nu/senare)
- [ ] `npm run check:all` grön
