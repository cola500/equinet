# Retrospektiv: Offline-expansion -- cachning, mutationsköer och felhantering

**Datum:** 2026-03-01
**Scope:** Systematisk utökning av offline-stöd med fler cachebara endpoints, mutationsköer och vänlig felhantering

---

## Resultat

- 9 ändrade filer, 0 nya filer, 0 nya migrationer
- 3 nya tester (alla TDD, alla gröna)
- 2865 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Lib (offline) | `db.ts`, `offline-fetcher.ts` | Utökad entityType-union (5->11), +1 CACHEABLE_ENDPOINT, +2 CACHEABLE_PATTERNS |
| Lib (test) | `offline-fetcher.test.ts` | 3 nya tester för cachebara mönster |
| UI (routes) | `routes/[id]/page.tsx` | Konverterad från useEffect+fetch till useSWR med offline-cache |
| UI (bookings) | `bookings/page.tsx` | handleCancelBooking köar nu offline med optimisticUpdate |
| UI (calendar) | `calendar/page.tsx` | handleAvailabilitySave köar nu offline med optimisticUpdate |
| UI (due-for-service) | `due-for-service/page.tsx` | Konverterad från useEffect+fetch till useSWR med offline-cache |
| UI (horse-timeline) | `horse-timeline/[horseId]/page.tsx` | saveInterval/deleteInterval wrappade i guardMutation med offlineOptions |
| Hooks | `useProviderCustomers.ts` | 8 mutationer wrappade i guardMutation (blocking mode) |

## Vad gick bra

### 1. Planen var genomarbetad -- noll blockerare
Alla filer, radnummer och steg var specificerade i planen. Implementation tog ~15 minuter aktiv kodtid utan en enda blockering eller oväntad komplexitet.

### 2. Konsekvent mönsteranvändning
Alla offline-wrappningar följde exakt samma mönster som redan fanns i kodbasen (body FÖRE guardMutation, offlineOptions som andra argument). Ingen ny arkitektur behövde uppfinnas.

### 3. SWR-konverteringar var rena
Att byta från useEffect+fetch till useSWR krävde bara ~10 rader per sida och gav automatisk offline-cache via offlineAwareFetcher. Ingen annan logik behövde ändras.

### 4. Noll regressioner
2865 tester gröna, 0 typecheck-errors, 0 lint-errors. Trots att 9 filer ändrades (varav en stor hook med 450 rader) bröts inget.

## Vad kan förbättras

### 1. Kundmutationer blockeras istället för att köas
De 8 kundmutationerna i `useProviderCustomers.ts` blockeras offline med en toast istället för att köas. Planen motiverar detta med "komplexa beroenden" men i praktiken kunde åtminstone edit-operationer köas.

**Prioritet:** LÅG -- blocking mode ger bra UX jämfört med kryptiska nätverksfel, och köning kan läggas till inkrementellt.

## Patterns att spara

### useEffect+fetch till useSWR-konvertering
Mönster för att konvertera manuell datahämtning till SWR med offline-cache:

```diff
- const [data, setData] = useState(null)
- const [isLoading, setIsLoading] = useState(true)
- const [error, setError] = useState(null)
- useEffect(() => { fetchData() }, [deps])
+ const { data, isLoading, error, mutate } = useSWR(
+   condition ? `/api/endpoint` : null
+ )
```

Kräver: endpointen finns i `CACHEABLE_ENDPOINTS` eller `CACHEABLE_PATTERNS` i `offline-fetcher.ts`.

### guardMutation blocking mode
För mutationer med komplexa beroenden, wrappa i guardMutation utan offlineOptions:

```typescript
await guardMutation(async () => {
  // ... befintlig fetch-logik ...
})
```

Ger automatiskt vänlig "Du är offline"-toast istället för nätverksfel.

## Lärandeeffekt

**Nyckelinsikt:** När offline-infrastrukturen (offlineAwareFetcher, guardMutation, mutation queue) väl är på plats blir varje ny endpoint-/mutation-expansion en mekanisk operation -- inga arkitekturbeslut, bara mönsterreplikering. Investeringen i session 47-52 betalar sig nu i hastighet.
