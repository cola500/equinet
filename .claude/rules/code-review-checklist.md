---
title: "Code Review Checklist"
description: "Strukturerad checklista for code-reviewer-agenten vid station 4 (Review)"
category: rule
status: active
last_updated: 2026-04-01
tags: [review, quality, security, team]
sections:
  - Hur man kor review
  - Korrekthet
  - Sakerhet
  - Kodkvalitet
  - Testning
  - Prestanda
  - iOS-specifikt
  - Allvarlighetsgrader
---

# Code Review Checklist

## Hur man kor review

Code review kors i station 4 av stationsfloden.
Normalt via `code-reviewer` subagent, eller manuellt av tech lead.

**Input**: Git diff fran feature branch mot main + planen fran station 1.
**Output**: Lista over findings med allvarlighetsgrad.

---

## Korrekthet

- [ ] Implementationen matchar planen fran station 1
- [ ] Alla edge cases hanterade (null, tom lista, ogiltig input)
- [ ] Felmeddelanden ar pa svenska och informativa
- [ ] Inga hardkodade varden som borde vara konfigurerbara
- [ ] Async/await-kedjor ar korrekta (inga unanvanda promises)
- [ ] Feature flag-gating pa BADE route-niva och service-niva (defense in depth)

---

## Sakerhet

### Auth & Auktorisering

- [ ] Alla nya routes har `auth()` med null-check -> 401
- [ ] `providerId`/`customerId` hamtas fran session, ALDRIG fran request body
- [ ] IDOR-skydd: andpunkt kontrollerar att resursen tillhor sessionens anvandare
- [ ] Admin-routes kontrollerar `isAdmin` i session

### Input-validering

- [ ] Zod-schema med `.strict()` for alla request bodies
- [ ] Zod-schema for alla URL-parametrar och search params
- [ ] Inga dynamiska SQL-fragor (Prisma parameteriserar automatiskt)

### Data-exponering

- [ ] `select` anvands (ALDRIG `include` utan explicit godkannande)
- [ ] Inga kanslga falt exponeras (passwordHash, tokens, interna IDs)
- [ ] `toPublicX()`-funktion for externa API-svar (allowlist > blocklist)

### Rate Limiting

- [ ] Rate limiting pa alla nya routes (efter auth, fore JSON-parsing)
- [ ] Login-specifik rate limiter for auth-endpoints
- [ ] Rate limiter fail-closed: `RateLimitServiceError` -> 503

---

## Kodkvalitet

### Arkitektur

- [ ] Karndomaner anvander repository pattern (se CLAUDE.md lista)
- [ ] Domain services innehaller INTE Prisma-importer
- [ ] API routes delegerar till services (ingen affarslogik i routes)
- [ ] Inga server-only importer i klient-komponenter

### Stil & Konventioner

- [ ] Strukturerad loggning (`logger`/`clientLogger`), aldrig `console.*`
- [ ] Svenska felmeddelanden i API-responses (ordlista i CLAUDE.md)
- [ ] Engelska i kod, kommentarer och loggmeddelanden
- [ ] Inga nya `any`-typer utan dokumenterad anledning
- [ ] Inga nya `@ts-expect-error` utan dokumenterad anledning
- [ ] Filer under 500 rader (flagga om over, blocker om over 800)

### Patterns

- [ ] Befintliga patterns ateranvands (kolla liknande domaner)
- [ ] Inga nya patterns introducerade utan diskussion
- [ ] `withApiHandler` anvands for nya routes (eller migrering av befintlig)
- [ ] Mobil-forst: `useIsMobile()` + villkorlig rendering vid UI-andringar

---

## Testning

- [ ] Tester existerar for alla nya publika metoder
- [ ] Tester testar beteende, inte implementation
- [ ] Mock-patterns foljer projektstandard (class-baserade mocks, inte `vi.fn().mockImplementation`)
- [ ] Feature flag-test inkluderat ("returns 404 when flag disabled")
- [ ] Inga `@ts-expect-error` i tester utan anledning
- [ ] Edge cases: null, tom lista, ogiltig input, concurrent access

---

## Prestanda

- [ ] Inga N+1-fragor (kolla loopar med await inuti)
- [ ] `select`-block innehaller BARA falt som UI:t anvander
- [ ] `groupBy` for aggregering istallet for hamta-alla + JS-loop
- [ ] Inga tunga operationer i renderingsloop (memo vid behov)
- [ ] Inga onodiga re-renders (kontrollera `useEffect`-beroenden)

---

## iOS-specifikt

Anvands bara vid andringar i `ios/` eller `/api/native/`.

- [ ] `import OSLog` i alla filer som anvander AppLogger
- [ ] Nya Codable-falt ar optionella (`String?`) for bakatkompatibilitet
- [ ] `DateFormatter` ar `static let` (dyrt att skapa)
- [ ] `.sensoryFeedback()` istallet for `UIImpactFeedbackGenerator`
- [ ] Inline `Task {}` closures extraherade till namngivna metoder
- [ ] Nya modell-filer tillagda i widget `membershipExceptions` om SharedDataManager refererar dem
- [ ] Bearer JWT-auth verifierad (inte session-cookie) for native API-anrop

---

## Allvarlighetsgrader

| Grad | Definition | Atagard |
|------|-----------|---------|
| **Blocker** | Sakerhetssarbarhet, dataintegritetsproblem, krasch | MASTE fixas fore merge |
| **Major** | Fel beteende, saknad validering, bruten testning | BOR fixas fore merge |
| **Minor** | Stilproblem, suboptimal lösning, saknad loggning | Kan fixas i nästa iteration |
| **Suggestion** | Forbattringsforslag, alternativa approaches | Frivilligt |

### Exempel

**Blocker**: `providerId` fran request body (IDOR), saknad auth-check, SQL injection
**Major**: Saknad Zod-validering, `include` istallet for `select`, `console.log` i prod
**Minor**: Fil over 500 rader, saknad edge case-test, suboptimal select-block
**Suggestion**: "Overflyttning till withApiHandler hade forrenklat", "Overdag memo har"
