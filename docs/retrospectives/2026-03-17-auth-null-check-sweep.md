---
title: "Sakerhetssweep: Auth null-check i 87 API routes"
description: "Mekanisk sakerhetsforbattring -- lagt till session null-check i alla route handlers som saknade det, plus standardisering av felmeddelanden till svenska"
category: retrospective
status: completed
last_updated: 2026-03-17
sections:
  - Resultat
  - Vad som gjordes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - Larandeeffekt
---

# Retrospektiv: Auth null-check sweep

**Datum:** 2026-03-17
**Scope:** Sakerhetsfix i 87 route-filer + felmeddelande-standardisering
**Branch:** `refactor/availability-route`

---

## Resultat

- 166 andrade filer (87 route.ts + 79 route.test.ts), 0 nya filer
- 111 nya tester, 3669 totala tester (alla grona)
- +1519 / -50 rader (netto +1469, nastan uteslutande guard-rader + tester)
- Typecheck = 0 errors, Lint = 0 errors
- Tid: ~1 session (parallella agenter)

---

## Vad som gjordes

### Fas 1: Auth null-check (87 filer, ~113 handlers)

Samma 3-raders pattern i alla handlers som anropar `auth()`:

```typescript
const session = await auth()
if (!session) {
  return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
}
```

**Fore:** `session.user.userType` kastade `TypeError: Cannot read properties of null` -> okontrollerad 500.
**Efter:** Kontrollerad 401 med tydligt felmeddelande.

### Fas 2: Felmeddelande-standardisering (~15 meddelanden)

| Fore (engelska) | Efter (svenska) |
|-----------------|-----------------|
| "Provider not found" | "Leverantor hittades inte" |
| "Unauthorized" | "Ej inloggad" |
| "Internal error" | "Internt serverfel" |
| "Service not found" | "Tjanst hittades inte" |
| "User not found" | "Anvandare hittades inte" |
| "Provider profile not found" | "Leverantorsprofil hittades inte" |

### Fas 3: Testtackning (111 nya tester)

Varje fixad handler fick ett test:
```typescript
it('returns 401 when not authenticated', async () => {
  vi.mocked(auth).mockResolvedValue(null as never)
  const request = new NextRequest('http://localhost:3000/api/...')
  const response = await HANDLER(request)
  expect(response.status).toBe(401)
})
```

---

## Vad gick bra

### Parallella agenter fungerade utmarkt
- 5 agenter, var och en med ~17 filer, alla klarade sin batch sjalvstandigt
- Ingen merge-konflikt (varje agent editerade separata filer)
- Total tid: ~15 min (langsta agenten) istallet for ~1h sekventiellt

### Mekanisk andring = lag risk
- Samma pattern i alla filer -- ingen kreativ tolkning kravdes
- Befintliga tester fangade omedelbart om nagon andring brot logiken
- Ingen enda regression

### Explore-agenter fore implementation
- 2 explore-agenter identifierade exakt vilka 86 filer som behovde fixas
- Forhindrade att vi missade filer eller fixade filer som redan var korrekta

---

## Vad kan forbattras

### Testfiler som saknas
- ~10 route-filer har inga test-filer alls (follows/[providerId], reviews/[id], customer/horses, etc.)
- Dessa fick auth-fixen men inga 401-tester
- Lat prioritet -- routerna ar skyddade aven utan tester

### Varianter i auth-monster
- Nagra routes anvander helper-funktioner (`authorizeProvider`, `authorizeCustomer`) istallet for direkt `auth()`
- Dessa fick ocksa fixar men monstret ar annorlunda -- kan vara vart att konsolidera i framtiden

### Provider/onboarding-status anvande `new Response()` istallet for `NextResponse.json()`
- Hittades och fixades i sweepen, men indikerar att aldre routes har inkonsistent stil

---

## Patterns att spara

### Parallell agent-batch for mekaniska andringar
Nar en andring ar identisk i manga filer (guard, import-byte, strangbyte):
1. Explore-agent identifierar alla filer
2. Dela i 4-5 batchar per API-doman
3. Kora parallella agenter (en per batch)
4. Varje agent verifierar sin batch med `vitest run`
5. Slutverifiering med full `test:run` + `typecheck` + `lint`

### Auth null-check ar OBLIGATORISKT
Alla framtida routes MASTE folja api-routes.md-monstret:
```typescript
const session = await auth()
if (!session) {
  return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
}
```
Regeln fanns redan i `.claude/rules/api-routes.md` men efterlevdes inte i aldre routes.

---

## Larandeeffekt

### Sakerhetsbrister ackumuleras tyst
- 87 av 112 auth-routes saknade null-check -- det ar 78% av alla skyddade routes
- Alla native API routes (session 95+) hade korrekt check, men alla aldre routes saknade den
- **Larding:** Nar ett nytt sakerhetskrav infordes (via `.claude/rules/api-routes.md`) applicerades det bara pa NYA routes. Befintliga routes andrades inte retroaktivt. Periodiska sweeps ar nodvandiga.

### Mekaniska refaktoreringar ar varda att gora
- Lag risk, hog utdelning (en hel klass av 500-fel eliminerad)
- Parallella agenter gor det snabbt nog att inte skjuta upp
- Jammfort med BookingService-refaktorering (hog risk, tvivelaktig vinst) -- ratt beslut att prioritera detta
