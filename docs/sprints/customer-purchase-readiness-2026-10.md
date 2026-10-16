---
title: "Customer Purchase Readiness – oktober 2026"
description: "Gap-to-live-genomlysning inför skarpa kunder, riktiga personuppgifter och riktiga betalningar"
category: sprint
status: draft
last_updated: 2026-10-16
tags: [readiness, production, customer-journey, booking, payment]
sections:
  - Sprintmål
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
- Dubbelklick/retry är ett **känt potentiellt dubbeldebiteringsgap**:
  `StripePaymentGateway.initiatePayment` saknar idempotency key. R2 ska
  observera och dokumentera beteendet säkert (antal PaymentIntents, antal
  `Payment`-rader, slutstatus, vad kunden ser) i test mode och ska inte
  förutsätta ett visst utfall. Rapportera utfallet som fynd.
- Kontrollera serverstyrt belopp, ägarskap, betalningsstatus,
  webhook-signatur/deduplicering, bokningsstatus och vad båda parter ser.
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
- Kontrollera om livebetalningar kräver företagsverifiering, miljövariabler,
  domänkonfiguration, webhook, övervakning eller manuella rutiner som ännu
  saknas.
- Beskriv hur en betalningsincident upptäcks, ägs och hanteras.

### R4 – Beslut och åtgärdsplan

Klassificera resultatet:

- **READY** – en riktig kund kan köpa och betala med acceptabel risk.
- **READY WITH CONDITIONS** – flödet fungerar men namngivna villkor måste vara
  uppfyllda före eller under en begränsad pilot.
- **NOT READY** – blockerare gör att riktiga kunder inte bör släppas på.

Varje fynd ska ha allvarlighetsgrad, evidens, ägare och rekommenderad minsta
åtgärdsslice. Ingen fix startas i denna sprint utan nytt beslut.

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

- **Claude Code:** läser repots befintliga arkitektur, betalningskod, tester,
  konfiguration och CI samt dokumenterar tekniska bevis.
- **Codex:** granskar den faktiska kundresan och sammanför produkt-, UX-, drift-
  och affärsperspektivet till readiness-bedömningen.
- **Johan:** godkänner all interaktion som kan påverka produktion och fattar
  beslut om vilka åtgärdsslices som får starta.

Rollerna kan byta granskningsmaterial, men varje agent skriver bara i sin egen
överlämningsfil. Kanoniska slutsatser hamnar i sprintens slutrapport efter
granskning.

## Retro efter sprinten

Retron ska besvara två separata frågor:

1. Vad lärde vi oss om Equinets verkliga köp- och betalningsberedskap?
2. Gjorde överlämningsfilerna samarbetet tydligare utan att skapa dubbla
   sanningar eller extra administration?
