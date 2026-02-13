# E2E-tester med Playwright

Detta projekt använder **Playwright** för end-to-end-tester som testar hela användarflöden i en riktig webbläsare.

## Snabbstart

### Kör E2E-tester

```bash
# Kör alla E2E-tester (headless mode, desktop + mobil)
npm run test:e2e

# Kör bara desktop
npx playwright test --project=desktop

# Kör bara mobil
npx playwright test --project=mobile

# Kör med UI (visuellt interface)
npm run test:e2e:ui

# Kör med synlig browser (se vad som händer)
npm run test:e2e:headed

# Debug-läge (steg-för-steg)
npm run test:e2e:debug
```

## Teststruktur

```
e2e/
├── fixtures.ts                    # Custom test med Prisma + cleanup
├── accepting-new-customers.spec.ts # Stäng för nya kunder
├── admin.spec.ts                  # Admin-gränssnitt
├── announcements.spec.ts          # Utannonsering av rutter
├── auth.spec.ts                   # Registrering, inloggning, logout
├── booking.spec.ts                # Sök, boka, avboka
├── calendar.spec.ts               # Kalender och öppettider
├── customer-profile.spec.ts       # Kundprofil
├── customer-registry.spec.ts      # Kundregister (leverantör)
├── customer-reviews.spec.ts       # Kundrecensioner
├── due-for-service.spec.ts        # Besöksplanering
├── flexible-booking.spec.ts       # Flexibla bokningar
├── group-bookings.spec.ts         # Gruppbokningar
├── horses.spec.ts                 # Hästregister
├── manual-booking.spec.ts         # Manuell bokning
├── payment.spec.ts                # Betalning
├── provider-notes.spec.ts         # Leverantörsanteckningar
├── provider.spec.ts               # Leverantörsfunktioner
├── route-planning.spec.ts         # Ruttplanering
├── security-headers.spec.ts       # Säkerhetshuvuden
└── setup/
    ├── seed-e2e.setup.ts          # Global seed (read-only basdata)
    ├── seed-helpers.ts            # Per-spec seed helpers
    ├── e2e-utils.ts               # Hjälpfunktioner (futureWeekday, etc.)
    └── teardown.setup.ts          # Global cleanup
```

**19 spec-filer** -- 115+ desktop-tester, 82+ mobil-tester (6 respektive 21 skips).

## Viewports

Testerna körs i två Playwright-projekt:

| Projekt | Enhet | Viewport | Browser |
|---------|-------|----------|---------|
| `desktop` | Desktop Chrome | 1280x720 | Chromium |
| `mobile` | Pixel 7 | 412x915 | Chromium |

**OBS:** Kör ALDRIG desktop och mobil samtidigt manuellt -- de delar dev-server och kan ge falska failures. `npm run test:e2e` hanterar detta automatiskt.

## Test Data (Seed)

### Global seed (`seed-e2e.setup.ts`)

Skapar read-only basdata som alla tester förutsätter:
- Testanvändare (kund + leverantör + admin)
- Provider-profil med tjänster
- Häst
- Tillgänglighetsschema (mån-fre)

### Per-spec seed (`seed-helpers.ts`)

Skapar spec-specifik data som rensas efter testet:

```typescript
import { seedBooking, seedRouteOrders, seedProviderAnnouncement, seedRoute, cleanupSpecData } from './setup/seed-helpers';

// I beforeAll:
await seedBooking({ tag: 'my-spec', ... });

// I afterAll:
await cleanupSpecData('my-spec');
```

**Marker:** `E2E-spec:<tag>` i customerNotes/specialInstructions. Cleanup hittar och tar bort data via dessa markörer.

### Testanvändare
- **Kund**: `test@example.com` / `TestPassword123!`
- **Leverantör**: `provider@example.com` / `ProviderPass123!`
- **Admin**: `admin@example.com` / `AdminPass123!`

### Environment-variabler
- `E2E_CLEANUP=false` -- bevarar testdata efter körning (debugging)
- `E2E_ALLOW_REMOTE_DB=true` -- tillåter E2E mot hostad Supabase-dev

## Test Isolation med Fixtures

**VIKTIGT:** Alla spec-filer ska importera från `./fixtures` istället för `@playwright/test`:

```typescript
// RÄTT
import { test, expect, prisma } from './fixtures';

// FEL
import { test, expect } from '@playwright/test';
```

Fixtures ger:
- `prisma` -- Prisma Client singleton för direkt DB-access i setup/teardown
- `test` -- Playwright test med rate-limit-reset i beforeAll

## Selektorer

Prioritetsordning:
1. **role + name** (bäst): `getByRole('button', { name: /boka/i })`
2. **data-testid**: `[data-testid="provider-card"]`
3. **data-slot** (shadcn): `[data-slot="card"]`
4. **label**: `getByLabel(/e-post/i)`
5. **text** (sista alternativet): `getByText(/välkommen/i)`

**Undvik:**
- `.border.rounded-lg` -- shadcn Card-klasser ändras mellan versioner, använd `[data-slot="card"]`
- `getByRole('alertdialog')` -- fungerar inte med mobil Drawer, använd text-selektorer

### Mobil-specifika selektorer
- Desktop-nav har `hidden md:block` -- `getByText` hittar dolda element i mobil viewport
- Använd `getByRole('heading', { exact: true })` för att undvika strict mode violations
- Bottom tab bar duplicerar nav-text -- var specifik med selektorer

## Debugging

### Kör ett specifikt test
```bash
npx playwright test auth.spec.ts
npx playwright test booking.spec.ts:215  # Specifik rad
```

### Debug mode
```bash
npm run test:e2e:debug
```

### Headed mode (se browsern)
```bash
npm run test:e2e:headed
```

### Visa test-rapport
```bash
npx playwright show-report
```

## Konfiguration

E2E-testerna konfigureras i `playwright.config.ts`:

- **Browser**: Chromium (desktop + mobil)
- **Base URL**: `http://localhost:3000`
- **Auto-start**: Dev-servern startas automatiskt
- **Workers**: 1 (delar dev-server)
- **Screenshots**: Vid failure
- **Trace**: Vid retry
- **Reporter**: HTML

### Timeouts
- Test: 60 sekunder
- Action: 15 sekunder
- Navigation: 30 sekunder

## Test Coverage Pyramid

```
          E2E: 115+ desktop + 82+ mobil (hela användarflöden)
              ↑
   Integration: ~500 tests (API routes, domain services)
              ↑
          Unit: ~1000 tests (utilities, hooks, repositories)
```

**Total**: 1600+ tester

## Tips

### Skip-pattern för mobil
```typescript
test('kalender dagvy', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'Kalender dagvy funkar inte på mobil');
  // ...
});
```

### futureWeekday() för seedade datum
```typescript
import { futureWeekday } from './setup/e2e-utils';
// Garanterar mån-fre (leverantören har mån-fre schema)
const date = futureWeekday(7);
```

### Generera tester automatiskt
```bash
npx playwright codegen http://localhost:3000
```

### Kör bara misslyckade tester
```bash
npx playwright test --last-failed
```
