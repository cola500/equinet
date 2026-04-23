---
title: "S53-1: FAQ-rotorsak + SEO-återställning"
description: "Plan för att fixa hydration-mismatch och återställa SEO för FAQ-sektionen"
category: plan
status: active
last_updated: 2026-04-23
sections:
  - Bakgrund
  - Rotorsaksanalys
  - Vald lösning
  - Filer som ändras
  - Approach
  - Risker
---

# S53-1: FAQ-rotorsak + SEO-återställning

## Aktualitet verifierad

**Kommandon körda:**
- `grep -n "mounted\|useState\|useEffect" src/app/page.tsx` → bekräftar `mounted`-state på rad 139-140
- `grep -n "mounted" src/app/page.tsx` → rad 332: `{mounted ? (<Accordion>` och rad 345-352: fallback med bara frågor
- `npm list @radix-ui/react-accordion` → `1.2.12` (senaste i radix-ui@1.4.3)

**Resultat:** Problemet finns kvar. `mounted`-gate renderar bara frågor i SSR. Inga nyare Radix-versioner tillgängliga i monorepo.

**Beslut:** Fortsätt. Väljer Option B (native `<details>/<summary>`).

## Bakgrund

Commit `908aee19` lade till en `mounted`-gate i `src/app/page.tsx` som döljer Radix Accordion-svar från SSR. SEO-regression: Google indexerar inte FAQ-svar. Hydration-warning i console.

## Rotorsaksanalys

`page.tsx` har `"use client"` och använder `useState`/`useEffect` för en `mounted`-flagga. Mounted-gaten renderar:
- **SSR (mounted=false):** Bara frågor, inga svar → SEO-regression
- **Klient (mounted=true):** Radix Accordion med frågor + svar

Radix Accordion's `@radix-ui/react-id` använder `useId()` internt för att koppla trigger till content-panel (aria-controls). React 19 ändrade hur `useId()` räknar contexts, vilket skapade en mismatch om annan komponent i trädet förändrar antalet React-contexts. `AnnouncementPreview` (client component) kan ha introducerats och rubbat räknaren.

## Vald lösning

**Option B: Native `<details>/<summary>`**

Motivering:
- Garanterar SSO-paritet: svar är alltid i HTML oavsett JS-status
- Noll hydration-risk (rent HTML)
- Fullt SEO-bart
- Tar bort `mounted`-gaten + `useState`/`useEffect` helt
- `"use client"` kan tas bort från `page.tsx` (page är i övrigt statisk)

Trade-off: förlorar Radix animering. Accepterat för demo-scope — kan läggas till med CSS `transition`.

## Filer som ändras

| Fil | Ändring |
|-----|---------|
| `src/app/page.tsx` | Ta bort `"use client"`, `useState`, `useEffect`, `mounted`-gate. Ersätt Accordion-block med native `<details>/<summary>`. Ta bort oanvända Accordion-imports. |
| `src/app/page.test.tsx` (ny) | Vitest-test: verifiera att FAQ-svar finns i rendered HTML. |

## Approach

1. **RED**: Ny `src/app/page.test.tsx` — `render(<Home />)`, assertera att ett FAQ-svar (`"Det är gratis att skapa konto"`) syns i DOM. Testet ska faila med nuvarande kod (mounted=false vid initial render ger ej svaret).
2. **GREEN**:
   - Ta bort `"use client"` från `page.tsx`
   - Ta bort `import { useEffect, useState } from "react"`
   - Ta bort `mounted`-state och `useEffect`
   - Ersätt `{mounted ? <Accordion>...</Accordion> : <div>frågor</div>}` med:
     ```tsx
     <div className="w-full">
       {faqItems.map((item, index) => (
         <details key={index} className="border-b last:border-b-0 py-4 group">
           <summary className="cursor-pointer text-sm font-medium hover:underline list-none flex justify-between items-center">
             {item.question}
             <ChevronDownIcon className="w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
           </summary>
           <p className="mt-2 pb-2 text-sm text-gray-600">{item.answer}</p>
         </details>
       ))}
     </div>
     ```
   - Ta bort oanvända Accordion-imports
   - Behåll `ChevronDownIcon` (används i details-pilen)
3. **VERIFY**: `curl` + testet ska vara grönt

## Risker

| Risk | Sannolikhet | Mitigering |
|------|-------------|------------|
| `"use client"` behövs av annan orsak | Låg | `AnnouncementPreview` har eget `"use client"` — server component kan rendera det fine. `Header` kontrolleras. |
| ChevronDown-import ej importerad | N/A | Redan importerad från lucide-react |
| CSS `list-none` + `summary` cross-browser | Låg | Testad i moderna browsers, `list-none` döljer default triangle i alla |
