# Feature Flag Hardening: Genomgång och Standardisering

## Context

Efter migrationen av feature flags från Redis till PostgreSQL behöver vi säkerställa att flaggorna faktiskt *gör något*. En genomlysning avslöjade:

- **Kritiskt:** `group_bookings` (default:false) har 7 API-routes utan feature flag-check -- API:t är öppet trots att flaggan är avstängd.
- **Server-gaps:** `voice_logging` och `route_planning` checkas bara i klienten -- API-anrop fungerar oavsett flagga.
- **Döda flaggor:** `route_announcements`, `customer_insights`, `business_insights` checkas aldrig -- att toggla dem i admin gör ingenting.
- **Inkonsistens:** Befintliga checks använder 404 (follow/municipality), 403 (self_reschedule), eller service-level error (recurring_bookings).

**Mål:** Alla 12 flaggor ska vara meningsfulla. Standardiserat mönster. E2E-verifiering.

---

## Standardmönster

Alla feature-gated API-routes ska använda detta mönster överst, direkt efter auth + rate limit:

```typescript
if (!(await isFeatureEnabled("flag_name"))) {
  return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
}
```

- **404** (inte 403) -- undviker feature enumeration
- **"Ej tillgänglig"** -- konsekvent felmeddelande
- Placeras efter auth + rate limit, före JSON-parsing

Klient-sida:
```typescript
const flagName = useFeatureFlag("flag_name")
if (!flagName) return null  // eller fallback-UI
```

---

## Fas 1: Kritisk fix -- group_bookings server-gating (TDD)

**Mål:** Alla 7 group_bookings-routes returnerar 404 när flaggan är av.

**Filer att ändra:**

| Fil | Metoder |
|-----|---------|
| `src/app/api/group-bookings/route.ts` | GET, POST |
| `src/app/api/group-bookings/[id]/route.ts` | GET, PUT, DELETE |
| `src/app/api/group-bookings/join/route.ts` | POST |
| `src/app/api/group-bookings/available/route.ts` | GET |
| `src/app/api/group-bookings/preview/route.ts` | POST |
| `src/app/api/group-bookings/[id]/match/route.ts` | POST |
| `src/app/api/group-bookings/[id]/participants/[pid]/route.ts` | DELETE |

**Testfiler att ändra:** Motsvarande `route.test.ts` -- lägg till test per route: "returns 404 when feature flag is disabled".

**Mönster:** Lägg till `isFeatureEnabled("group_bookings")`-check överst i varje handler, efter auth + rate limit.

**Commit efter fas 1.**

---

## Fas 2: Server-gating -- voice_logging + route_planning (TDD)

**Mål:** voice_logging och route_planning API-routes returnerar 404 när flaggan är av.

**voice_logging:**
| Fil | Metoder |
|-----|---------|
| `src/app/api/voice-log/route.ts` | POST |
| `src/app/api/voice-log/confirm/route.ts` | POST |

**route_planning:**
| Fil | Metoder |
|-----|---------|
| `src/app/api/routes/route.ts` | POST |
| `src/app/api/routes/[id]/route.ts` | GET |
| `src/app/api/routes/my-routes/route.ts` | GET |
| `src/app/api/routes/[id]/stops/[stopId]/route.ts` | PATCH |

**Tester:** routes/ har inga befintliga testfiler -- skapa nya `route.test.ts` med feature flag-test. voice-log/ har befintliga testfiler.

**Commit efter fas 2.**

---

## Fas 3: Klient-gating -- döda flaggor

**Mål:** Toggla route_announcements/customer_insights/business_insights i admin döljer dem i UI.

**route_announcements:**
- `src/app/announcements/page.tsx` -- Wrap annonslistan med `useFeatureFlag("route_announcements")`-check. Visa meddelande ("Rutt-annonser är inte tillgängliga just nu") om flaggan är av.

**customer_insights:**
- `src/app/provider/customers/page.tsx` -- Conditional render av `<CustomerInsightCard>` baserat på `useFeatureFlag("customer_insights")`.

**business_insights:**
- `src/app/provider/insights/page.tsx` -- Check `useFeatureFlag("business_insights")` överst. Visa meddelande om flaggan är av.

**Inga tester** (UI-förändringar verifieras via typecheck + manuellt + E2E i fas 5).

**Commit efter fas 3.**

---

## Fas 4: Standardisera befintliga checks

**Mål:** Enhetligt 404-mönster i alla befintliga feature-gated routes.

**self_reschedule** -- `src/app/api/bookings/[id]/reschedule/route.ts`:
- Ändra från 403 till 404 + "Ej tillgänglig" (matcha standardmönstret).

**recurring_bookings** -- Behåll service-level check (BookingSeriesService) men lägg även till route-level 404 i:
- `src/app/api/booking-series/route.ts` (POST)
- `src/app/api/booking-series/[id]/route.ts` (GET, PUT)
- `src/app/api/booking-series/[id]/cancel/route.ts` (POST)

**Verifiera** att follow_provider och municipality_watch redan använder 404 (de gör det).

**Uppdatera tester** som assertar på 403 till 404.

**Commit efter fas 4.**

---

## Fas 5: E2E-tester -- API-enforcement

**Mål:** Verifiera att API:er faktiskt returnerar 404 när flagga är av.

**Utöka** `e2e/feature-flag-toggle.spec.ts` med nya testfall:

```typescript
// Nytt test-block: "API enforcement when flags are OFF"
test("group_bookings API returns 404 when flag is off", async ({ page }) => {
  await setFlag(page, "group_bookings", false)
  const res = await page.request.post("/api/group-bookings", { data: {...} })
  expect(res.status()).toBe(404)
})

test("voice_logging API returns 404 when flag is off", ...)
test("route_planning API returns 404 when flag is off", ...)
```

**Testfall att lägga till:** Ett per flagga med default:false (group_bookings, recurring_bookings, follow_provider, municipality_watch) + voice_logging + route_planning.

**Commit efter fas 5.**

---

## Fas 6: Dokumentation + regler

**Mål:** Framtida features använder rätt mönster från start.

**Skapa** `.claude/rules/feature-flags.md`:
- Standardmönster (404, placering, felmeddelande)
- Checklista: server-gate + klient-gate + E2E-test
- Var flaggor definieras (src/lib/feature-flags.ts)
- Prioritetsordning (env > DB > kod-default)

**Commit efter fas 6.**

---

## Fas 7: Agent-review

Kör superpowers-agenterna:
1. **security-reviewer** -- Granska alla ändrade API-routes
2. **tech-architect** -- Granska det standardiserade mönstret och flagg-arkitekturen

Fixa eventuella findings.

---

## Filer som INTE ändras

| Fil | Anledning |
|-----|-----------|
| `src/lib/feature-flags.ts` | Redan migrerad, fungerar korrekt |
| `src/infrastructure/persistence/feature-flag/*` | Nytt, redan testat |
| `src/app/api/admin/settings/route.ts` | Redan uppdaterad med 503-hantering |
| `src/components/providers/FeatureFlagProvider.tsx` | Inget ändras i klientens flag-leverans |
| `offline_mode`-relaterade filer | Ren klient-feature, server-gate ej relevant |

---

## Verifiering

1. **Unit tests:** `npm run test:run` -- alla befintliga + nya tester gröna
2. **Typecheck:** `npm run typecheck` -- 0 errors
3. **Lint:** `npm run lint` -- 0 errors
4. **E2E:** `npx playwright test e2e/feature-flag-toggle.spec.ts` -- alla tester gröna (inkl. nya API-enforcement-tester)
5. **Manuellt:** Stäng av group_bookings i admin -> anropa `POST /api/group-bookings` -> ska ge 404
6. **security-reviewer:** Alla ändrade routes godkända
7. **tech-architect:** Mönstret godkänt
