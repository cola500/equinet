---
title: "Beteendescenarier – bokning och betalning"
description: "Verifierbara Given/When/Then-scenarier för när en bokning blir utförd och när den får betalas (pilot)"
category: testing
status: draft
last_updated: 2026-10-23
tags: [specification, scenarios, booking, payment, pilot]
depends_on:
  - docs/specifications/business-rules/booking-payment.md
related:
  - docs/specifications/traceability/booking-payment-matrix.md
sections:
  - Läsanvisning
  - Utförd tidigast vid sluttid
  - Betalning och bokningsstatus
  - Egen bokning
  - Ett betalningsförsök
---

# Beteendescenarier – bokning och betalning

## Läsanvisning

- Scenarierna beskriver vad en användare eller ett externt system ska kunna
  observera, inte hur det byggs.
- **Status** per scenario: `beslutat` (följer direkt av en beslutad regel),
  `tolkning` (rimlig läsning av regeln, inväntar bekräftelse) eller
  `obeslutat` (kräver svar på en öppen fråga).
- Om inget annat anges gäller grundexemplet: **en bokning den 10 november 2026
  kl. 10:00–11:00 svensk tid** (vintertid, UTC+1) hos leverantören L för
  kunden K, pris 800 kr.
- "Klockan är" avser Equinets serverklocka, uttryckt i bokningens tidszon
  (BR-BOOK-001).
- "Avvisas" betyder: åtgärden genomförs inte, användaren får ett begripligt
  besked på svenska och inget annat ändras.

## Utförd tidigast vid sluttid

Regel: BR-BOOK-001. Bokningen är bekräftad i alla scenarier.

| ID | Given | When | Then | Status |
|---|---|---|---|---|
| SC-BOOK-001 | Klockan är 11:30 | L markerar bokningen som utförd | Bokningen blir utförd | beslutat |
| SC-BOOK-002 | Klockan är 07:00 samma dag | L markerar bokningen som utförd | Avvisas; bokningen förblir bekräftad | beslutat |
| SC-BOOK-003 | Klockan är 10:30 (besöket pågår) | L markerar bokningen som utförd | Avvisas | beslutat |
| SC-BOOK-004 | Klockan är 10:59 | L markerar bokningen som utförd | Avvisas | beslutat |
| SC-BOOK-005 | Klockan är exakt 11:00 | L markerar bokningen som utförd | Bokningen blir utförd | beslutat |
| SC-BOOK-006 | Equinets server räknar i UTC; klockan är 10:30 UTC (= 11:30 svensk tid) | L markerar bokningen som utförd | Bokningen blir utförd. Vid 09:30 UTC (= 10:30 svensk tid) avvisas samma åtgärd. | beslutat |
| SC-BOOK-007 | Bokningen gäller 28 mars 2027 kl. 10:00–11:00, dagen då sommartid börjar (UTC+2) | L markerar utförd kl. 10:30 svensk tid (08:30 UTC), respektive 11:05 svensk tid | 10:30 avvisas, 11:05 tillåts. Gränsen följer svensk lokal tid, inte en fast UTC-förskjutning. | beslutat |
| SC-BOOK-008 | L är offline och trycker "utförd" kl. 10:45; enheten synkar när servern tar emot statusbytet kl. 11:10 | Servern tar emot statusbytet | Bokningen blir utförd, eftersom mottagningstiden 11:10 avgör. Tas statusbytet emot redan 10:55 avvisas det. | beslutat |

Det finns ingen möjlighet att kringgå regeln i första versionen; SC-BOOK-002
gäller även om leverantören uppger att besöket redan är klart.

## Betalning och bokningsstatus

Regel: BR-PAY-001. K är inloggad och betalar sin egen bokning.

| ID | Given | When | Then | Status |
|---|---|---|---|---|
| SC-PAY-001 | Bokningen är utförd och obetald | K väljer att betala och slutför med ett godkänt kort | Betalningen genomförs med 800 kr och bokningen visas som betald för K | beslutat |
| SC-PAY-002 | Bokningen väntar på bekräftelse | K försöker betala | Avvisas; ingen betalning påbörjas. K erbjuds inget betalalternativ. | beslutat |
| SC-PAY-003 | Bokningen är bekräftad men inte utförd – även om sluttiden har passerat | K försöker betala | Avvisas; ingen betalning påbörjas. K erbjuds inget betalalternativ. | beslutat |
| SC-PAY-004 | Bokningen är avbokad | K försöker betala | Avvisas | beslutat |
| SC-PAY-005 | Bokningen är markerad som utebliven kund | K försöker betala | Avvisas; ingen avgift tas ut via det vanliga betalflödet | beslutat |
| SC-PAY-006 | Bokningen markerades utförd före sluttid innan BR-BOOK-001 infördes | K försöker betala | ? | obeslutat (Q-PAY-002) |

## Egen bokning

Regel: BR-PAY-002. Bokningen är utförd och obetald.

| ID | Given | When | Then | Status |
|---|---|---|---|---|
| SC-PAY-010 | Kunden K2 är inloggad; bokningen tillhör K | K2 försöker betala bokningen | Avvisas; ingen betalning påbörjas | beslutat |
| SC-PAY-011 | Leverantören L är inloggad | L försöker betala bokningen som kund | Avvisas; ingen betalning påbörjas | beslutat |
| SC-PAY-012 | Ingen är inloggad | Någon försöker betala bokningen | Avvisas; inloggning krävs | beslutat |
| SC-PAY-013 | En familjemedlem eller stallägare till K är inloggad | Hen försöker betala för K | Avvisas; ingen betalning påbörjas. Ombud är inget undantag. | beslutat |

## Ett betalningsförsök

Regel: BR-PAY-003. Bokningen är utförd och obetald; K är inloggad.

| ID | Given | When | Then | Status |
|---|---|---|---|---|
| SC-PAY-020 | Inget betalningsförsök finns | K klickar två gånger snabbt på "Betala" | Högst ett försök kan slutföras; K kan debiteras högst en gång | beslutat |
| SC-PAY-021 | Inget betalningsförsök finns | K startar betalning samtidigt i två flikar eller enheter | Högst ett försök kan slutföras | beslutat |
| SC-PAY-022 | K har startat betalning och stängt dialogen utan att betala | K startar betalning igen | Antingen återanvänds samma försök, eller så går det tidigare inte längre att slutföra. Aldrig två slutförbara försök. | beslutat |
| SC-PAY-023 | K:s kort nekades i ett försök | K försöker igen och betalningen godkänns | K debiteras en gång och bokningen visas som betald en gång | beslutat |
| SC-PAY-024 | Bokningen är redan betald | K försöker betala igen | Avvisas; ingen ny debitering | tolkning |
| SC-PAY-025 | Ett försök på 800 kr är påbörjat; därefter skapas ett nytt försök för ett annat aktuellt belopp | Det nya försöket skapas | Försöket på 800 kr går inte längre att slutföra. Om det nya beloppet ska vara bokningspriset eller ett senare justerat pris är obeslutat (Q-PAY-003). | beslutat (beloppet obeslutat, Q-PAY-003) |
| SC-PAY-026 | Ett tidigare, ersatt försök slutförs ändå (t.ex. från innan regeln infördes) | Betalleverantören rapporterar betalningen | ? | obeslutat (Q-PAY-004) |
