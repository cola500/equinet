---
title: "Equinet -- Historien"
description: "Resan från idé till plattform, berättad som hjältens resa"
category: guide
status: active
last_updated: 2026-04-04
tags: [story, history, decisions]
sections:
  - Den vanliga världen
  - Kallelsen
  - Tröskeln
  - Prövningar
  - Den innersta grottan
  - Belöningen
  - Vägen hem
---

# Equinet -- Historien

> En bokningsplattform för hästtjänster. Berättad som hjältens resa.

---

## I. Den vanliga världen

Det börjar med ett kalkylark.

Hovslagare, hästmassörer, veterinärer -- ambulerande yrkesfolk som kör mil efter mil
mellan gårdar, med bokningar i huvudet, på papperslappar, i meddelanden som försvinner
i en chatthistorik. Fakturor skrivs för hand. Dubbelbokningar upptäcks vid grinden.
Kunderna ringer, sms:ar, skickar röstmeddelanden. Ingen vet riktigt vad som är bekräftat.

Johan ser problemet på nära håll. 120 000 hästägare i Sverige. Tusentals leverantörer.
Ingen digital plattform som förstår deras vardag.

---

## II. Kallelsen

November 2025. En tom mapp. `npx create-next-app equinet`.

Stacken väljs: Next.js, TypeScript, Prisma, Supabase. Inte för att det är trendigt
utan för att det är det enklaste sättet att bygga en fullstack-app som en person kan
underhålla. shadcn/ui för komponenterna. Svenska i gränssnittet, engelska i koden.

NextAuth v5 beta väljs för inloggning. Det är den snabbaste vägen till ett fungerande
loginflöde. Lösenorden hashas med bcrypt, sessioner lagras i cookies. Det fungerar.
"Vi kan alltid byta senare."

De första modellerna tar form i Prisma: Provider, Customer, Booking, Service, Horse.
Kärndomänerna i en värld av hovar och ridstigar.

---

## III. Tröskeln

Första testet skrivs. Sedan det andra. Sedan en regel: *tester först, alltid*.

TDD blir inte bara en metod utan en kompass. Rött test = vi vet vad vi bygger.
Grönt test = vi vet att det fungerar. Det känns långsamt i början. Det sparar dagar
senare.

DDD-Light introduceras som arkitektur. Inte den akademiska varianten med aggregat
och event sourcing, utan den pragmatiska: domain services för affärslogik,
repositories för kärndomäner, Prisma direkt för enkel CRUD. Lagom mycket struktur.

En iOS-app behövs. Inte om sex månader -- nu. Lösningen: en WKWebView-wrapper i
Swift. Webbappen i en native skal. Bridge-protokoll för push, offline, haptics.
Det tar en vecka att bygga. Det ser ut som en app. Det *känns* nästan som en app.

---

## IV. Prövningar, allierade och fiender

### Fienden: Komplexitet

Januari 2026. Kodbasen växer. 47 API-routes. `console.log` överallt. Ingen
strukturerad loggning. Ingen rate limiting. Select-block som drar hela tabeller.

En teknisk genomlysning avslöjar sanningen: koden fungerar, men den skalar inte.
Inte tekniskt -- organisatoriskt. Varje ny feature kräver att man håller fler saker
i huvudet.

**Motdraget:** Batchvis refaktorering. 47 routes migreras till rollbaserad auth.
18 routes wrappas i `withApiHandler` -- 886 rader försvinner. `console.log` ersätts
med strukturerad loggning i 69 filer. Allt utan en enda regression.

Lärdomen etsar sig fast: *analys före implementation*. Förstå problemet innan du
löser det.

### Alliansen: Claude som teammedlem

Claude är inte bara ett verktyg. Claude blir Dev -- en fullstack-utvecklare som
skriver tester först, följer kodstandarder och lämnar pull requests.

Men alliansen kräver disciplin. Claude gissar ibland. Säger "allt klart" när filer
ligger uncommittade. Flaggar falska säkerhetslarm. Parallella sessioner kraschar
på delade filer.

**6 iterationer** på en enda session för att hitta rätt arbetsflöde. Parallella
sessioner? Krockar. Push direkt till main? Ingen review. Dev utan plan? Fel sak
byggs.

Varje iteration gör teamet lite bättre. Roller formaliseras: Lead granskar, Dev
implementerar, Johan beslutar om produkt. Planer committas före implementation.
Status-filen uppdateras vid varje commit. Stopp-regler som aldrig bryts.

### Fienden: Offline

Februari 2026. "Leverantörer kör i områden utan täckning. Appen måste fungera offline."

Det låter enkelt. Cache:a data lokalt, synka när nätet kommer tillbaka.

Det tar åtta sessioner.

iOS Safari skickar falska online-events. `navigator.onLine` ljuger. Två tabbar
som synkar samtidigt korrumperar data. IndexedDB-kvoten tar slut utan varning.
Reconnect triggar en lavin av requests som DDos:ar den egna servern.

Varje session avslöjar nya monster: thundering herd, TOCTOU-race, zombie-tabs.

**Motdragen:** Circuit breaker efter 3 misslyckade synkförsök. Exponentiell
backoff med jitter. Probe-requests som testar anslutningen innan fullskalig
synk. Tab-koordinering med BroadcastChannel och 5-minuters timeout.
`guardMutation` som fångar nätverksfel och faller tillbaka till offline-kö.

Offline feature-flaggas till slut. Default: av. Grundflödet tog 20% av tiden.
Edge cases tog 80%.

*Lärdom: Offline är inte en feature. Det är en dimension.*

---

## V. Den innersta grottan

Mars 2026. iOS-appen ser ut som en webbsida i en ram. Det fungerar, men det
*känns* inte rätt. Scrollningen är lite trög. Knapparna lite för små. Animationerna
saknas.

Beslutet: native-first rebuild. Skärm för skärm, WebView till SwiftUI.

Dashboard först. Det ser bra ut i SwiftUI. Men vid granskning: tre datapunkter
saknas som fanns i webbversionen. En navigeringslänk bortglömd. En statusikon
som aldrig implementerades.

Svaret blir ett obligatorium som aldrig bryts igen: **Feature Inventory**.
Innan en enda rad SwiftUI skrivs, läs webbkomponentens varje rad. Lista varje
datapunkt, varje klick, varje dialog. Tabell med beslut: Native, Offload till
WebView, Skip, Later. Tabellen granskas innan implementation.

10 av 16 skärmar konverteras till native SwiftUI. Dashboard, bokningar, kunder,
tjänster, recensioner, profil, kalender, mer-fliken. Swift Charts för
business insights. Heatmap för bokningsbelastning.

De återstående 6 offloadas medvetet till WebView. Inte för att vi inte kan --
utan för att native-konvertering inte ger tillräckligt värde för de skärmarna.

---

## VI. Prövningen

April 2026. Auth-migreringen.

Det som började som "vi kan alltid byta senare" har blivit tre separata
auth-system i samma kodbas:

1. **NextAuth v5 beta** -- sessions i cookies, 60+ routes
2. **MobileTokenService** -- custom JWT för iOS, 500 rader egen kod
3. **Supabase** -- redan i stacken för databas, men inte för auth

Tre system. Tre sätt att verifiera "vem är du?". Tre ställen där
säkerhetsbuggar kan gömma sig.

Dessutom: Row Level Security. Databasen ska skydda sig själv, inte lita på
att varje API-route har rätt WHERE-klausul. Men RLS kräver att databasen
vet vem som frågar.

**Första försöket:** Prisma + `set_config()`. Sätt providerId i varje
request, låt RLS-policies läsa det. Fungerar lokalt. Supabase pooler
(PgBouncer i transaction mode) blockerar `SET ROLE`. Vägen framåt är stängd.

**Andra försöket:** Stärk app-lagret medan vi tänker.
`findByIdForProvider(id, providerId)` med atomisk WHERE i alla repositories.
Ownership guards som inte går att glömma bort.

**Tredje försöket -- det rätta:** Supabase Auth. En spike bevisar kedjan:
`signInWithPassword` -> custom PL/pgSQL hook som lägger `providerId` i JWT ->
RLS-policy som läser `auth.jwt()`. Provider ser bara sina bokningar. Anon
blockeras helt.

Men 60+ routes kan inte skrivas om på en dag.

**Lösningen:** `getAuthUser()` -- en dual-auth helper som provar
Bearer -> NextAuth -> Supabase. Migrering utan big bang. `withApiHandler`
ändras EN gång och ger dual-auth till 28 routes automatiskt.

iOS behöver en egen lösning. WKWebView kan inte hantera Supabase:s
chunked cookies. Svaret: en server-side PKCE exchange endpoint.
iOS loggar in via Supabase Swift SDK, skickar token till servern,
servern sätter rätt cookies för WebView.

Det är den största enskilda migreringen i projektets historia.

---

## VII. Belöningen

Siffrorna berättar en del av historien:

- **3 939 tester**, alla gröna
- **373 E2E-specifikationer** som passerar
- **223 iOS-tester** (XCTest)
- **0 lint-varningar** sedan session 66
- **60+ API-routes** med auth, rate limiting, Zod-validering
- **14 feature flags** som styr varje ny funktion
- **10 native SwiftUI-skärmar** av 16

Men den verkliga belöningen är något annat.

Det är en kodbas där en ny funktion kan byggas på en session. Där tester
fångar regressioner innan de når produktion. Där en spike på 30 minuter
sparar veckor av felaktig implementation. Där en plattform för hästtjänster
faktiskt kan växa.

---

## VIII. Vägen hem

Equinet är inte färdigt. Det är aldrig färdigt.

NextAuth håller på att tas bort. RLS ska rulla ut till alla kärndomäner.
Riktiga betalningar med Stripe väntar på företagsverifiering. Push-notiser
väntar på ett Apple Developer-konto.

Men grunden finns. Arkitekturen bär. Testerna skyddar. Processen fungerar.

Och principen som vuxit fram genom varje kurskorrigering, varje spike,
varje misslyckad ansats som ledde till en bättre lösning:

***Spika tidigt. Migrera gradvis. Feature-flagga allt.***

---

> *"Varje stor kurskorrigering kom från att vi testade antaganden
> i en spike istället för att bygga på gissningar."*
>
> -- Ur beslutsloggen, april 2026
