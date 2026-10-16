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

#### R3-resultat (2026-10-16)

Underlag: kod och dokument på `main`, R0–R2 samt officiella källor. Inga
miljö-, Stripe- eller dataändringar. Juridiska bedömningar nedan är frågor som
måste verifieras av sakkunnig, inte slutsatser.

**1. Kundens villkor, kvitto och supportväg**

| Område | Nuläge | Bedömning |
|---|---|---|
| Användarvillkor och integritetspolicy | Platshållare för företagsnamn, org.nr, adress och e-post; senast uppdaterade 2026-02-15; inget om betalning, moms eller återbetalning (R1) | Blockerare för skarpa kunder |
| Avbokning | Villkoren anger 24 h eller leverantörens regler, men koden saknar avbokningsgräns för kunden och leverantörer kan inte ange egna avbokningsregler | Villkor och kod motsäger varandra |
| Återbetalning | Ingen refund-kod, inget adminverktyg, webhooken hanterar inte refund eller tvist (`charge.dispute.*`) | Blockerare: undantagsrefund kräver manuell Stripe-hantering utan spårbarhet i Equinet |
| Kvitto | HTML-kvitto med företagsnamn, tjänst, datum och belopp; ingen moms, inget org.nr eller momsregistreringsnummer | Två skilda frågor. (a) *Betalningsunderlag till privatkund:* kunden behöver ett begripligt kvitto, men en faktura krävs inte i alla fall. Vad underlaget minst ska innehålla beror på säljarmodellen (D1) och behöver verifieras. (b) *Förenklad faktura:* om en faktura utfärdas eller krävs, t.ex. när köparen är näringsidkare, ska även en förenklad faktura (högst 4 000 kr inkl. moms) innehålla säljarens identitetsnummer och moms. Det nuvarande kvittot uppfyller inte de kraven |
| Supportväg | Ingen kontaktväg i villkoren; `support@equinet.se` finns bara i en felkomponent; meddelanden till leverantör finns | Otydlig ägare för betalningsfrågor |

**2. Vem säljer och vem tar emot pengarna (ny huvudfråga)**

Betalningen skapas direkt på Equinets Stripe-konto. Det finns ingen Stripe
Connect, ingen överföring till leverantören och ingen plattformsavgift. Kvittot
anger leverantörens företagsnamn som om leverantören var säljaren. Det innebär
att:

- Equinet i praktiken tar emot betalning för leverantörens tjänst utan
  automatisk väg att betala ut till leverantören.
- Det är oklart vem som är säljare (merchant of record) och vem som ska utfärda
  kvitto eller faktura och redovisa moms.
- Att ta emot pengar för annans räkning kan kräva tillstånd som
  betaltjänstleverantör, om inget undantag gäller. **Juridisk fråga för
  Johan och sakkunnig**, inte en slutsats.
- Stripe beskriver Connect som stöd för marknadsplatser, med flera
  laddningstyper (bland annat direct charges och destination charges) för
  avgift, utbetalning och refund. `on_behalf_of` styr vilken part som är
  "business of record" i Stripe-flödet, till exempel kontoutdragstext och
  avräkning. Det avgör inte ensamt vem som juridiskt är säljare eller
  merchant of record, eftersom det också följer av avtal, villkor och
  momsredovisning.

**3. Undantagsåterbetalning (föreslagen process, ej implementerad)**

1. *Initiering:* kund via support eller leverantör via meddelande; orsak
   (feldebitering, reklamation, godkänt undantag) registreras.
2. *Godkännande:* leverantören godkänner reklamation om sin tjänst; Equinet
   godkänner feldebitering. Belopp ≤ betalt belopp, och delrefund tillåts.
3. *Utförande:* refund via Stripe på den lyckade PaymentIntent; Equinet
   uppdaterar `Payment.status` (`refunded`/delvis) via webhook, med
   idempotens.
4. *Kommunikation:* kund och leverantör får besked, och kvittot eller en
   kreditnota uppdateras.
5. *Uppföljning:* revisionslogg (vem, när, varför) och månatlig avstämning mot
   Stripe.

Detta förutsätter att frågan i punkt 2 är löst, eftersom vem som bär
refund-kostnaden beror på säljarmodellen.

**4. Förutsättningar för livebetalningar**

| Krav | Status |
|---|---|
| Stripe företagsverifiering (live-konto) | Ej verifierbar: endast sandbox syns via anslutningen. Dokumenterad blockerare |
| Prod-env | `PAYMENT_PROVIDER=mock`, `stripe_payments` av, Stripe-nycklar är testnycklar, `STRIPE_WEBHOOK_SECRET` saknas (R0) |
| Webhook i live-läge | Ingen live-endpoint kunde verifieras; testendpointen prenumererar inte på refund- eller tvistevent |
| Domän / wallets | Apple Pay-domänen är inte registrerad. R2 observerade ett `Permissions-Policy`-fel från Google Pay i konsolen; om Google Pay faktiskt är tillgängligt för kunden är inte verifierat |
| Env-guard | `check-prod-env` kräver Stripe-variabler när `PAYMENT_PROVIDER=stripe` |
| Övervakning | Sentry-DSN finns i prod, men `logger` skickar inte fel till Sentry; Betterstack och Stripe-mejllarm är dokumenterade men inte verifierade |
| GDPR | Stripe som personuppgiftsbiträde: DPA och dataplats inte verifierade; bolagsuppgifter saknas |
| Manuella rutiner | Ingen dokumenterad avstämning, refund, tvist eller utbetalning till leverantör |

**5. Betalningsincidenter: upptäckt, ägarskap och hantering**

- *Nuläge:* incident-runbookens Stripe-avsnitt beskriver
  prenumerationswebhooks. Det saknas avsnitt för misslyckade kundbetalningar,
  dubbeldebitering, utebliven webhook, refund och tvist. Inget larm fångar
  fel i `/api/webhooks/stripe`.
- *Föreslaget:* Johan är ägare tills annat beslutas. Upptäckt sker via
  Stripe-mejllarm för misslyckade webhook-leveranser, fel som rapporteras till
  Sentry från webhook- och betalningsrouter, samt daglig avstämning av
  `Payment` mot Stripe (status och antal öppna PaymentIntents). Åtgärder står i
  en runbook-sektion per incidenttyp. Kunden får besked inom en bestämd tid.

**6. Marknadsjämförelse**

| Plattform | Modell enligt officiella källor |
|---|---|
| Bokadirekt | Per tjänst: full förskottsbetalning, delbetalning/bokningsavgift eller kortgaranti. Leverantören väljer avbokningspolicy (t.ex. full återbetalning vid avbokning senast 24 h före). Hur salongen får utbetalning framgår inte av källan. Faktura för t.ex. uteblivet besök skickas via Billogram |
| Fresha | Deposition, sparat kort (no-show-skydd) och valfri full förskottsbetalning. Self checkout-länk efter besöket (giltig 48 h). Avgifter får inte överstiga överenskommen policy, och no-show-avgift kan inte återföras |

Bedömning för mobila hästtjänster:

1. *Tjänstebetalning efter `completed`* (grundregeln) passar bäst. Priset kan
   ändras på plats (fler hovar, akut åtgärd), kunden betalar för något
   utfört, och refund-behovet blir litet. Risken ligger hos leverantören vid
   utebliven betalning. Fresha har motsvarande flöde med self checkout.
2. *Bokningssäkring* (deposition eller kortgaranti) bör bara prövas för
   dyra tjänster, långa resor eller nya kunder. Det kräver sparade kort
   (Stripe SetupIntent) och tydligt samtycke, och ökar refund-ansvaret.
3. *Avboknings- och no-show-avgift* måste vara en separat, i förväg
   accepterad policy med tak (som hos Fresha) och får inte blandas ihop med
   tjänstebetalningen. Det kräver eget produktbeslut.

Förslag till senare experiment, utanför denna sprint: kortgaranti för
akutbesök hos en pilotleverantör, när C1–C3 och säljarmodellen är lösta.

**7. Kandidater till R4 från R3**

- **D1 (P0):** säljarmodell och betalflöde. Besluta först säljarmodellen:
  juridisk säljare, kvitto- och momsansvar, utbetalning och avgift, samt en
  juridisk bedömning av betaltjänstfrågan. Jämför sedan direct charges och
  destination charges, med eller utan `on_behalf_of`, utifrån den beslutade
  modellen. Ingen laddningstyp väljs innan säljarmodellen är beslutad.
- **D2 (P0):** fullständiga villkor och integritetspolicy med bolagsuppgifter,
  betalning, avbokning, återbetalning och supportväg. Villkor och kod ska
  stämma överens.
- **D3 (P0/P1):** betalningsunderlag till privatkund, plus förenklad faktura
  i de fall faktura utfärdas eller krävs. Innehållet följer säljarmodellen i
  D1 och verifieras mot Skatteverkets krav.
- **D4 (P1):** refund- och tvistprocess med verktyg, webhook-event och
  revisionslogg.
- **D5 (P1):** betalningsövervakning och runbook: Sentry-integration, larm och
  avstämning.

Källor (utöver dem ovan):
[Skatteverket: momslagens regler om fakturering](https://www.skatteverket.se/4.58d555751259e4d66168000403.html),
[Finansinspektionen: betaltjänster](https://www.fi.se/sv/betalningar/sok-tillstand/betaltjanster/),
[Stripe: build a marketplace](https://docs.stripe.com/connect/marketplace),
[Stripe: Connect charge types](https://docs.stripe.com/connect/charges).

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
