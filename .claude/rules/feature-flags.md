# Feature Flags

## Prioritetsordning

1. **Miljövariabel** (högst): `FEATURE_VOICE_LOGGING=true` i `.env` / `.env.local`
2. **Databas-override**: Via admin-panelen `/admin/system`
3. **Kod-default**: `defaultEnabled` i `src/lib/feature-flag-definitions.ts`

## Filer

| Fil | Innehåll |
|-----|----------|
| `src/lib/feature-flag-definitions.ts` | Flagg-metadata (klient-safe, ingen server-import) |
| `src/lib/feature-flags.ts` | Server-only: `isFeatureEnabled()`, `getFeatureFlags()`, cache, DB-access |
| `src/components/providers/FeatureFlagProvider.tsx` | Klient: `useFeatureFlag()`, `useFeatureFlags()` |

## Standardmönster: Server-side (API route)

```typescript
import { isFeatureEnabled } from "@/lib/feature-flags"

// Placering: tidigt i handler, före affärslogik
if (!(await isFeatureEnabled("flag_name"))) {
  return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
}
```

- **Statuskod**: Alltid `404` (döljer att feature existerar)
- **Felmeddelande**: Alltid `"Ej tillgänglig"`
- **Placering**: Efter auth + rate limit, före JSON-parsing/affärslogik

## Standardmönster: Klient-side (UI)

```typescript
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"

const enabled = useFeatureFlag("flag_name")

if (!enabled) {
  return <Layout><p>Funktionen är inte tillgänglig just nu.</p></Layout>
}
```

## Test-mock

```typescript
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

import { isFeatureEnabled } from "@/lib/feature-flags"
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

// I beforeEach (efter vi.clearAllMocks):
mockIsFeatureEnabled.mockResolvedValue(true)

// I test:
it("returns 404 when flag is disabled", async () => {
  mockIsFeatureEnabled.mockResolvedValueOnce(false)
  // ...
  expect(res.status).toBe(404)
  expect(mockIsFeatureEnabled).toHaveBeenCalledWith("flag_name")
})
```

## Checklista: Ny feature flag

- [ ] Definiera i `src/lib/feature-flag-definitions.ts`
- [ ] Server-gate: `isFeatureEnabled()` i alla API-routes (404)
- [ ] Klient-gate: `useFeatureFlag()` i UI-sidor
- [ ] Unit test per route handler: "returns 404 when flag disabled"
- [ ] E2E test i `e2e/feature-flag-toggle.spec.ts`
- [ ] Nav-gating i `ProviderNav` / `BottomTabBar` / `CustomerLayout`

## Dual gating (route-level + service-level)

Vissa features har checks på BÅDA nivåer (t.ex. `recurring_bookings`):
- **Route-level 404**: Döljer att endpointen existerar. Första linjens försvar.
- **Service-level check**: Skyddar mot att servicen anropas från andra ställen (bakgrundsjobb, admin-verktyg). Ta INTE bort den bara för att route-level check finns.

Detta är defense in depth -- inte redundans.

## Viktigt

- **Importera aldrig `feature-flags.ts` i klient-komponenter** -- det drar in Prisma. Använd `feature-flag-definitions.ts` för metadata eller `useFeatureFlag()` för state.
- **Feature flags är feature gates, inte security gates** -- de ersätter inte auth/ownership-checks.
- **E2E env-var**: Feature-flag-gated E2E kräver `FEATURE_X=true` i `.env` + `playwright.config.ts` webServer.env.
- **Cache-TTL 30s**: Flagg-ändringar kan ta upp till 30s att slå igenom i andra serverless-instanser.
