# Retrospektiv: Fix ResponsiveAlertDialog mobilkrasch

**Datum:** 2026-02-10
**Scope:** Hotfix for production crash on mobile devices caused by always-mounted ResponsiveAlertDialog

---

## Resultat

- 3 andrade filer, 0 nya filer, 0 nya migrationer
- 0 nya tester (ren buggfix, alla 1336 befintliga tester grona)
- 1336 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session (inkl. utredning)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| UI | `src/app/customer/bookings/page.tsx` | Villkorad rendering av ResponsiveAlertDialog |
| UI | `src/app/customer/horses/page.tsx` | Villkorad rendering av ResponsiveAlertDialog |
| UI | `src/app/customer/group-bookings/[id]/page.tsx` | Villkorad rendering av 3 ResponsiveAlertDialogs |

## Vad gick bra

### 1. Systematisk felisolering via elimineringsmetoden
Utan tillgang till browser-konsol (felet var pa mobiltelefon i produktion) identifierades grundorsaken genom att jamfora vilka sidor som kraschade vs fungerade. Korrelationen "alla sidor med ResponsiveAlertDialog kraschar" pekade direkt pa boven.

### 2. Snabb fix utan logikandringar
Fixen var en ren rendering-andring: flytta fran always-mounted (`open={!!state}`) till conditionally-mounted (`{state && <Dialog open={true}>}`). Noll affarslogik andrades, noll tester behövde uppdateras.

### 3. Defensiv fix av alla drabbade sidor
Alla tre sidor med ResponsiveAlertDialog fixades i samma session, inklusive `group-bookings/[id]` som annu inte rapporterats som kraschad men hade samma monster.

## Vad kan forbattras

### 1. ResponsiveAlertDialog borde framtvinga villkorad rendering
Komponenten borde dokumenteras (eller designas) sa att den ALLTID anvands med villkorad rendering. Alternativt kunde den internt hantera mount/unmount sa att always-mounted anvandning ar saker.

**Prioritet:** MEDEL -- nuvarande konvention fungerar, men en ny utvecklare kan gora samma misstag.

### 2. Saknad mobiltest i deploy-pipeline
Produktionskraschen fangades bara av manuell test pa telefon. En E2E-test med mobil viewport (Playwright `isMobile: true`) hade kunnat fanga detta.

**Prioritet:** LAG -- E2E med mobil viewport ar planerad men inte prioriterad for MVP.

### 3. Ingen error boundary
Appen har ingen `error.tsx` pa nagon niva. En error boundary hade gett ett battre felmeddelande an Next.js generiska "Application error" och mojliggjort debugging.

**Prioritet:** MEDEL -- enkel att lagga till, stor forvantad vinst vid framtida fel.

## Patterns att spara

### ResponsiveAlertDialog: alltid villkorad rendering
```tsx
// FEL: always-mounted, kraschar pa mobil vid hydration-switch
<ResponsiveAlertDialog open={!!state} onOpenChange={...}>

// RATT: villkorad rendering, mountar forst nar state ar truthy
{state && (
  <ResponsiveAlertDialog open={true} onOpenChange={...}>
    ...
  </ResponsiveAlertDialog>
)}
```

Grundorsak: `useIsMobile()` returnerar `false` vid SSR, sedan `true` pa mobil efter hydration. Bytet fran AlertDialog till Drawer (vaul) med `open={false}` kraschar nar DrawerContent forsöker montera i en inkomplett kontext. Villkorad rendering undviker problemet eftersom komponenten bara mountar nar den ska visas.

### Cancel-knapp behover explicit onClick pa mobil
Pa desktop stanger AlertDialogCancel dialogen automatiskt (Radix-beteende). Pa mobil ar det en vanlig Button -- den behover explicit `onClick` for att stanga:
```tsx
<ResponsiveAlertDialogCancel onClick={() => setState(null)}>
  Avbryt
</ResponsiveAlertDialogCancel>
```

## Larandeeffekt

**Nyckelinsikt:** Komponenter som byter mellan tva olika bibliotek (Radix AlertDialog vs vaul Drawer) baserat pa viewport bor ALDRIG alltid-monteras med `open={false}`. Kontextbytet vid hydration ar inte atomart ur vaul:s perspektiv. Anvand villkorad rendering sa att komponenten bara mountar nar den ska visas -- da sker ingen kontextswitch.
