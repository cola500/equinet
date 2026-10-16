---
title: "Säljarmodell för betalningar (D1) – beslutsunderlag"
description: "Beslutsunderlag för vem som är säljare och hur betalningen ska flöda mellan kund, leverantör och Equinet innan livebetalningar får aktiveras"
category: architecture
status: draft
last_updated: 2026-10-16
tags: [payment, stripe, connect, marketplace, decision, d1]
depends_on:
  - docs/sprints/customer-purchase-readiness-2026-10.md
related:
  - docs/architecture/payment-production-readiness.md
  - docs/architecture/stripe-webhook-architecture.md
sections:
  - Syfte och nuläge
  - Preliminär arbetshypotes
  - Alternativ som ska jämföras
  - Ansvarsfrågor som måste beslutas
  - Extern verifiering
  - Beslutsgate
  - Arbete som får fortsätta parallellt
  - Källor
---

# Säljarmodell för betalningar (D1) – beslutsunderlag

> Dokumentet är ett **beslutsunderlag**, inte ett beslut. Det avgör inte
> juridik, moms eller val av Stripe-modell. Juridiska och skattemässiga
> punkter är frågor till sakkunnig.

## Syfte och nuläge

Syftet är att besluta vem som säljer tjänsten, hur pengarna flödar och vem som
bär vilket ansvar, innan Equinet tar emot riktiga betalningar.

Nuläge (verifierat i R3 i
[Customer Purchase Readiness](../sprints/customer-purchase-readiness-2026-10.md)):

- I nuvarande testimplementation skapas betalningen (PaymentIntent) direkt på
  **Equinets** Stripe-konto.
- Det finns ingen Stripe Connect, ingen utbetalning till leverantören och
  ingen definierad plattformsavgift.
- Kvittot anger samtidigt leverantörens företagsnamn, som om leverantören var
  säljare.

**Nuläget får inte användas för livebetalningar.**

## Preliminär arbetshypotes

> **Hypotes som kräver verifiering – inte ett juridiskt beslut.**

- Leverantören är juridisk säljare och utför tjänsten.
- Equinet förmedlar bokning och betalning och tar en avtalad plattformsavgift.

Hypotesen är ett utgångsläge för frågorna nedan. Den kan ändras av svaren från
jurist, redovisningskonsult och Stripe.

## Alternativ som ska jämföras

Ingen modell väljs i detta dokument. Uppgifterna nedan kommer från Stripes
dokumentation och beskriver hur Stripe hanterar flödet. De avgör inte vem som
är säljare i juridisk mening.

| Aspekt | Direct charges | Destination charges utan `on_behalf_of` | Destination charges med `on_behalf_of` |
|---|---|---|---|
| Var betalningen skapas | På leverantörens anslutna konto | På Equinets plattformskonto, del förs direkt över till leverantören | Som utan, men leverantören är "business of record" i Stripe-flödet |
| Pengaflöde | Hamnar i leverantörens saldo; plattformsavgift (application fee) till Equinet | Hamnar i plattformens saldo; det som stannar kvar motsvarar Equinets avgift | Som utan; avräkning sker i leverantörens land |
| Kundens kontoutdrag | Leverantörens statement descriptor | Equinets statement descriptor | Leverantörens statement descriptor (plattformens om uppgift saknas) |
| Stripe-avgifter | Plattformen väljer om de debiteras leverantören eller plattformen | Debiteras plattformen | Debiteras plattformen, enligt avgiftsstruktur för leverantörens land |
| Utbetalning till leverantör | Från leverantörens Stripe-saldo | Via överföring från plattformen | Via överföring; utbetalning enligt leverantörens inställning |
| Refunds | Dras från leverantörens saldo; blir `pending` om saldot inte räcker | Dras från plattformens saldo; plattformen kan återföra överföringen | Som utan |
| Disputes/chargebacks | Belopp dras från leverantörens saldo; avgiften kan läggas på plattform eller leverantör | Belopp och avgift dras från plattformens saldo; plattformen kan försöka återföra överföringen | Som utan |
| Ekonomiskt ansvar och risk | Främst hos leverantörens konto, men plattformen ansvarar enligt vald kontotyp och konfiguration | Plattformen bär refund- och tvistrisken i första hand | Som utan |
| Förutsättningar | Leverantören behöver kapaciteten `card_payments`; Stripe avråder från direct charges för äldre v1 Express/Custom-konton | Leverantören behöver kunna ta emot överföringar | Leverantören behöver `card_payments` för att dess descriptor ska användas |

Stripe beskriver direct charges som lämpligt när leverantören handlar direkt
med sina kunder, och destination charges när kunden handlar med plattformen
för tjänster som leverantören utför. Vilken beskrivning som passar Equinet
beror på den säljarmodell som beslutas.

## Ansvarsfrågor som måste beslutas

| Fråga | Behöver beslut om |
|---|---|
| Juridisk säljare | Vem kunden ingår avtal om tjänsten med |
| Moms på tjänsten | Vem som redovisar moms och med vilken sats |
| Moms på Equinets avgift | Hur plattformsavgiften faktureras och momsredovisas |
| Betalningsunderlag eller faktura | Vem som utfärdar kvitto, betalningsunderlag eller (förenklad) faktura, och med vilket innehåll |
| Reklamation | Vem som tar emot och avgör reklamation om tjänsten |
| Full och partiell återbetalning | Vem som godkänner, vem som bär kostnaden, hur avgiften hanteras |
| Chargebacks och tvister | Vem som svarar, vem som bär belopp och avgift |
| Negativt saldo | Hur negativt saldo hos leverantör hanteras och vem som till sist täcker det |
| Leverantörsverifiering och utbetalning | Krav på leverantörens identitet, företagsform och bankkonto innan utbetalning |

## Extern verifiering

**Frågor till Stripe**

- Vilken Connect-modell (laddningstyp och kontotyp) rekommenderar Stripe för
  svenska, självständiga tjänsteleverantörer som bokas via en plattform?
- Vilka krav gäller för leverantörernas onboarding (enskild firma eller
  aktiebolag) och utbetalning i Sverige?
- Hur fungerar Swish i respektive modell?

**Frågor till svensk jurist**

- Vilken avtalsstruktur (plattform–leverantör, plattform–kund) stödjer att
  leverantören är säljare, och vad krävs i villkoren?
- Innebär respektive betalningsflöde att Equinet tar emot medel för annans
  räkning på ett sätt som omfattas av betaltjänstregleringen, och gäller i så
  fall något undantag?
- Hur ska reklamation, återbetalning och konsumentens rättigheter fördelas
  mellan Equinet och leverantören?

**Frågor till redovisningskonsult**

- Hur ska moms på tjänsten och på Equinets avgift hanteras i vald modell?
- Vilket betalningsunderlag behöver privatkunden, och när krävs (förenklad)
  faktura?
- Hur ska Equinet bokföra och stämma av betalningar, avgifter, återbetalningar
  och tvister mot Stripe?

## Beslutsgate

- **D1 blockerar `READY` och alla livebetalningar.**
- Stripe får inte aktiveras i produktion förrän säljarmodell, ansvar, avtal och
  betalningsflöde är beslutade och verifierade.
- Readiness-sprintens R4 får ändå genomföras och avslutas.
- Om D1 fortfarande är olöst vid R4 ska slutklassningen vara **`NOT READY`
  för livebetalningar**.

## Arbete som får fortsätta parallellt

Får fortsätta oberoende av D1:

- R4-klassificering och prioritering.
- C1 – idempotent betalningsstart.
- C2–C3 – status- och tidsregler (`completed`).
- Testdataisolering (slices A och B).
- Betalningsövervakning och incident-runbook.
- UX-arbete som inte förutsätter en viss säljar- eller Connect-modell.

Får **förberedas men inte slutimplementeras** före D1:

- Kvitto och betalningsunderlag.
- Villkor och integritetspolicy (betalningsdelarna).
- Refund- och tvistansvar.
- Slutlig betalningsarkitektur.

## Källor

- [Stripe: How charges work in a Connect integration](https://docs.stripe.com/connect/charges)
- [Stripe: Statement descriptors for connected accounts](https://docs.stripe.com/connect/statement-descriptors)
- [Stripe: Build a marketplace](https://docs.stripe.com/connect/marketplace)
- [Skatteverket: Momslagens regler om fakturering](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momslagensregleromfakturering.4.58d555751259e4d66168000403.html)
- [Finansinspektionen: Betaltjänster](https://www.fi.se/sv/betalningar/sok-tillstand/betaltjanster/)
