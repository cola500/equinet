---
title: "Affärsregler – bokning och betalning"
description: "Teknikoberoende affärsregler för när en bokning blir utförd och när, av vem och hur många gånger den får betalas (pilot)"
category: architecture
status: draft
last_updated: 2026-10-23
tags: [specification, business-rules, booking, payment, pilot]
depends_on:
  - docs/specifications/README.md
related:
  - docs/specifications/contracts/booking-payment-scenarios.md
  - docs/specifications/traceability/booking-payment-matrix.md
  - docs/sprints/customer-purchase-readiness-2026-10.md
  - docs/retrospectives/2026-10-16-customer-purchase-readiness-retro.md
sections:
  - Översikt
  - BR-BOOK-001 Utförd tidigast vid bokad sluttid
  - BR-PAY-001 Betalning först när bokningen är utförd
  - BR-PAY-002 Kunden betalar bara sin egen bokning
  - BR-PAY-003 Högst ett slutförbart betalningsförsök
  - Öppna frågor
  - Lösta frågor
  - Utanför piloten
---

# Affärsregler – bokning och betalning

## Översikt

| ID | Regel (kort) | Status |
|---|---|---|
| BR-BOOK-001 | En bokning får inte markeras som utförd före bokad sluttid | beslutad |
| BR-PAY-001 | Betalning får bara ske när bokningen är utförd | beslutad |
| BR-PAY-002 | Kunden får bara betala sin egen bokning | beslutad |
| BR-PAY-003 | Högst ett slutförbart betalningsförsök per bokning och belopp | beslutad |

Begrepp som används nedan:

- **Utförd** – leverantören har markerat besöket som genomfört (`completed`).
- **Bokad sluttid** – den sluttid som kund och leverantör kom överens om vid
  bokningen.
- **Betalningsförsök** – en påbörjad betalning som kunden kan slutföra, t.ex.
  genom att ange kortuppgifter och bekräfta.

---

## BR-BOOK-001 Utförd tidigast vid bokad sluttid

**Regel:** En bokning får inte markeras som utförd före bokad sluttid. Den
får markeras utförd när Equinets aktuella tid är lika med eller senare än
bokningens sluttid.

Tidsbestämning `[beslut]`:

- Equinets serverklocka avgör vad klockan är, inte användarens enhet.
- Sluttiden tolkas i bokningens tidszon, i dag svensk tid
  (`Europe/Stockholm`), inklusive sommartid.
- Vid offline-synk gäller tiden när servern tar emot statusbytet, inte tiden
  när användaren tryckte.

| Fält | Innehåll |
|---|---|
| Status | beslutad |
| Motiv | Betalning blir möjlig när bokningen är utförd (BR-PAY-001). Om bokningen kan markeras utförd i förväg kan kunden betala för något som ännu inte har hänt. |
| Beslutade undantag | Inga i första versionen. En framtida möjlighet att markera tidigare ska vara behörighetsstyrd, motiverad och loggad; den är beslutad som princip men ingår inte nu. `[beslut]` |
| Beslutsdatum | 2026-10-16 (regeln), 2026-10-23 (tidsbestämning och exakt sluttid) |
| Källa | Johan, readiness-retron (Beslut 3 och 4) och C3 i sprintdokumentet; Johans beslut i specifikationspiloten 2026-10-23 (svar på Q-BOOK-001 och Q-BOOK-002) `[beslut]` |
| Scenarier | SC-BOOK-001 – SC-BOOK-008 |

**Lineage**

| Datum | Ändring | Varför | Källa |
|---|---|---|---|
| före 2026-10-16 | Ingen tidsregel. En bekräftad bokning kunde markeras utförd när som helst. | Implicit beteende, inget dokumenterat beslut hittat. | Nuvarande kod `[läst]` |
| 2026-10-16 | R2 observerade att en bokning markerades utförd cirka tre timmar före bokad tid. | Testpass i staging. | Sprintdokumentet, C3 `[läst]` |
| 2026-10-16 | Regeln infördes: inte före bokad sluttid; override senare och inte i första versionen. | Skydda betalningsregeln och kundens förtroende. | Retro, Beslut 3–4 `[beslut]` |
| 2026-10-23 | Q-BOOK-001 löst: serverns klocka, bokningens tidszon, mottagningstid vid offline-synk. | Specifikationspiloten visade att gränsen annars kan bli fel med en till två timmar och att offline-markeringar kan tolkas olika. | Johans beslut i specifikationspiloten `[beslut]` |
| 2026-10-23 | Q-BOOK-002 löst: markering exakt vid sluttid är tillåten. | Ordalydelsen "inte före" behövde bekräftas för gränsfallet. | Johans beslut i specifikationspiloten `[beslut]` |

---

## BR-PAY-001 Betalning först när bokningen är utförd

**Regel:** Kunden får betala för en bokad tjänst först när bokningen är
utförd. En bokning som väntar på bekräftelse, är bekräftad, avbokad eller
markerad som utebliven kund är inte betalningsbar.

| Fält | Innehåll |
|---|---|
| Status | beslutad |
| Motiv | Equinets standardflöde är betalning efter utförd tjänst. Priset kan ändras på plats, kunden betalar för något utfört och behovet av återbetalning blir litet. |
| Beslutade undantag | Inga. En avgift vid sen avbokning eller utebliven kund är **inte** ett undantag från denna regel utan en separat, obeslutad process som inte får härledas ur betalningsflödet. `[beslut]` |
| Beslutsdatum | Dokumenterad som beslutad affärsregel 2026-10-16. Ursprungligt beslutstillfälle hittas inte i källorna (Q-PAY-005). |
| Källa | Sprintdokumentet, "Beslutade affärsregler" och C2; motiv från R3 §6 `[beslut]` |
| Beror på | BR-BOOK-001. Utan den kan "utförd" sättas för tidigt. |
| Scenarier | SC-PAY-001 – SC-PAY-006 |

**Lineage**

| Datum | Ändring | Varför | Källa |
|---|---|---|---|
| 2026-01-27 | Betalning (mock) tilläts för bekräftade och utförda bokningar. | Demoflöde; inget produktbeslut om tidpunkt hittat. | Commit `e16eecba` `[läst]` |
| 2026-02-28 | Arkitekturdokumentet beskriver "endast confirmed/completed kan betalas". | Dokumenterade dåvarande kod. | `docs/architecture/booking-flow.md` `[läst]` |
| 2026-10-16 | Regeln skärptes: endast utförd bokning är betalningsbar. Dagens stöd för bekräftad bokning klassas som gap. | Betalning efter utförd tjänst är standardflödet. | Sprintdokumentet, R0 och C2 `[beslut]` |

**Motsägelse:** `booking-flow.md` beskriver fortfarande det äldre beteendet.
Det uttryckliga beslutet från 2026-10-16 har företräde. Dokumentet bör
justeras när C2 genomförs.

---

## BR-PAY-002 Kunden betalar bara sin egen bokning

**Regel:** Bara den kund som bokningen gäller får starta eller genomföra
betalningen. Ingen annan användare – annan kund, leverantör, familjemedlem
eller stallägare – får starta eller slutföra en betalning för bokningen.

| Fält | Innehåll |
|---|---|
| Status | beslutad |
| Motiv | Skydda kunder mot att någon annan påverkar eller ser deras bokning och betalning. `[tolkning]` – motivet är inte uttryckligen angivet i beslutet. |
| Beslutade undantag | Inga. Betalning via familjemedlem, stallägare eller annat ombud är uttryckligen inte ett undantag. `[beslut]` |
| Beslutsdatum | 2026-10-23 |
| Källa | Johans beslut i specifikationspiloten 2026-10-23 (svar på Q-PAY-001) `[beslut]`. Tidigare underlag: säkerhetschecklista i `booking-flow.md` `[läst]`; R2 observerade att API:t avvisar betalning av annan kunds bokning `[läst]` |
| Scenarier | SC-PAY-010 – SC-PAY-013 |

**Lineage**

| Datum | Ändring | Varför | Källa |
|---|---|---|---|
| 2026-01/02 | Ägarskapskontroll vid betalning dokumenterad som säkerhetskrav. | Skydd mot åtkomst till andras bokningar. | `booking-flow.md` `[läst]` |
| 2026-10-16 | Verifierad i Stripe test mode. | R2. | Sprintdokumentet, R4-beslut `[läst]` |
| 2026-10-23 | Formulerad som föreslagen affärsregel i piloten; Q-PAY-001 ställd om ombud. | Inget uttryckligt produktbeslut fanns. | Specifikationspilotens första utkast |
| 2026-10-23 | Beslutad. Q-PAY-001 löst: inga ombud – familjemedlem eller stallägare är inget undantag. | Bekräfta regeln som produktbeslut och stänga frågan om ombud. | Johans beslut i specifikationspiloten `[beslut]` |

---

## BR-PAY-003 Högst ett slutförbart betalningsförsök

**Regel:** För en bokning får det finnas högst ett betalningsförsök åt gången
som kan slutföras, och det gäller det aktuella beloppet. När ett nytt försök
behövs får det tidigare inte längre gå att slutföra. `[beslut]`

Ursprunglig, teknisk formulering i C1: "Högst en bekräftningsbar intent per
bokning och belopp."

| Fält | Innehåll |
|---|---|
| Status | beslutad |
| Motiv | Flera öppna betalningsförsök för samma bokning kan leda till dubbeldebitering. R2 gav tre försök för samma bokning, varav två fortfarande kunde slutföras. |
| Beslutade undantag | Inga. |
| Beslutsdatum | 2026-10-16 (önskat utfall), 2026-10-23 (teknikoberoende formulering) |
| Källa | Sprintdokumentet, C1 (önskat utfall och acceptanskriterier) i R4-beslutet `[beslut]`; R2 fall 2 `[läst]`; Johans godkännande av formuleringen i specifikationspiloten `[beslut]` |
| Scenarier | SC-PAY-020 – SC-PAY-026 |

**Lineage**

| Datum | Ändring | Varför | Källa |
|---|---|---|---|
| 2026-06-06 | Saknad idempotens noterad som backloggpunkt ("Stripe Idempotency Keys"). | Övergivna betalningsförsök vid varje klick. | Backlogg (`fb469939`), `payment-production-readiness.md` (`885c3a87`) `[läst]` |
| 2026-10-16 | Önskat utfall beslutat: högst ett slutförbart försök per bokning och belopp. Backloggpunkten ersattes av C1. | R2 visade tre försök för samma bokning. | Sprintdokumentet, C1; backlogg `[beslut]` |
| 2026-10-23 | Regeln omformulerad utan tekniska termer; innebörden oförändrad. | Affärsregler ska vara teknikoberoende. | Johans godkännande i specifikationspiloten `[beslut]` |

**Öppet:** Q-PAY-003 (vilket belopp), Q-PAY-004 (om ett ersatt försök ändå
slutförs).

---

## Öppna frågor

| ID | Fråga | Berör | Varför den behövs |
|---|---|---|---|
| Q-PAY-002 | Är bokningar som markerades utförda före sluttid innan regeln infördes betalningsbara? | BR-PAY-001, BR-BOOK-001 | Gäller data som skapades innan C3. |
| Q-PAY-003 | Vilket belopp ska kunden betala: priset vid bokningstillfället eller ett pris som justerats efter besöket? | BR-PAY-003 | Regeln säger "per belopp". I dag används tjänstens aktuella pris vid betalningstillfället `[läst]`. |
| Q-PAY-004 | Om ett ersatt betalningsförsök ändå slutförs, ska betalningen registreras och återbetalas automatiskt eller hanteras manuellt? | BR-PAY-003 | Hör ihop med D4 (återbetalning), som ligger utanför piloten. |
| Q-PAY-005 | När och var fattades ursprungligen beslutet om betalning efter utförd tjänst? | BR-PAY-001 | Bara för lineage; påverkar inte regeln. |

## Lösta frågor

| ID | Fråga | Svar | Löst | Införd i |
|---|---|---|---|---|
| Q-BOOK-001 | Vilken tid och tidszon avgör "bokad sluttid", även vid offline-markering? | Serverns klocka; bokningens tidszon (i dag `Europe/Stockholm`); vid offline-synk gäller när servern tar emot statusbytet. | 2026-10-23, Johan | BR-BOOK-001 |
| Q-BOOK-002 | Får bokningen markeras utförd exakt vid sluttiden? | Ja: när serverns tid är lika med eller senare än sluttiden. | 2026-10-23, Johan | BR-BOOK-001 |
| Q-PAY-001 | Får någon annan än kunden betala, t.ex. stallägare eller familjemedlem? | Nej. Bara kunden som bokningen gäller. | 2026-10-23, Johan | BR-PAY-002 |

## Utanför piloten

Säljarmodell (D1), Stripe Connect, kvitto, moms, återbetalning, avboknings-
och no-show-avgifter, vilka statusbyten som i övrigt är tillåtna, vem som får
markera en bokning som utförd, samt övriga readiness-slices.
