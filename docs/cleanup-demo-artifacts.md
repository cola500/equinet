---
title: Cleanup Demo Artifacts
description: Inventering av tillfälliga filer och artifacts att rensa från projektkatalogen
category: operations
status: active
last_updated: 2026-03-26
sections:
  - Säkert att ta bort
  - Osäkert
  - Redan ignorerat
  - Gitignore-förslag
---

# Cleanup Demo Artifacts

Inventering 2026-03-26. Alla sökvägar relativt projektroten.

---

## Säkert att ta bort (43 filer)

### Demo-walkthrough screenshots (denna session) -- 30 filer

Skapade av Playwright MCP under demo-genomgångarna. Inte refererade i kod eller docs.

| Fil | Anledning |
|-----|-----------|
| `demo-1-login.png` | Round 0 walkthrough |
| `demo-2-dashboard.png` | Round 0 walkthrough |
| `demo-3-customers.png` | Round 0 walkthrough |
| `demo-4-calendar.png` | Round 0 walkthrough |
| `demo-5-create-booking.png` | Round 0 walkthrough |
| `demo-5b-booking-filled.png` | Round 0 walkthrough |
| `demo-6-booking-created.png` | Round 0 walkthrough |
| `demo-7-booking-detail.png` | Round 0 walkthrough |
| `demo-8-booking-completed.png` | Round 0 walkthrough |
| `demo-9-bookings-list.png` | Round 0 walkthrough |
| `demo-10-services.png` | Round 0 walkthrough |
| `demo-mode-1-login.png` | Round 1 walkthrough |
| `demo-mode-2-dashboard.png` | Round 1 walkthrough |
| `demo-mode-3-customers.png` | Round 1 walkthrough |
| `demo-mode-4-services.png` | Round 1 walkthrough |
| `demo-mode-5-settings.png` | Round 1 walkthrough |
| `demo-mode-6-profile.png` | Round 1 walkthrough |
| `r2-dashboard.png` | Round 2 walkthrough |
| `r2-customers.png` | Round 2 walkthrough |
| `r2-services.png` | Round 2 walkthrough |
| `r2-calendar.png` | Round 2 walkthrough |
| `r2-bookings.png` | Round 2 walkthrough |
| `go-1-login.png` | Go/no-go walkthrough |
| `go-2-dashboard.png` | Go/no-go walkthrough |
| `go-3-customers.png` | Go/no-go walkthrough |
| `go-4-services.png` | Go/no-go walkthrough |
| `go-5-bookings-EMPTY.png` | Go/no-go walkthrough |
| `go-5b-bookings-full.png` | Go/no-go walkthrough |
| `final-1-login.png` | Final walkthrough |
| `final-2-services.png` | Final walkthrough |
| `final-3-calendar.png` | Final walkthrough |
| `final-4-booking-dialog.png` | Final walkthrough |

**Rekommendation:** TA BORT alla 32

### Äldre UI-screenshots i roten -- 9 filer

Skapade i tidigare sessioner. Inte refererade i kod eller docs (kontrollerat).

| Fil | Anledning |
|-----|-----------|
| `alternatives-mobile.png` | Äldre UX-jämförelse |
| `alternatives-section.png` | Äldre UX-jämförelse |
| `bookings-editing-note.png` | Äldre boknings-screenshot |
| `bookings-full-page.png` | Äldre boknings-screenshot |
| `bookings-page-overview.png` | Äldre boknings-screenshot |
| `calendar-dialog-editing.png` | Äldre kalender-screenshot |
| `calendar-dialog-notes.png` | Äldre kalender-screenshot |
| `calendar-view.png` | Äldre kalender-screenshot |
| `equinet-card-fix.png` | Äldre buggfix-screenshot |
| `landing-full.png` | Äldre landing page screenshot |
| `landing-page-full.png` | Äldre landing page screenshot |
| `landing-page-updated.png` | Äldre landing page screenshot |

**Rekommendation:** TA BORT alla 12 (ingen referens i kod/docs)

### Playwright MCP console-loggar -- katalog

| Sökväg | Anledning |
|--------|-----------|
| `.playwright-mcp/` | Console-loggar från Playwright MCP. Redan i .gitignore. |

**Rekommendation:** TA BORT innehållet (katalogen återskapas vid behov)

---

## Osäkert / behöver mänskligt beslut

### E2E snapshots

| Sökväg | Storlek | Anledning |
|--------|---------|-----------|
| `e2e/__snapshots__/` | 1.3 MB | Visuella regressions-snapshots. Kan vara medvetet skapade. |

**Rekommendation:** OSÄKERT -- kolla om de används av `e2e/visual-regression.spec.ts`

### Övriga kataloger

| Sökväg | Storlek | Anledning |
|--------|---------|-----------|
| `ux-review/` | 956 KB | Kan vara UX-granskningsdokumentation |
| `genomlysningar/` | 44 KB | Kan vara produktanalys-dokument |
| `security-reports/` | 328 KB | Kan vara säkerhetsgranskningar |

**Rekommendation:** OSÄKERT -- dessa kan vara värdefull dokumentation. Kolla innehållet.

---

## Redan ignorerat av .gitignore

Dessa finns lokalt men pushas inte till repo:

- `.playwright-mcp/` -- Playwright MCP console-loggar
- `playwright-report/` -- Playwright HTML-rapporter
- `test-results/` -- Testresultat
- `.next/` -- Next.js build-cache
- `node_modules/` -- Dependencies

---

## Gitignore-förslag

Lägg till följande för att förhindra att framtida screenshots hamnar i repot:

```gitignore
# Demo/walkthrough screenshots (Playwright MCP)
demo-*.png
go-*.png
r2-*.png
final-*.png
```

Alternativt, bredare:

```gitignore
# Root-level screenshots (aldrig avsedda för repo)
/*.png
```

Den bredare regeln (`/*.png`) fångar alla PNG-filer i projektroten utan att påverka `public/`, `src/`, eller andra underkataloger.
