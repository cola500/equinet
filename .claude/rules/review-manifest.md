---
title: "Review-manifest"
description: "Deklarativa checklistor per story-typ/domän för cx-ux-reviewer, code-reviewer och security-reviewer"
category: rule
status: draft
last_updated: 2026-04-19
sections:
  - Syfte
  - Hur du använder manifestet
  - Messaging-komponent
  - API-route
  - iOS-komponent
  - Auth/säkerhet
  - Bokningsflöde
---

# Review-manifest

## Syfte

Reviewers ser det de uttryckligen kollar mot. Utan domänspecifika checklistor missar reviewers
konventioner som är uppenbara för den som byggt domänen men osynliga för en som granskar
en enskild ändring.

Detta manifest dokumenterar "kom-ihåg"-krav per story-typ. Det kompletterar:
- **Arkitekturcoverage** (S36-0): verifiera att designbeslut D1-Dn är implementerade
- **Metacognition** (S36-1): vara medveten om blinda fläckar

**Ursprung:** Andra reviewer-miss mot domänmönster (S35-1 + S40-3). Se
`docs/retrospectives/2026-04-19-review-miss-analysis.md`.

## Hur du använder manifestet

I briefen till reviewer-agenten: lägg till relevant sektion från manifestet och begär att
reviewern explicit bockar av varje punkt. Exempel:

```
"Använd messaging-sektionen från .claude/rules/review-manifest.md.
Verifiera varje punkt explicit i din granskning."
```

Manifestet är ett komplement, inte en ersättare — reviewern ska fortfarande använda
eget omdöme utöver listan.

---

## Messaging-komponent

Varje review av messaging-UI ska verifiera:

- [ ] Meddelanden renderas i kronologisk ordning (nyast nederst, äldst överst)
- [ ] `displayMessages()` (eller motsvarande reverse) appliceras på API-data som returneras `desc`
- [ ] `scrollIntoView` eller `bottomRef` pekar på nyaste meddelande efter ny data
- [ ] Read-markering (`readCalledRef` eller liknande guard) sker vid first load — inte vid varje
      revalidering
- [ ] Optimistisk uppdatering lägger till meddelandet i rätt ände (sist i API-array = äldst position,
      men nyast visuellt efter reverse)
- [ ] Svenska å/ä/ö i alla UI-strängar (placeholder, tomtlägestext, knappar)
- [ ] Touch-targets ≥44pt på skicka-knapp och ev. åtgärdsknappar

**Känd gotcha:** `autoFocus` på Textarea öppnar tangentbord direkt på mobil och krymper
viewporten. Undvik om inte explicit avsett.

---

## API-route

Varje review av ny eller ändrad API-route ska verifiera:

- [ ] `auth()` med null-check → 401 längst upp i handler
- [ ] `providerId`/`customerId` hämtas från session — ALDRIG från request body
- [ ] IDOR-skydd: resurs verifieras tillhöra sessionens användare (atomisk WHERE eller
      `findByIdForProvider`/`findByIdForCustomer`)
- [ ] Zod-schema med `.strict()` på alla request bodies
- [ ] Rate limiting appliceras EFTER auth, FÖRE JSON-parsing
- [ ] `select`-block (aldrig `include`) med enbart fält som UI:t behöver
- [ ] Felmeddelanden på svenska i responses
- [ ] `logger` (inte `console.*`) för loggning
- [ ] `withApiHandler` används eller migreringsväg dokumenterad

**Känd gotcha:** Ny kolumn på befintlig modell kräver audit av ALLA select-block i
repositoryt + routes.

---

## iOS-komponent (SwiftUI)

Varje review av ny eller ändrad SwiftUI-vy ska verifiera:

- [ ] `import OSLog` i alla filer som använder `AppLogger`
- [ ] Nya Codable-fält är optionella (`String?`) för bakåtkompatibilitet
- [ ] Touch-targets ≥44pt (`.frame(minWidth: 44, minHeight: 44)` eller `.buttonStyle`)
- [ ] `.sensoryFeedback()` istället för `UIImpactFeedbackGenerator` (iOS 17+)
- [ ] Inline `Task {}` closures extraherade till namngivna metoder för testbarhet
- [ ] Ny modell-fil tillagd i widget `membershipExceptions` om `SharedDataManager` refererar den
- [ ] Bearer JWT-auth verifierad (inte session-cookie) för native API-anrop
- [ ] Svenska fel- och tomtlägesmeddelanden i vy-strängar

**Känd gotcha:** `DateFormatter` ska vara `static let` — dyrt att skapa per render.

---

## Auth/säkerhet

Varje review av auth-relaterad ändring ska verifiera:

- [ ] Supabase RLS-policies aktiverade (`ENABLE ROW LEVEL SECURITY`) på berörda tabeller
- [ ] Custom Access Token Hook (PL/pgSQL) ger korrekt JWT-claims: `providerId`, `userType`, `isAdmin`
- [ ] Sessionscookies är HTTP-only
- [ ] Ingen känslig data (tokens, passwordHash, interna IDs) i API-responses
- [ ] Admin-routes kontrollerar `isAdmin` i session — inte bara autentisering
- [ ] `findByIdForProvider`/`findByIdForCustomer` används för alla booking-queries i routes

**Känd gotcha:** Supabase-klient query med `.eq()` kräver explicit ownership-filter — RLS-policies
är OR, publika read-policies läcker data till andra providers om inte WHERE är korrekt.

---

## Bokningsflöde

Varje review som rör boknings-UI eller boknings-API ska verifiera:

- [ ] BookingStatus-maskin respekteras (giltiga övergångar)
- [ ] Dubbelbokningsskydd: atomisk check i `BookingService` (inte race-condition-benägen klient-check)
- [ ] Betalningsflöde: Stripe webhook event-ID dedup (`createMany + skipDuplicates`)
- [ ] Återkommande bokningar: `BookingSeries`-status synkroniseras med enskilda bokningar
- [ ] Kund-vy: bokningsstatus visas med svenska termer (Bekräftad, Avbokad, Väntande)

---

## Underhåll av detta manifest

Lägg till en ny sektion när:
- En reviewer-miss mot domänmönster inträffar (se miss-analys-retro)
- En "känd gotcha" visar sig vara glömsk återkommande

Uppdatera befintlig sektion när:
- En ny convention etableras i en domän
- En gammal gotcha är löst och inte längre relevant

**Status:** `draft` tills manifestet validerats i minst 2 messaging-reviews utan miss.
Uppdatera till `active` efter validering.
