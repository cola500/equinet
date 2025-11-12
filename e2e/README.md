# E2E-tester med Playwright

Detta projekt använder **Playwright** för end-to-end-tester som testar hela användarflöden i en riktig webbläsare.

## 🚀 Snabbstart

### Kör E2E-tester

```bash
# Kör alla E2E-tester (headless mode)
npm run test:e2e

# Kör med UI (visuellt interface)
npm run test:e2e:ui

# Kör med synlig browser (se vad som händer)
npm run test:e2e:headed

# Debug-läge (steg-för-steg)
npm run test:e2e:debug
```

## 📁 Teststruktur

```
e2e/
├── auth.spec.ts       # Registrering, inloggning, logout (7 tester)
├── booking.spec.ts    # Sök, boka, avboka (6 tester)
├── provider.spec.ts   # Leverantörsfunktioner (10 tester)
└── README.md          # Denna fil
```

**Total: 23 E2E-tester**

## 🧪 Vad testas?

### Authentication Flow (auth.spec.ts)
- ✅ Registrera ny kund
- ✅ Registrera ny leverantör
- ✅ Logga in som kund
- ✅ Felhantering vid felaktig inloggning
- ✅ Logout
- ✅ Lösenordskrav-validering

### Booking Flow (booking.spec.ts)
- ✅ Sök och filtrera leverantörer
- ✅ Visa leverantörsdetaljer
- ✅ Komplett bokningsflöde (från sökning till bekräftelse)
- ✅ Dubbelbokningsskydd
- ✅ Avboka bokning
- ✅ Empty state när inga bokningar finns

### Provider Flow (provider.spec.ts)
- ✅ Visa dashboard med statistik
- ✅ Skapa ny tjänst
- ✅ Redigera tjänst
- ✅ Aktivera/inaktivera tjänst
- ✅ Ta bort tjänst
- ✅ Hantera bokningar
- ✅ Acceptera bokning
- ✅ Avvisa bokning
- ✅ Uppdatera leverantörsprofil
- ✅ Empty states

## ⚙️ Konfiguration

E2E-testerna är konfigurerade i `playwright.config.ts`:

- **Browser**: Chromium (Desktop Chrome)
- **Base URL**: `http://localhost:3000`
- **Auto-start**: Dev-servern startas automatiskt
- **Screenshots**: Vid failure
- **Trace**: Vid retry
- **Reporter**: HTML (genereras i `playwright-report/`)

## 🎯 Best Practices

### Test Data
**OBS:** Testerna förutsätter att vissa testanvändare finns i databasen:
- **Kund**: `test@example.com` / `TestPassword123!`
- **Leverantör**: `provider@example.com` / `ProviderPass123!`

**Tips:** Skapa dessa användare innan du kör testerna, eller använd `beforeAll()` hooks för att skapa dem automatiskt.

### Selektorer
Vi använder:
1. **data-testid** (bäst): `[data-testid="provider-card"]`
2. **role + name**: `getByRole('button', { name: /boka/i })`
3. **label**: `getByLabel(/e-post/i)`
4. **text** (sista alternativet): `getByText(/välkommen/i)`

### Unika Email-adresser
För registreringstester använder vi `Date.now()` för unika emails:
```typescript
const email = `test${Date.now()}@example.com`
```

## 🐛 Debugging

### Kör ett specifikt test
```bash
npx playwright test auth.spec.ts
```

### Debug mode
```bash
npm run test:e2e:debug
```
Öppnar Playwright Inspector där du kan:
- Stega igenom testet
- Inspektera DOM
- Se vilka selektorer som används

### Headed mode (se browsern)
```bash
npm run test:e2e:headed
```

### Visa test-rapport
```bash
npx playwright show-report
```

## 📊 Test Coverage

E2E-testerna kompletterar våra unit/integration tests:

```
        E2E: 23 tests (hela användarflöden)
            ↑
 Integration: 75 tests (API routes)
            ↑
        Unit: 52 tests (utilities, hooks)
```

**Total**: ~150 tester! 🎉

## 🔧 Felsökning

### "Timed out waiting from config.webServer"
**Problem**: Dev-servern tar för lång tid att starta (särskilt första gången Turbopack kompilerar)

**Lösning**:
- Timeout är nu 5 minuter i `playwright.config.ts`
- Första kompileringen kan ta 4-5 minuter
- Efterföljande körningar är mycket snabbare (30-60 sekunder)

**Rekommendation**: Starta dev-servern manuellt först:
```bash
# Terminal 1
npm run dev  # Vänta tills "Ready in X.Xs"

# Terminal 2
npm run test:e2e
```

### "Test timeout of 30000ms exceeded"
**Problem**: Tester tar för lång tid att köra

**Lösning**:
- Test timeout är nu 60 sekunder i `playwright.config.ts`
- Action timeout är 15 sekunder
- Navigation timeout är 30 sekunder

Om enskilda tester behöver längre tid, öka timeout i testet:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(120000); // 2 minuter
  // ...
});
```

### "webServer did not start"
- Kolla att port 3000 inte redan används: `lsof -i :3000`
- Döda befintliga processer: `pkill -f "next dev"`
- Kör `npm run dev` manuellt först för att se om det startar

### "element not found"
- Använd `--headed` mode för att se vad som händer
- Kolla att testet väntar på rätt element
- Öka element timeout: `await page.waitForSelector('[data-testid="foo"]', { timeout: 10000 })`

### "database not seeded"
- Kör seed-scriptet: `npx tsx prisma/seed-test-users.ts`
- Verifiera i Prisma Studio: `npm run db:studio`

## 📚 Resurser

- [Playwright Docs](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors Guide](https://playwright.dev/docs/selectors)
- [Test Generators](https://playwright.dev/docs/codegen) - Generera tester automatiskt!

## 🎭 Tips & Tricks

### Generera tester automatiskt
```bash
npx playwright codegen http://localhost:3000
```
Öppnar en browser där du kan klicka runt - Playwright genererar testkoden åt dig!

### Uppdatera browser-versioner
```bash
npx playwright install chromium
```

### Kör bara misslyckade tester
```bash
npx playwright test --last-failed
```
