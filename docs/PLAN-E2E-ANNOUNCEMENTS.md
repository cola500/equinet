# Plan: Lägg till E2E-tester för ruttannons-funktionen

## Bakgrund

Fas 1-4 av ruttannons-förbättringen är **implementerad** men **inte committad**:
- Fas 1: Status-flöde (pending → open) - KLAR
- Fas 2: Backend-validering för bokningar - KLAR
- Fas 3: Provider bokningsdetaljer (ny API + ny sida) - KLAR
- Fas 4: Geo-sökning på frontend - KLAR

**420 unit-tester passerar**, men **E2E-tester saknas**.

---

## Mål

Skriva E2E-tester som täcker den kompletta användarresan för ruttannonser.

---

## E2E Test Plan

**Ny fil:** `e2e/announcements.spec.ts`

### Test 1: Provider skapar annons som visas i sök
```typescript
test('provider can create announcement that appears in search', async ({ page }) => {
  // 1. Logga in som provider
  // 2. Navigera till /provider/announcements
  // 3. Klicka "Skapa ny rutt-annons"
  // 4. Fyll i formulär (tjänstetyp, datum, stopp)
  // 5. Skicka
  // 6. Verifiera redirect till annonslista
  // 7. Logga ut
  // 8. Besök /announcements (publikt)
  // 9. Verifiera att annonsen visas
})
```

### Test 2: Kund söker med tjänstetyp-filter
```typescript
test('customer can filter announcements by service type', async ({ page }) => {
  // 1. Besök /announcements
  // 2. Skriv tjänstetyp i filter
  // 3. Klicka Sök
  // 4. Verifiera att endast matchande annonser visas
})
```

### Test 3: Provider ser bokningsdetaljer
```typescript
test('provider can view booking details on announcement', async ({ page }) => {
  // Förutsätter: En bokning finns på en annons
  // 1. Logga in som provider
  // 2. Gå till /provider/announcements
  // 3. Klicka på annons med bokningar
  // 4. Verifiera att kundinfo visas (namn, email, telefon)
  // 5. Verifiera att hästinfo visas
})
```

### Test 4: Provider bekräftar bokning
```typescript
test('provider can confirm booking on announcement', async ({ page }) => {
  // 1. Logga in som provider
  // 2. Gå till annonsdetaljer med pending-bokning
  // 3. Klicka "Bekräfta"
  // 4. Verifiera att status ändras till "Bekräftad"
})
```

**OBS:** Geo-sökning (Test 5) kräver mock av navigator.geolocation, vilket är komplext i Playwright. Skippar för MVP.

---

## Filer att skapa

| Fil | Beskrivning |
|-----|-------------|
| `e2e/announcements.spec.ts` | **NY** - E2E-tester för announcements |

---

## Test Data Setup

Använd samma pattern som `route-planning.spec.ts`:
```typescript
test.beforeEach(async ({ page }) => {
  const prisma = new PrismaClient();
  // Rensa tidigare testdata...
  // Logga in...
})
```

---

## Verifiering

```bash
# Kör endast announcements-tester
npx playwright test e2e/announcements.spec.ts

# Kör alla E2E-tester
npx playwright test
```

---

## Efter E2E-testerna

1. Commita alla ändringar:
   - Implementeringsfiler (fas 1-4)
   - E2E-tester
2. Pusha till remote

---

*Senast uppdaterad: 2026-01-23*
