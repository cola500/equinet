---
title: "Customer Purchase Readiness – oktober 2026"
description: "Gap-to-live-genomlysning inför skarpa kunder, riktiga personuppgifter och riktiga betalningar"
category: sprint
status: draft
last_updated: 2026-10-16
tags: [readiness, production, customer-journey, booking, payment]
sections:
  - Sprintmål
  - Beslutade affärsregler
  - Avgränsning och säkerhet
  - Perspektiv
  - Arbetsordning
  - Minsta verifieringsmatris
  - Definition of Done
  - Föreslagen rollfördelning under pilotförsöket
  - Retro efter sprinten
---

# Customer Purchase Readiness

## Sprintmål

Ta fram en evidensbaserad väg från dagens Customer Preview till readiness för
**skarpa kunder, riktiga personuppgifter och riktiga pengar**. Sprinten ska
besvara frågan:

> Kan en riktig hästägare i produktion hitta en relevant leverantör, förstå
> erbjudandet, boka rätt tjänst och genomföra en säker betalning – och kan
> leverantören därefter hantera bokningen och få korrekt betalningsstatus?

Utgångspunkten är att Equinet inte är live-redo i dag. Sprinten är en
gap-to-live-genomlysning, inte en implementation. Den ska verifiera nuläget,
kartlägga hela resan och därefter föreslå minsta möjliga åtgärdsslices.

## Beslutade affärsregler

- Equinets standardflöde är betalning **efter utförd tjänst**.
- Kunden ska kunna betala först när leverantören har markerat bokningen som
  `completed`. En bokning med status `pending` eller `confirmed` ska inte vara
  betalningsbar.
- Avbokning och återbetalning är separata processer. En bokning som avbokas
  innan betalning skapar normalt ingen betalning och därmed ingen
  återbetalning.
- Återbetalning gäller en redan genomförd betalning, exempelvis vid
  feldebitering, reklamation eller ett manuellt godkänt undantag.
- Eventuell avgift vid sen avbokning eller `no_show` är inte beslutad och får
  inte härledas ur det vanliga betalningsflödet. Det kräver ett separat
  produktbeslut.

R0 har identifierat att nuvarande kod tillåter betalning även vid
`confirmed`. Det är ett gap mot den beslutade affärsregeln och ska bedömas i
R4; ingen produktkod ändras inom genomlysningen.

## Avgränsning och säkerhet

- Produktion granskas i första hand read-only.
- Inga riktiga köp, återbetalningar eller ändringar av produktionsdata utan
  Johans uttryckliga godkännande och en dokumenterad testplan.
- Betalningens tekniska beteende verifieras först i säker testmiljö med
  officiella testbetalningsmetoder.
- Inga hemligheter, personuppgifter eller fullständiga betalningsuppgifter får
  hamna i screenshots, loggar eller sprintdokument.
- Nya fynd dokumenteras men utökar inte sprinten automatiskt.

## Perspektiv

Genomlysningen ska omfatta både kundens upplevelse och den bakomliggande
leveransförmågan:

1. **Upptäckt** – kan kunden hitta rätt typ av leverantör och förstå vem som
   erbjuder vad, var och till vilket pris?
2. **Förtroende** – framgår identitet, tillgänglighet, villkor, pris och vad som
   händer vid avbokning eller problem?
3. **Bokning** – kan kunden välja tjänst, tid, plats och eventuell häst utan
   blockerande eller motsägelsefulla steg?
4. **Betalning** – är rätt belopp serverstyrt, kan kunden slutföra betalningen,
   hanteras avbruten eller misslyckad betalning och undviks dubbeldebitering?
5. **Bekräftelse** – får kunden och leverantören en tydlig, konsekvent status
   efter bokning och betalning?
6. **Leverans och efterförlopp** – kan leverantören genomföra, avboka eller
   markera utebliven kund och blir återbetalning, kvitto och historik begripliga?
7. **Driftberedskap** – finns rätt miljökonfiguration, övervakning, supportväg,
   juridisk information och hantering av betalningsincidenter?

## Arbetsordning

### R0 – Förutsättningar och källor

- Läs befintlig arkitektur, betalningsdokumentation, backlogg och relevanta
  retrospektiv.
- Kontrollera vilken miljö som faktiskt är produktion och vilka betalningslägen
  som är aktiva, utan att exponera värden eller hemligheter.
- Rita den förväntade kundresan och markera vilka steg som kan verifieras
  read-only, i testmiljö respektive endast med mänskligt godkännande.

**Utfall:** verifieringsmatris och riskklassning innan något interaktivt test.

### R1 – Kundresan i produktion, read-only

- Granska landning, sökning, leverantörsprofil, tjänster, prisinformation,
  tillgänglighet och vägen fram till köpögonblicket.
- Kontrollera mobil och desktop samt centrala tom-, fel- och inloggningslägen.
- Dokumentera varje blockerare med reproduktionssteg och evidens.

**Stoppunkt:** presentera eventuella risker innan konto, bokning eller betalning
används i produktion.

### R2 – Boknings- och betalningskedjan i Stripe test mode på staging

- Kör hela användarflödet i staging med representativa fiktiva kund- och
  leverantörskonton, Stripes testnycklar och officiella testbetalningsmetoder.
- Använd den riktiga Stripe-integrationen i test mode/sandbox: Payment Element,
  PaymentIntent och testwebhook. Equinets interna `MockPaymentGateway` räknas
  inte som bevis för att Stripe-integrationen fungerar.
- Verifiera lyckad, avbruten och nekad betalning, 3D Secure samt
  dubbelklick/retry. Högvolyms- eller lasttesta inte mot Stripe.
- **Genomfört 2026-10-16** – resultat och slices under R4 ("Slices från R2").
  R2-testdatan städades samma dag enligt plan: stagingantalen är tillbaka på
  baslinjen och de två öppna test-intenterna är annullerade. De tre lyckade
  test-intenterna finns kvar i sandboxen, eftersom Stripe inte tillåter att
  de raderas.
- Dubbelklick/retry är ett **känt potentiellt dubbeldebiteringsgap**:
  `StripePaymentGateway.initiatePayment` saknar idempotency key. R2 ska
  observera och dokumentera beteendet säkert (antal PaymentIntents, antal
  `Payment`-rader, slutstatus, vad kunden ser) i test mode och ska inte
  förutsätta ett visst utfall. Rapportera utfallet som fynd.
- Kontrollera serverstyrt belopp, ägarskap, betalningsstatus,
  webhook-signatur/deduplicering, bokningsstatus och vad båda parter ser.
- Verifiera att betalning enligt målbilden endast blir tillgänglig efter
  `completed`; dokumentera dagens stöd för betalning vid `confirmed` som ett
  känt gap och inte som önskat beteende.
- Kontrollera att betalning inte kan lyckas med fel tjänst, belopp, kund eller
  leverantör.
- Automatiserade CI-tester ska normalt mocka Stripe-svar och felobjekt. R2 är
  ett avgränsat manuellt integrationskörpass, inte en återkommande browser-E2E
  mot Stripe.
- Testkort får inte användas med live-nycklar eller som test i produktion. En
  eventuell kontrollerad livebetalning och återbetalning är en separat
  go-live-aktivitet som kräver ett nytt uttryckligt godkännande.

**Utfall:** teknisk och visuell evidens från Stripe test mode utan riktiga
pengar, riktiga kunduppgifter eller andra känsliga data.

### R3 – Operativ och affärsmässig readiness

- Kontrollera villkor, integritet, avbokning, återbetalning, kvitto och tydlig
  supportväg ur kundens perspektiv.
- Kontrollera hur undantagsåterbetalning ska initieras, godkännas,
  kommuniceras och följas upp. Håll frågan om sen avboknings- eller
  `no_show`-avgift separat tills ett uttryckligt produktbeslut finns.
- Kontrollera om livebetalningar kräver företagsverifiering, miljövariabler,
  domänkonfiguration, webhook, övervakning eller manuella rutiner som ännu
  saknas.
- Beskriv hur en betalningsincident upptäcks, ägs och hanteras.

#### Marknadsjämförelse för betalningsmodell

Jämför Equinets målbild med etablerade tjänsteplattformar, med officiella
källor som underlag:

- Bokadirekt erbjuder flera val per tjänst: full förskottsbetalning,
  delbetalning/bokningsavgift eller kortuppgifter som garanti. Vid
  förskottsbetalning styr leverantörens avbokningspolicy om betalningen ska
  återgå.
- Fresha skiljer mellan slutbetalning efter tjänsten, deposition och sparade
  kortuppgifter för eventuell sen avboknings- eller `no_show`-avgift.

Bedöm tre separata modeller för Equinet:

1. **Tjänstebetalning:** betalning efter `completed` enligt beslutad grundregel.
2. **Bokningssäkring:** eventuell framtida deposition eller kortgaranti för
   vissa tjänster, kunder eller prisnivåer.
3. **Avboknings-/no-show-avgift:** separat, i förväg accepterad policy som inte
   får blandas ihop med betalningen för en utförd tjänst.

Jämförelsen ska väga kundtrygghet, leverantörens risk, administration,
reklamationer och refund-behov för mobila hästtjänster. Den får föreslå ett
senare experiment men ändrar inte grundregeln i denna sprint.

Källor:

- [Bokadirekt: Så fungerar onlinebetalning](https://business.bokadirekt.se/blogg/sa-fungerar-onlinebetalning-i-bokadirekt---steg-for-steg)
- [Bokadirekt: support om betalning och återbetalning](https://www.bokadirekt.se/support)
- [Fresha: Payment Policies](https://www.fresha.com/help-center/knowledge-base/payments/613-payments-policies-overview)
- [Fresha: Self Checkout efter besöket](https://www.fresha.com/help-center/knowledge-base/payments/101284-collect-payments-using-self-checkout)
- [Fresha: cancellation- och no-show-avgifter](https://www.fresha.com/help-center/knowledge-base/payments/617-charge-no-show-and-cancellation-fees)

### R4 – Beslut och åtgärdsplan

Klassificera resultatet:

- **READY** – en riktig kund kan köpa och betala med acceptabel risk.
- **READY WITH CONDITIONS** – flödet fungerar men namngivna villkor måste vara
  uppfyllda före eller under en begränsad pilot.
- **NOT READY** – blockerare gör att riktiga kunder inte bör släppas på.

Varje fynd ska ha allvarlighetsgrad, evidens, ägare och rekommenderad minsta
åtgärdsslice. Ingen fix startas i denna sprint utan nytt beslut.

#### Förberedda slices för produktionsidentiteter och testdata

R1 visar att produktion blandar riktiga identiteter med publikt synlig testdata.
R4 ska därför bedöma och prioritera två separata slices:

**Slice A – inventera och städa befintlig testdata i produktion**

- Inventera poster och relationer innan något ändras; klassificera dem som
  verkliga, syntetiska eller osäkra.
- Ta backup och besluta per post om den ska döljas, arkiveras eller raderas.
- Ta bort olämplig eller uppenbart intern testtext från publika kundytor.
- Exkludera syntetisk data från sökning, rekommendationer, rutter, statistik,
  utskick och ekonomisk rapportering.
- Ingen städning får ske utan separat plan, uttryckligt godkännande och
  verifierad återställningsväg.

**Slice B – isolerade syntetiska produktionsidentiteter**

- Separera Johans personliga adminidentitet från vanliga kundflöden och
  testbokningar. Administratörskonton ska vara personliga och använda minsta
  nödvändiga behörighet; ett separat nödkonto kan utredas senare.
- Skapa högst ett fiktivt kundkonto och ett fiktivt leverantörskonto för
  avgränsade produktionsrökprov. Full E2E ska fortsatt köras i staging.
- Klassificera kontona explicit i datamodellen, exempelvis som syntetiska och
  interna. Namn eller e-postmönster får inte vara enda skyddet.
- Leverantören ska vara `unlisted` och inte visas i publika sökresultat,
  rekommendationer, kartor eller rutter. Direkt intern åtkomst får utredas.
- Kontona får inte använda riktiga personuppgifter, skicka externa utskick,
  påverka analys/ekonomi eller genomföra riktiga betalningar.
- Skyddsreglerna ska testas så att kontona inte oavsiktligt blir publika eller
  betalningsbara när nya funktioner lanseras.

R4 ska ge varje slice allvarlighetsgrad, ägare, acceptanskriterier och ordning.
Den här sprinten beslutar planen men genomför inte städning eller kontoskapande.

#### Slices från R2 (betalningskedjan)

R2 kördes 2026-10-16 i staging med Stripe test mode: tre bokningar mellan
fiktiv kund och fiktiv leverantör, lyckad betalning med dubbelklick, avbruten
→ nekad → retry, samt 3D Secure. Evidens:
`docs/operations/e2e-runs/customer-purchase-readiness-r2-2026-10-16/`. Ingen
produktkod ändras i denna sprint; varje slice kräver eget beslut.

**C1 (P0) – En betalningsstart per bokning**

- *Problem:* Varje öppnad betaldialog skapar en ny PaymentIntent. R2 gav tre
  intents för samma bokning (övergiven, nekad, lyckad); de två öppna kunde
  fortfarande bekräftas → potentiell dubbeldebitering. `Payment`-raden pekar
  bara på den senaste intenten.
- *Önskat utfall:* Högst en bekräftningsbar intent per bokning och belopp.
- *Acceptanskriterier:* idempotent start (Stripe idempotency key eller
  återanvändning av befintlig öppen intent med samma belopp); tidigare öppen
  intent annulleras när en ny krävs; samtidiga anrop och retry efter nekat
  kort ger aldrig två bekräftningsbara intents; verifierat med test mot
  samtidiga anrop och i Stripe test mode.
- *Beroenden:* `StripePaymentGateway`, `PaymentService`, webhook-hantering av
  annullerade intents.

**C2 (P0) – Betalning först efter `completed`**

- *Problem:* UI visar "Betala" och API tillåter betalning vid `confirmed`
  (felmeddelandet för `pending` säger "måste vara bekräftad").
- *Önskat utfall:* Normal betalning möjlig endast vid `completed`, enligt
  beslutad affärsregel.
- *Acceptanskriterier:* API avvisar `pending` och `confirmed`; knappen visas
  inte för andra statusar än `completed`; felmeddelanden, hjälpartikel och
  testing-guide uppdaterade.
- *Beroenden:* C3 (annars kan `completed` sättas för tidigt).

**C3 (P0/P1) – `completed` före bokad sluttid**

- *Problem:* Leverantören kunde markera bokningen `completed` cirka tre timmar
  före bokad tid, utan bekräftelse.
- *Önskat utfall:* Förhindra, eller kräva uttrycklig bekräftelse, före bokad
  sluttid.
- *Acceptanskriterier:* statusbyte före sluttid blockeras eller kräver
  bekräftelse med tydlig text; beslutet är dokumenterat och testat i
  `BookingStatus`/`BookingService`.
- *Beroenden:* produktbeslut om förhindra vs bekräfta.

**C4 (P1) – Betalstatus synlig och aktuell för båda parter**

- *Problem:* Efter lyckad betalning låg "Betala" kvar hos kunden tills sidan
  laddades om; leverantörens bokningskort visar ingen betalstatus. Fliken
  "Kommande" visade inte dagens bokningar.
- *Acceptanskriterier:* kundvyn uppdateras efter bekräftad betalning utan
  manuell omladdning; leverantören ser obetald/betald/misslyckad per bokning;
  dagens bokningar visas under "Kommande".

**C5 (P1) – Information före bokning**

- *Problem:* Bokningsgranskningen visar pris och tid men inte när betalning
  sker, om priset inkluderar moms eller vilken avbokningsprincip som gäller.
- *Acceptanskriterier:* granskningssteget och tjänstekort anger "betalning
  efter utförd tjänst", momsuppgift och avbokningsprincip; texten matchar
  villkor och hjälpartikel.
- *Beroenden:* R3 (villkor, moms, avbokningspolicy).

**C6 (P1) – Betalningsnotiser och kvittokommunikation**

- *Problem:* Webhooken uppdaterar bara `Payment`; ingen
  `payment_received`-händelse skickas för Stripe-betalningar. Varken kund
  eller leverantör fick notis, push eller mejl efter tre lyckade betalningar.
- *Acceptanskriterier:* lyckad betalning via webhook ger kundkvitto och
  leverantörsnotis exakt en gång (även vid webhook-retry); misslyckad betalning
  ger begriplig kundinformation; kvittot uppfyller krav som fastställs i R3.

**C7 (P1) – Nekat kort och retry**

- *Problem:* Nekat kort visas som kortvarig toast och dialogen stängs; kunden
  måste öppna om och fylla i kortet igen (och skapar då en ny intent, se C1).
- *Acceptanskriterier:* felet visas i dialogen, kunden kan försöka igen utan
  att stänga den, och retry återanvänder samma intent.
- *Beroenden:* C1.

**Stängd hypotes – CSP blockerar 3D Secure**

R0 antog att 3DS skulle misslyckas eftersom CSP `frame-src` saknar
`https://hooks.stripe.com`. R2 motbevisade detta i Chrome: utmaningen laddas i
en ram inuti Stripes egen iframe och betalningen gick igenom. Hypotesen är
inte längre ett öppet blockerande gap.
`docs/architecture/payment-production-readiness.md` och backloggraden "3DS
Verification" är justerade i samma docs-slice. Kvar som ordinarie
go-live-kontroll är verifiering i fler webbläsare och med live-kort.

Mindre R2-observationer (prioriteras i R4 vid behov): Google Pay ger
`Permissions-Policy`-fel i konsolen, Apple Pay-domänen är inte registrerad,
3DS-sidan visar sandboxkontots namn i stället för Equinet.

## Minsta verifieringsmatris

| Område | Lyckat flöde | Viktiga avvikelser |
|---|---|---|
| Upptäckt | relevant leverantör och tjänst hittas | tomt resultat, fel plats, inaktiv tjänst |
| Bokning | giltig tid och rätt pris | tiden tas, session går ut, ogiltig input |
| Betalning | godkänd betalning | avbruten, nekad, retry, dubbelklick |
| Bekräftelse | samma status hos båda parter | webhook fördröjd eller misslyckad |
| Efterförlopp | korrekt genomförande/avbokning | återbetalning, utebliven kund, supportbehov |

## Definition of Done

- Hela kundresan är kartlagd från upptäckt till efterförlopp.
- Produktionsytan är granskad read-only och säkra interaktiva tester är
  genomförda i rätt miljö.
- Påståenden om betalning stöds av evidens; ej testade delar är tydligt märkta.
- Säkerhet, integritet, tillgänglighet och operativ hantering ingår i bedömningen.
- Ett entydigt READY-beslut med villkor och blockerare finns.
- Åtgärder är uppdelade i små, prioriterade slices men ingen implementation har
  smugit sig in i genomlysningen.
- Claude Code och Codex har använt sina överlämningsfiler och samarbetssättet har
  utvärderats i en kort retro.

## Föreslagen rollfördelning under pilotförsöket

- **Claude Code:** utför huvuddelen av sprintens avgränsade körpass, inklusive
  kod-, miljö- och visuella kontroller, och dokumenterar reproducerbar evidens.
- **Codex:** granskar Claudes underlag oberoende tillsammans med Johan,
  identifierar motsägelser och sammanför produkt-, UX-, drift- och
  affärsperspektivet till readiness-bedömningen.
- **Johan:** godkänner all interaktion som kan påverka produktion och fattar
  produktbeslut samt beslut om vilka åtgärdsslices som får starta.

Rollerna kan byta granskningsmaterial, men varje agent skriver bara i sin egen
överlämningsfil. Kanoniska slutsatser hamnar i sprintens slutrapport efter
granskning.

## Retro efter sprinten

Retron ska besvara två separata frågor:

1. Vad lärde vi oss om Equinets verkliga köp- och betalningsberedskap?
2. Gjorde överlämningsfilerna samarbetet tydligare utan att skapa dubbla
   sanningar eller extra administration?
