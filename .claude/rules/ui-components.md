---
paths:
  - "src/app/**/page.tsx"
  - "src/components/**/*.tsx"
---

# UI & Komponent Requirements

## Mobil-forst

- `useIsMobile()` + `isMobile ? <MobileDrawer /> : <DesktopDialog />`
- Hook-extrahering for delad logik mellan mobil/desktop
- `ResponsiveDialog` (`src/components/ui/responsive-dialog.tsx`) for alla modala floden
- `ResponsiveAlertDialog` for alla bekraftelsedialoger (avboka, ta bort)

## Touch targets

- `min-h-[44px] sm:min-h-0` inbakat i Button (default/lg), Input, SelectTrigger
- `size="sm"` knappar far INTE automatiska touch targets -- lagg till manuellt
- Nativa element (button, select, span, a): anvand `touch-target` CSS utility
- Knapp-stacking: `flex-col gap-2 sm:flex-row`
- Formular-grid: `grid-cols-1 sm:grid-cols-2`

## ResponsiveAlertDialog -- KRITISKA regler

- **ALDRIG always-mounted** (`open={!!state}`). Anvand ALLTID villkorad rendering (`{state && <Dialog open={true}>}`)
- Barn-komponenter laser `isMobile` via React Context (inte egna `useIsMobile()`-anrop)
- Action handlers MASTE explicit stanga dialogen (`setState(null)`) -- auto-close fungerar inte pa mobil
- Cancel behover explicit `onClick={() => setState(null)}`
- Rendera ALDRIG AlertDialog med AlertDialogTrigger inuti `.map()` -- anvand kontrollerad state + en dialog utanfor loopen

## VoiceTextarea

`src/components/ui/voice-textarea.tsx` ersatter `Textarea` overallt dar leverantorer skriver fritext.
Drop-in-replacement: byt import + andra `onChange` fran `(e) => setValue(e.target.value)` till `(value) => setValue(value)`.

## FAB-monster for mobil

`fixed bottom-20 right-4 md:hidden h-14 w-14 rounded-full shadow-lg bg-green-600 z-40`

## Data Fetching

- **SWR för client-side polling**: Ersätt manuell useState/setInterval med `useSWR(key, fetcher, { refreshInterval })` för deduplication och caching.
- **Polling-providers**: Använd `setState(fn)` med shallow-compare -- returnera samma referens vid identiska värden så React skippar re-render.

## Design System

- Primary: `green-600`, Background: `gray-50`, Text: `gray-900`/`gray-600`
- Komponenter: shadcn/ui (`npx shadcn@latest add [component]`)
- Forms: React Hook Form + Zod
- Flerradsceller i tabeller: `font-medium` + `text-xs text-gray-500` + `text-xs text-gray-400`
