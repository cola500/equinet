# Plan: Förberedelsechecklista + FAQ

## Bakgrund

- **Bokningsbekräftelse**: Ingen dedikerad bekräftelsesida finns. Efter bokning visas en toast och kunden redirectas till `/customer/bookings` där bokningar listas som kort.
- **FAQ**: Ingen FAQ-sida finns i appen. FAQ finns bara i extern dokumentation (`docs/ANVANDARDOKUMENTATION.md`).
- **Mål**: Visa förberedelsechecklista på bekräftade/väntande bokningar + ny FAQ-sida med samma innehåll, utan duplicering.

## Arkitekturbeslut

**Single source of truth**: En konstant-fil med checklistans data. En delad komponent som renderar den. Både bokningssidan och FAQ-sidan importerar samma komponent.

**Checklista visas på**: Uppkommande bokningar (både fixed-time och flexibla) med status `pending`/`confirmed`/`in_route` i `/customer/bookings`. Detta täcker kravet "right after booking creation" (kunden landar här) och "existing booking confirmation view".

**FAQ-sida**: Ny route `/customer/faq/page.tsx` med `CustomerLayout`. Länk läggs till i `CustomerNav`.

---

## Filer att skapa/ändra

### 1. SKAPA: `src/lib/preparation-checklist.ts`
Konstant med checklistans data:
```ts
export const PREPARATION_CHECKLIST = [
  "Lugn miljö",
  "Väl upplyst",
  "Plant underlag",
  "Ren och torr häst",
]
```

### 2. SKAPA: `src/components/booking/PreparationChecklist.tsx`
Delad komponent som renderar checklistan. Enkel design med shadcn Card-pattern + lucide-react ikon. Heading: "Inför besöket".

### 3. ÄNDRA: `src/app/customer/bookings/page.tsx`
Importera `PreparationChecklist` och visa den i bokningskort för uppkommande bokningar (pending/confirmed för fixed, pending/in_route för flexibla). Placeras efter booking details, före action buttons. Gäller båda bokningstyperna.

### 4. SKAPA: `src/app/customer/faq/page.tsx`
Minimal FAQ-sida med `CustomerLayout`. Innehåller minst en FAQ-entry:
- **Q**: "Vad behöver jag förbereda inför besöket?"
- **A**: Renderar `<PreparationChecklist />`

### 5. ÄNDRA: `src/components/layout/CustomerNav.tsx`
Lägg till `{ href: "/customer/faq", label: "Vanliga frågor" }` i `navItems`.

### 6. SKAPA: `src/components/booking/PreparationChecklist.test.tsx`
Komponenttest (Vitest + RTL):
- renders all 4 checklist items
- renders heading "Inför besöket"

### 7. UPPDATERA: `docs/ANVANDARDOKUMENTATION.md`
Lägg till FAQ-entry om förberedelser i befintlig FAQ-sektion.

---

## Verifiering

1. `npm run test:run` -- alla tester gröna
2. `npm run typecheck` -- inga TS-fel
3. Manuell verifiering: Starta dev-server, gå till `/customer/bookings`, se checklista på upcoming booking. Gå till `/customer/faq`, se FAQ med samma checklista.
