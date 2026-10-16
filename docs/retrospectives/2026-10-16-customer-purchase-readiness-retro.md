---
title: "Retro — Customer Purchase Readiness (R0–R4)"
description: "Retro för readiness-sprinten om skarpa kunder och livebetalningar: vad vi lärde oss om produkten och om samarbetet mellan Johan, Claude Code och Codex."
category: retro
status: active
last_updated: 2026-10-16
tags: [readiness, payment, stripe, retro, agents, collaboration]
related:
  - docs/sprints/customer-purchase-readiness-2026-10.md
  - docs/architecture/payment-marketplace-model-decision.md
  - docs/agent-handoffs/README.md
sections:
  - Resultat
  - Vad vi ville ta reda på
  - Vad gick bra
  - Vad var svårt
  - Viktigaste risker och luckor
  - Beslut
  - Nästa steg
  - Behålla och förbättra
  - 5 Whys
  - Lärandeeffekt
---

# Retrospektiv: Customer Purchase Readiness (R0–R4)

**Datum:** 2026-10-16
**Scope:** Gap-to-live-genomlysning av kundens köp- och betalningsresa, samt
pilot av samarbetsmodellen med handoff-filer mellan Claude Code och Codex.
Endast dokumentation och evidens. Ingen produktkod ändrad.

---

## Resultat

- Fyra genomförande-PR:er mergades: #558 (samarbetsmodell och sprintupplägg),
  #559 (R0–R2 och R4-slices från R2), #560 (R3 och beslutsunderlag D1) och
  #561 (R4-beslut). Retron avslutar sprinten i en femte PR.
- Slutklassning: **`NOT READY`** för skarpa kunder och livebetalningar.
- 19 maskerade skärmbilder som evidens (R1 och R2). 260 befintliga mockade
  tester kördes som baslinje i R0, alla gröna.
- R2-testdata i staging städades; alla 13 räknade tabeller tillbaka på
  baslinjen. Produktionsdata och riktiga betalningar opåverkade.

## Vad vi ville ta reda på

Om en riktig hästägare i produktion kan hitta en leverantör, boka rätt tjänst
och betala säkert, och om leverantören sedan får korrekt status. Utgångsläget
var att Equinet inte är live-redo; målet var en evidensbaserad väg till
`READY`, inte ett ja eller nej.

## Vad gick bra

### 1. Produkten: kärnan i betalkedjan håller
I Stripe test mode fungerade serverstyrt belopp, ägarskapsskydd, webhook med
signatur och deduplicering, kvitto, 3D Secure och skydd mot ny betalning av
redan betald bokning. Problemen ligger i flödet runt kärnan, inte i den.

### 2. Test slog antaganden
Den dokumenterade hypotesen att CSP skulle blockera 3D Secure motbevisades av
ett riktigt testpass. Hypotesen stängdes i sprintdokument, arkitekturdokument
och backlogg samma dag.

### 3. Tydliga stoppunkter och read-only-disciplin
Varje steg stannade för granskning. Prod granskades read-only, miljökontroller
rapporterade bara finns/saknas, och persona-motsägelsen inför R2 stoppades före
inloggning i stället för att gissas bort.

### 4. Kontrollerad testdatahantering
Baslinje före R2, märkning av testbokningar, privat körlogg utanför repot,
radering i en transaktion med räknevakter och verifiering mot baslinjen. Inget
utanför R2 rördes.

### 5. Samarbetet: ägarskap och oberoende granskning
Skrivägarskapet i handoff-filerna höll; ingen agent skrev i den andras fil.
Codex granskning fångade överdrivna formuleringar som annars hade blivit
kanoniska (faktura krävs alltid, `on_behalf_of` avgör säljare, Google Pay
blockeras, `abandoned` i stället för `canceled`, generellt "statuskrav
fungerar").

## Vad var svårt

### 1. Sprintens premiss behövde avgöras sent
Sprinten frågade om riktiga kunder, medan v0.3.0 var klassad som Customer
Preview med fiktiv data. Scopebeslutet kom först efter R0-granskningen.

**Prioritet:** MEDEL – nästa readiness-sprint bör fastställa målnivå före R0.

### 2. Många precisionsrundor på formuleringar
Flera R3- och R4-texter behövde justeras i efterhand eftersom jag formulerade
slutsatser starkare än källan stödde. Det gav extra granskningsrundor och
onödig stress.

**Prioritet:** HÖG – kanoniska dokument ska skilja verifierat från tolkning.

### 3. Verktygsfriktion
- Lokal `.vercel` pekade på staging; det var nära att en "prod"-lista var
  staging (E2 i R4).
- Stripe-anslutningen saknade cancel-operation; två PaymentIntents fick
  avbrytas via Stripes API med stagings testnyckel.
- Teckenkontrollen blockerade en Skatteverket-URL (falskt positiv).
- En heredoc klippte PR-texten för #558.
- Handoff-filerna växte ibland över 40 rader.

**Prioritet:** LÅG–MEDEL – uppföljningar finns i backloggen.

### 4. Känsliga uppgifter nära arbetsytan
En maskering av demouppgifter misslyckades så att fasta demouppgifter visades
i sessionen (de finns redan i klartext i repot). En R1-skärmbild innehöll först
ett foto av en verklig person och togs om suddad.

**Prioritet:** MEDEL – maskera innan visning, inte efter.

## Viktigaste risker och luckor

| Risk eller lucka | Var den hanteras |
|---|---|
| Säljarmodell odefinierad (pengar till Equinets konto, kvittot anger leverantören) | D1, [beslutsunderlag](../architecture/payment-marketplace-model-decision.md) |
| Flera bekräftningsbara PaymentIntents per bokning | C1 |
| Betalning vid `confirmed`, `completed` före bokad tid | C2, C3 |
| Platshållare i villkor och integritetspolicy; avbokningsregel motsäger koden | D2 |
| Kvitto saknar moms och säljarens identitet | D3 |
| Publik testdata i prod; riktiga och syntetiska konton blandade | A, B |
| Ingen refund- eller tvisthantering | D4 |
| Inga betalningslarm; `logger` skickar inte till Sentry | D5 |
| Ingen betalnotis; betalstatus syns inte hos leverantören | C4, C6 |

Alla finns i [R4-beslutet](../sprints/customer-purchase-readiness-2026-10.md).

## Beslut

1. R4 klassas som **`NOT READY`** för livebetalningar.
2. D1 hanteras som ett **separat beslutsspår** som blockerar livebetalningar
   men inte R4.
3. En bokning får normalt **inte** markeras som utförd före bokad sluttid
   (C3, nu infört i sprintdokumentet).
4. En eventuell framtida override ska vara **behörighetsstyrd, motiverad och
   loggad**. Den ingår inte i första versionen av C3.
5. En **separat, återställningsbar plan** ska tas fram innan testdata i
   produktion städas (slice A).

## Nästa steg

**Våg 0 – beslut (Johan)**

- Starta extern verifiering av D1 med jurist, redovisningskonsult och Stripe.
  Frågorna finns i beslutsunderlaget.
- Godkänna att en plan för A tas fram.

**Förberedelser (får starta efter godkännande, ingen ändring av data)**

- Ta fram den återställningsbara planen för A: read-only inventering,
  klassning verklig/syntetisk/osäker, backup och återställningsväg.
- Förbereda D2 och D3 (texter och innehållskrav) utan att slutimplementera
  före D1.

**Implementation, våg 1 (varje slice kräver eget startbeslut, feature branch, TDD och review)**

- C3: avvisa `completed` före bokad sluttid.
- C2: betalning först efter `completed` (efter C3).
- C1: en betalningsstart per bokning.
- D5 grund: betalningslarm och runbook.
- A: genomförs först när planen är godkänd.

## Behålla och förbättra

**Behålla**

- Handoff-filer med skrivägarskap, `[läst]`/`[körd]` och korta filer.
- Stoppunkt efter varje steg och oberoende granskning av Codex före merge.
- Baslinje, märkning, guardad städning och verifiering vid tester i delade
  miljöer.
- Maskerad evidens i repot och ID:n i privat körlogg.

Sprinten gav flera lärdomar. Bara en av dem blir en processförändring som vi
aktivt inför och utvärderar i nästa readiness-sprint. De övriga hanteras som en
bestående regel, som backlogguppgifter eller som lärdomar utan egen uppgift.

**Vald processförbättring för nästa readiness-sprint: beslutsrutan**

Codex kompletterande slutsats: den oberoende granskningen fungerade väl och
höjde precisionen, men beslutsunderlagen blev ibland tekniskt omfattande
innan de översattes till vad Johan faktiskt behövde besluta. Vid varje
stoppunkt där Johan behöver ta ställning används därför en kort beslutsruta:

1. Vad är verifierat?
2. Vad är fortfarande osäkert?
3. Vilket beslut behövs nu?
4. Vad rekommenderar agenterna, uttryckt i vanlig svenska?
5. Vad kan fortsätta utan beslutet?

**Ägare:** Claude Code skriver beslutsrutan; Codex kontrollerar den vid
granskning. Regeln finns permanent i
[agent-handoffs/README.md](../agent-handoffs/README.md).

**Bestående säkerhetsregel**

- Maskera känsliga uppgifter före visning, inte efter. Gäller utdata i
  sessionen, skärmbilder och dokument.

**Backlogguppgifter**

Följande ligger i [backloggen](../sprints/backlog.md) eller sprintdokumentet:

- Verktygsfriktion: teckenkontrollens falska positiv på URL:er (backlog) och
  den lokala `.vercel`-länken (E2 i R4).
- Dokumenthygien efter R0 (backlog).
- Bedömning av demouppgifter och seed-adresser i staging (backlog).

**Övriga lärdomar (inga egna processuppgifter)**

- Fastställ målnivå (preview eller skarpt) innan R0.
- Skilj verifierat, observerat och frågor till sakkunnig åt även i
  kanoniska dokument. Beslutsrutans fråga 1 och 2 täcker detta vid
  stoppunkterna.

## 5 Whys

### Problem: Slutsatser formulerades starkare än källorna
1. Varför? Texter som "faktura krävs" och "`on_behalf_of` blir säljare" skrevs
   som fakta.
2. Varför? Källorna sammanfattades till en rekommendation i stället för att
   återges med sina förbehåll.
3. Varför? Sprintdokumentet saknade markering för verifierat jämfört med
   tolkat, till skillnad från handoff-filerna.
4. Varför? Evidensmarkörerna infördes bara för tillfälliga handoffs.
5. Varför? Kanoniska dokument behandlades som slutsatser snarare än underlag.

**Åtgärd:** Använd evidensmarkering och "fråga till sakkunnig" även i
kanoniska readiness-dokument (gjort i D1-underlaget).
**Status:** Delvis implementerad.

### Problem: Nära felaktig miljökontroll
1. Varför? En `vercel env ls` utan explicit projekt listade staging som prod.
2. Varför? Lokal `.vercel` pekar på staging.
3. Varför? Runbooken säger prod, och ingen kontroll fångar avvikelsen.
4. Varför? Länken har ändrats utan att dokumentet uppdaterades.
5. Varför? Länken är lokal och osynlig i git.

**Åtgärd:** Ange alltid projekt explicit; besluta länken i E2.
**Status:** Att göra (E2).

## Lärandeeffekt

**Nyckelinsikt:** Readiness avgörs mindre av om betalningen tekniskt går
igenom och mer av ansvar runt betalningen: vem som säljer, vem som återbetalar
och vem som märker när något går fel. Ett kort testpass med riktig integration
och tydliga stoppunkter gav mer säker kunskap än dokumenterade antaganden.
