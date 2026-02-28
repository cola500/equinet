# Retrospektiv: Grafisk profil och landningssida

**Datum:** 2026-02-28
**Scope:** Grafisk profil med hästsko-ikon, varm palett, omskriven landningssida och build-fix

---

## Resultat

- 19 ändrade filer, 2 nya filer, 0 nya migrationer
- 0 nya tester (rent UI/branding-arbete)
- 2784 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Icons | `public/icons/icon-*.svg` (3 st) | Hästsko + "Equinet"-text, ny grön grundfärg `#2d7a4e` |
| CSS | `globals.css` | CSS-variabler `--equinet-green`, `--equinet-amber`, DM Serif Display heading-font |
| Layout | `layout.tsx` | Google Fonts-import för DM Serif Display |
| Landing | `page.tsx` | Komplett omskrivning: hero, features-grid, FAQ-accordion, dubbla CTA:er |
| Register | `register/page.tsx` | Role pre-select via `?role=` queryparam + Suspense-boundary fix |
| Navigation | `Header.tsx`, `ProviderNav.tsx`, `CustomerNav.tsx`, `BottomTabBar.tsx` | HorseIcon ersätter text-logo |
| Komponenter | `HorseIcon.tsx`, `accordion.tsx` | Ny SVG-ikon-komponent, shadcn/ui Accordion |
| Dashboard | `dashboard/page.tsx`, `due-for-service/page.tsx` | Färguppdateringar till ny palett |
| Övrigt | `CustomerCard.tsx`, `horses/page.tsx`, `manifest.ts` | Mindre justeringar för konsistent palett |

## Vad gick bra

### 1. Snabb root-cause-analys av build-fel
Hittade felet (`useSearchParams()` utan Suspense-boundary) direkt i GitHub Actions-loggarna. Systematisk approach: `gh pr checks` -> `gh api .../jobs/.../logs` -> grep på relevanta felmeddelanden.

### 2. Minimal fix, maximal effekt
Suspense-fixen var 8 raders ändring (ny wrapper-komponent + Suspense-import) som löste hela build-problemet. Ingen överingenjörering.

## Vad kan förbättras

### 1. Testa production build lokalt innan push
Build-felet med `useSearchParams()` hade fångats av `npm run build` lokalt. Pre-push hooks kör tester och typecheck men inte full production build (för långsamt). Nästa gång: kör `npm run build` manuellt vid ändringar i sidor som använder client-side hooks.

**Prioritet:** MEDEL -- detta är en känd Next.js-gotcha som bör dokumenteras.

### 2. Inga tester för landningssidan
Landningssidan och register-sidans role-preselect saknar tester. Acceptabelt för statiskt UI-innehåll, men role-preselect-logiken borde ha ett test.

**Prioritet:** LÅG -- statisk landing page, men register-logiken bör testas.

## Patterns att spara

### useSearchParams() kräver Suspense-boundary
Next.js App Router kräver att `useSearchParams()` wrappas i `<Suspense>` för att sidan ska kunna pre-renderas statiskt. Mönster: exportera en wrapper-komponent som default, lägg den faktiska komponenten i en `<Suspense>`-boundary.

```tsx
export default function Page() {
  return <Suspense><ActualPage /></Suspense>
}
function ActualPage() {
  const searchParams = useSearchParams()
  // ...
}
```

## 5 Whys (Root-Cause Analysis)

### Problem: Vercel preview build failade på register-sidan
1. Varför? `useSearchParams()` kastade fel vid static prerendering
2. Varför? Next.js kräver en Suspense-boundary runt `useSearchParams()` vid prerendering
3. Varför? `useSearchParams()` är en client-only hook som inte kan köras server-side utan fallback
4. Varför? Vi lade till `useSearchParams()` i register-sidan utan Suspense-boundary
5. Varför? Dev-servern visar bara en varning (inte ett fel), så det fångades inte lokalt

**Åtgärd:** Dokumentera som gotcha. Överväg att lägga till `npm run build` som steg i pre-push hook för sidor som ändrats (men detta är troligen för långsamt).
**Status:** Implementerad (fix mergad)

## Lärandeeffekt

**Nyckelinsikt:** `useSearchParams()` i Next.js App Router kräver alltid en `<Suspense>`-boundary -- dev-servern varnar bara, men production build kraschar. Testa alltid med `npm run build` vid ändringar i sidor som använder client-side navigation-hooks.
