# Retrospektiv: Offline race condition + navigeringsskydd

**Datum:** 2026-02-20
**Scope:** Fixa auth race condition och blockera offline-navigering i BottomTabBar/ProviderNav

---

## Resultat

- 4 andrade filer, 2 nya filer (+243/-10 rader)
- 10 nya tester (alla TDD, alla grona)
- 2131 totala tester (inga regressioner, upp fran 2063 i session 48 -- ovriga tester fran parallella branches)
- Typecheck = 0 errors, Lint = 0 errors
- Tid: ~1 session (snabb, tack vare tydlig plan och begransad scope)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Hooks | `useAuth.ts` | Borttagen auto-clear av sessionStorage (race condition fix) |
| Hooks | `useAuth.test.ts` | 2 uppdaterade tester (race condition + overwrite) |
| UI/Layout | `BottomTabBar.tsx` | Offline-navigeringsskydd med toast |
| UI/Layout | `BottomTabBar.test.tsx` | 5 nya tester (ny fil) |
| UI/Layout | `ProviderNav.tsx` | Offline-navigeringsskydd pa desktop-nav |
| UI/Layout | `ProviderNav.test.tsx` | 4 nya tester (ny fil) |

## Vad gick bra

### 1. Tydlig plan med rotorsaksanalys sparade tid
Planen identifierade exakt vilken kod som orsakade race condition (rad 38-45 i useAuth.ts) och varfor. Ingen utforskning behovdes -- rakt pa implementation. Total tid fran start till PR: ~15 minuter.

### 2. TDD fangade exakt ratt beteende
RED-fasen bekraftade att det befintliga testet (`should clear sessionStorage on explicit logout`) faktiskt testade det FELAKTIGA beteendet. Att vanda testet till "should NOT clear" och se det faila gav hog konfidensgrad att fixen var korrekt.

### 3. Befintlig useOnlineStatus-hook ateranvandes
Istallet for ny infrastruktur ateranvandes `useOnlineStatus` (fran session 47) och `toast` (fran sonner, redan i projektet). Minimal ny kod, maximal effekt.

### 4. BottomTabBar fick forsta testfilen
Komponenten hade ingen testfil alls. Nu har den 5 tester som ocksa dokumenterar offline-beteendet. Bra sidoeffekt av feature-arbete.

## Vad kan forbattras

### 1. Offline-navigeringsskydd saknas for CustomerLayout
BottomTabBar och ProviderNav har nu offline-skydd, men kundsidornas navigering (CustomerLayout/CustomerBottomTabBar) har inte samma skydd. En kund som navigerar offline far fortfarande RSC-krasch.

**Prioritet:** MEDEL -- kunder anvander troligen inte appen offline lika ofta som leverantorer, men det ar en inkonsekvent upplevelse.

### 2. Ingen E2E-verifiering av offline-navigering
Testerna ar unit-tester som mockar useOnlineStatus. Riktigt offline-beteende i webblasaren (SW + RSC + navigering) testas inte automatiskt. Manuell testplan i PR ar den enda verifieringen.

**Prioritet:** LAG -- E2E for offline ar svart att gora tillforlitligt (kraver network throttling + SW-registrering i Playwright).

## Patterns att spara

### Offline-navigeringsskydd i navigation-komponenter
```typescript
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { toast } from "sonner"

const isOnline = useOnlineStatus()

function handleOfflineClick(e: React.MouseEvent, href: string, matchPrefix?: string) {
  if (!isOnline && !isActive(href, matchPrefix)) {
    e.preventDefault()
    toast.error("Du ar offline. Navigering kraver internetanslutning.")
  }
}

// Pa varje Link:
<Link onClick={(e) => handleOfflineClick(e, href)} ... />
```

Nyckelinsikt: tillat klick pa AKTIV flik (ingen navigering sker). Blockera bara NARr `!isActive(href)`.

### Race condition-skydd: rensa inte cache vid "unauthenticated + online"
`useSession()` rapporterar `"unauthenticated"` ~2s FÖRE `navigator.onLine` ändras. Under den perioden är det omöjligt att skilja "nätverk nere" från "användaren loggade ut". Lösning: ta bort auto-clear helt. sessionStorage rensas automatiskt vid flik-stängning (webbläsarbeteende).

## 5 Whys (Root-Cause Analysis)

### Problem: Anvandare loggas ut vid offline
1. Varfor? sessionStorage-cachen rensas nar natverk gar ner.
2. Varfor? Koden kor `sessionStorage.removeItem()` nar `status === "unauthenticated" && isOnline`.
3. Varfor? useSession() rapporterar "unauthenticated" 2s fore navigator.onLine andras till false.
4. Varfor? NextAuth gor en HTTP-request till `/api/auth/session` som failar, och tolkar felet som "ingen session".
5. Varfor? Det finns ingen standard for hur webblasare ska synkronisera `navigator.onLine` med HTTP-fel -- det ar en race condition by design.

**Åtgärd:** Ta bort auto-clear. Lita på sessionStorage:s naturliga livscykel (rensas vid flik-stängning) och overwrite vid ny inloggning.
**Status:** Implementerad

### Problem: Navigering till annan flik kraschar offline
1. Varfor? Appen visar `/~offline` eller blank skarm vid klick pa flik.
2. Varfor? RSC-request till servern failar, SW har inte sidan cachad.
3. Varfor? SW cachar bara sidor som besokts online (runtime caching). Prefetch hamnar i separat cache.
4. Varfor? Next.js Link-prefetch anvander `rscPrefetch`-cache men navigering anvander `rsc`-cache -- tva separata caches.
5. Varfor? Next.js App Router ar designat for server-rendering, inte offline. SW kan inte bridga gapet mellan prefetch och navigering.

**Åtgärd:** Blockera navigering klient-side med `e.preventDefault()` + toast. Förhindra att RSC-requesten ens skickas.
**Status:** Implementerad (leverantör-sidor). Kund-sidor ej implementerade ännu.

## Larandeeffekt

**Nyckelinsikt:** Nar tva browser-APIs har olika tidslinje (useSession ~2s fore navigator.onLine) kan man INTE anvanda en kombination av dem for att dra slutsatser. "unauthenticated + online" betyder INTE "anvandaren loggade ut" -- det kan lika garna betyda "natverket precis gick ner". Losningen ar att undvika destruktiva operationer (cache-rensning) baserat pa ambiguosa signaler.
