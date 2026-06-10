---
title: Demo Seed Terminology Review — Hovslagare
description: Read-only granskning av demo-seedens hovslagar-terminologi (tjänster, bokningar, vårdhistorik, anteckningar, meddelanden) med förslag på realistiska svenska termer och en minsta seed-slice.
category: operations
status: active
last_updated: 2026-06-06
sections:
  - Status — implementerat
  - Sammanfattning
  - 1. Inventering av dagens demo-seed
  - 2. Identifierade problem
  - 3. Föreslagna förbättringar
  - 4. Prioritering
  - 5. Minsta möjliga seed-slice
  - Referens
tags:
  - demo
  - seed
  - terminologi
  - hovslagare
related:
  - docs/operations/demo-setup.md
---

# Demo Seed Terminology Review — Hovslagare

> Ursprungligen en read-only analys. **Implementerad 2026-06-06** (P1+P2+P3 i en
> slice). Endast staging/demo-data berörs — aldrig prod. Referenssidan
> (estrin.nu) användes som **domäninspiration för terminologi, inte som kopierad
> prislista** — alla priser och formuleringar är egna rimliga demoexempel.

## Status — implementerat

Genomfört i `scripts/seed-demo-provider.ts` (commit på branch
`feature/demo-terminology`):

- **Tjänster (P1+P2):** ny uppsättning om 7 — Helskoning, Skoning fram, Verkning,
  Verkning unghäst, Tappsko, Akut hovslagarbesök, Hovstatuskontroll. Ersätter
  Omskoning / Verkning (barfota) / Akutbesök / Ungdomsverkning / Hovslagarbedömning.
- **Bokningar:** alla `bookingSpecs` mappade till nya tjänster; "Skoning fram"
  (Maria/Prince) och "Tappsko" (Karin/Bella) syns i flödet. Fritext-fix:
  "ömma fötter" → "öm i hovarna"; historik i hovslagar-ton ("Skodd enligt plan…
  fin balans… återkontroll om 8 veckor", "Verkad enligt plan").
- **Recensioner:** mappade till nya tjänster; "skärsår på hasorna" →
  "ett litet nick vid ballen bak".
- **Serie + konversation:** refererar Helskoning (tidigare Omskoning).
- **Leverantörsbeskrivning:** uppräkningen synkad till nya tjänster.
- **Priser (P3):** egna rimliga nivåer (Helskoning 1 450, Skoning fram 1 000,
  Verkning 700, Verkning unghäst 600, Tappsko 400, Akut 1 200, Hovstatus 600).
- **Reset-risk (löst):** `resetDemoData()` raderar nu providerns tjänster sist
  (efter bokningar + serier) → inga föräldralösa gamla tjänster på staging.

Verifiering: `npm run typecheck` grön, `prisma/seed-guard.test.ts` 20/20 grön.
Staging-seed (`scripts/seed-staging-demo.sh`) körs separat med interaktiv
DATABASE_URL och guard-kontroll.

> **Read-only analys (ursprunglig).** Nuläget nedan beskriver seeden *före* denna
> slice och behålls som historik.

## Sammanfattning

Demo-leverantören "Järnfots Hovslageri" (Erik Järnfot) är tekniskt och
UX-mässigt bra, men **tjänsteutbudet och delar av fritexten använder generiska
eller något konstlade termer** jämfört med hur en riktig svensk hovslagare
beskriver sitt arbete. De största sakerna:

- All skoning ligger i **en** tjänst ("Omskoning"). Riktiga prislistor skiljer
  på **helskoning** (alla fyra) och **skoning fram / halvskoning** (fram två).
- **"Ungdomsverkning"** och **"Hovslagarbedömning"** är konstruerade ord som inte
  används i branschen.
- **"Verkning (barfota)"** har en parentes som ser ut som en kod-etikett, inte
  ett tjänstenamn.
- Vanliga tjänster saknas: **tappsko** (återsättning av avtrampad sko).
- Enstaka fritext blandar anatomi ("ömma fötter", "skärsår på hasorna") som en
  hovslagare inte skulle formulera så.

Allt ligger i **en enda fil** (`scripts/seed-demo-provider.ts`), vilket gör
slicen liten — men service-namnen är strängnycklar som refereras på flera
ställen i samma fil, och **reset rensar inte gamla tjänster på staging** (viktig
risk, se §5).

---

## 1. Inventering av dagens demo-seed

Källa: `scripts/seed-demo-provider.ts` (körs av `scripts/seed-staging-demo.sh`
mot staging). Ingen separat seed för hästanteckningar/tidslinje — "vårdhistorik"
representeras av genomförda bokningar + `providerNotes` + hästars `specialNeeds`
+ kundjournal-anteckningar.

### 1a. Tjänster (`serviceData`, 5 st)

| Namn | Beskrivning | Pris | Tid | Intervall |
|------|-------------|------|-----|-----------|
| Omskoning | Komplett omskoning med verkning och nytt skobeslag | 1 400 kr | 75 min | 8 v |
| Verkning (barfota) | Verkning och raspning för hästar utan järnskor | 750 kr | 45 min | 6 v |
| Akutbesök | Akut hovslagarbesök vid skada eller hovproblem | 2 500 kr | 60 min | — |
| Ungdomsverkning | Verkning av unga hästar och föl i uppväxt | 600 kr | 40 min | 6 v |
| Hovslagarbedömning | Grundlig hovbedömning med skriftlig rapport | 800 kr | 30 min | — |

### 1b. Bokningstyper

Bokningar har ingen egen titel — UI:t bygger etiketten av **tjänstnamn +
hästnamn** (t.ex. "Omskoning – Storm"). Bokningarna sätter tjänst, häst, status
och fritext (`customerNotes` / `providerNotes` / `cancellationMessage`). 18
bokningar: bekräftade, väntande, 8 genomförda, 2 avbokade, 1 manuell + 2 i
bokningsserie.

Fritext i bokningar (urval):
- `customerNotes`: "Molly har lite ömma **fötter** på grus, annars frisk"
- `customerNotes`: "Samba verkar halta lite på höger fram sedan igår"
- `providerNotes`: "Ökad slitning på höger framhov. Kollar igen vid nästa besök."
- `providerNotes`: "Flash svårhanterad vid bakhovarna. Böjde i knä vid tag. Ta extra tid nästa gång."
- `providerNotes`: "Prince brukar stå bra. Förra gången ny sko på vänster fram."
- `cancellationMessage`: "Hästen hade feber, fick inte rida. Ber om ursäkt för sena beskedet."

### 1c. Vårdhistorik (genomförda bokningar + recensioner)

7 recensioner (`reviewSpecs`). Urval:
- "Erik är otroligt duktig och noggrann. Storm stod lugnt hela tiden..."
- "Snabbt och professionellt. Erik gav dessutom bra tips om daglig hovvård..."
- "Okej besök men Flash fick lite **skärsår på hasorna**. Hoppas det var en engångshändelse."

### 1d. Kundjournal-anteckningar (`noteSpecs`, 4 st)

- Lisa: "Betalas alltid i tid. Föredrar bokningar tidigt på morgonen. Storm är känslig vid höger framhov, se upp."
- Peter: "Veteran-ryttare med höga krav på hovvård... Midnight kan vara skygg för ljud ovanför rygghöjd."
- Stefan: "Flash är ny häst för Stefan (2 år ihop). Svår att hålla still vid bakhovarna. Ta minst 15 extra minuter."
- Emma: "Föredrar SMS-påminnelse 2 dagar i förväg. Samba och Luna sköts exemplariskt — bra hovhälsa."

### 1e. Hästars specialbehov (`horseData.specialNeeds`)

- Storm: "Öm på höger framhov — extra uppmärksamhet vid verkning"
- Bella: "Känslig i vänster bakben"
- Midnight: "Skygg för ljud — ta det lugnt vid hovvård"
- Flash: "Svår att hålla still vid bakhovarna"

### 1f. Meddelanden (konversation Anders/Dante)

3 meddelanden, realistiska ("...Dante kan vara lite svårhanterad med bakhovarna,
ta det lugnt med honom."). **Ingen åtgärd behövs här** — språket är bra.

### 1g. Leverantörsbeskrivning (`provider.description`)

"...Erbjuder **omskoning, barfotaverkning, akutbesök och hovbedömningar** inom 50
km från Örebro." → måste hållas i synk om tjänsterna byter namn.

---

## 2. Identifierade problem

| # | Var | Problem | Typ |
|---|-----|---------|-----|
| P-1 | Tjänst "Ungdomsverkning" | Konstruerat ord; "ungdom" används om människor. Hovslagare säger "verkning unghäst/föl". | Konstig formulering |
| P-2 | Tjänst "Hovslagarbedömning" | Klumpigt; tjänsten bedömer hoven, inte hovslagaren. Branschterm: "hovbedömning" / "hovstatuskontroll". | Konstig formulering |
| P-3 | Tjänst "Verkning (barfota)" | Parentesen ser ut som en kod-etikett. Branschterm: "Verkning för barfotagång". | IT-/kod-språk |
| P-4 | Tjänst "Omskoning" | Samlar all skoning i en post. Saknar den vanliga uppdelningen hel- vs framskoning. | Generiskt / saknar realism |
| P-5 | Saknad tjänst | **Tappsko** (återsättning av avtrampad sko) är ett av de vanligaste akutärendena och saknas helt. | Saknad realism |
| P-6 | `customerNotes` Molly | "ömma **fötter**" — hästar har **hovar**. | Anatomiskt fel |
| P-7 | Recension Stefan/Flash | "skärsår på **hasorna**" — hasor sitter högt på bakbenet, osannolik skadeplats vid skoning. Rimligare: ballar/kronrand. | Anatomiskt fel |
| P-8 | Pris "Akutbesök" 2 500 kr | Fast akutpris är orealistiskt högt; akut tas oftast enligt timtaxa eller med risktillägg. | Realism (pris) |
| P-9 | `provider.description` | Räknar upp tjänstekategorier som måste matcha namnbytena ovan. | Konsistens |

Inget av detta är en bugg — demon fungerar. Det handlar om **trovärdighet och
domännärhet** i språket.

---

## 3. Föreslagna förbättringar

> Egna, rimliga demoexempel — **inte** kopierade priser från referenssidan.
> Prisnivåer är satta i samma härad som verkliga prislistor men avrundade/egna.

### 3a. Tjänster (förslag)

| Nuvarande | Förslag | Beskrivning (förslag) | Pris | Tid | Intervall |
|-----------|---------|------------------------|------|-----|-----------|
| Omskoning | **Helskoning** | Skoning av alla fyra hovar, inkl. verkning | 1 450 kr | 75 min | 8 v |
| *(ny)* | **Skoning fram** | Skoning av framhovarna, inkl. verkning | 1 000 kr | 60 min | 8 v |
| Verkning (barfota) | **Verkning** | Verkning och raspning för barfotagång | 700 kr | 45 min | 6 v |
| Ungdomsverkning | **Verkning unghäst** | Verkning av unghästar och föl under uppväxt | 600 kr | 40 min | 6 v |
| *(ny)* | **Tappsko** | Återsättning av avtrampad/tappad sko | 400 kr | 30 min | — |
| Akutbesök | **Akut hovslagarbesök** | Akut bedömning och åtgärd vid hovskada eller hälta | 1 200 kr | 60 min | — |
| Hovslagarbedömning | **Hovstatuskontroll** | Genomgång av hovstatus med rekommendation och åtgärdsförslag | 600 kr | 30 min | — |

Detta tar utbudet från 5 → 7 tjänster. Vill vi hålla det vid ~5–6 kan
"Verkning unghäst" slås ihop med "Verkning" (beskriv unghäst i texten) och/eller
"Hovstatuskontroll" utgå. Se prioritering.

### 3b. Bokningar

Bokningsetiketterna förbättras automatiskt när tjänsterna byter namn
("Helskoning – Storm", "Tappsko – Bella"). Förslag: koppla minst en bokning till
**Skoning fram** och en till **Tappsko** så de nya tjänsterna syns i flödet.
Exempel på naturliga kombinationer:
- "Helskoning – Storm"
- "Verkning – Molly"
- "Tappsko – Bella" (akut återbesök efter tappad sko)

### 3c. Vårdhistorik / fritext

| Var | Nu | Förslag |
|-----|----|---------|
| customerNotes Molly | "lite ömma fötter på grus" | "lite öm i hovarna på grusunderlag" |
| Recension Stefan/Flash | "skärsår på hasorna" | "ett litet nick vid ballen bak" |
| providerNotes (exempel på bra ton att återanvända) | "Ökad slitning på höger framhov. Kollar igen vid nästa besök." | *(behåll — bra)* |

Förslag på fler historik-formuleringar i hovslagar-ton (för genomförda
bokningar): "Verkad enligt plan, fin balans", "Höger fram något ojämn —
korrigerad", "Rekommenderad återkontroll om 8 veckor".

### 3d. Leverantörsbeskrivning

Uppdatera uppräkningen till de nya namnen, t.ex.: "...Erbjuder **helskoning,
skoning fram, verkning för barfotagång, tappsko och akuta hovslagarbesök**..."

---

## 4. Prioritering

| Prio | Omfattning | Varför | Innehåll |
|------|-----------|--------|----------|
| **P1 — terminologi-fix** | Lågt | Störst trovärdighetsvinst, minst risk (rena namn-/textbyten, inga nya objekt) | Byt namn: "Verkning (barfota)"→"Verkning", "Ungdomsverkning"→"Verkning unghäst", "Hovslagarbedömning"→"Hovstatuskontroll", "Akutbesök"→"Akut hovslagarbesök". Fixa P-6 (fötter→hovar) och P-7 (hasorna→ballen). Synka `provider.description`. |
| **P2 — struktur/realism** | Medel | Höjer realismen i tjänsteutbudet men rör fler referenser | Dela "Omskoning"→"Helskoning" + "Skoning fram"; lägg till "Tappsko". Koppla 1–2 bokningar + ev. recension till de nya tjänsterna. |
| **P3 — priser** | Lågt | Kosmetiskt, lägst påverkan | Justera akutpris (P-8) och ev. övriga till realistiska nivåer. |

Rekommendation: gör **P1 först som egen slice** (säker, stor effekt). P2 i en
separat slice eftersom den ändrar tjänste-uppsättningen och kräver att gamla
tjänster städas på staging (se risk nedan).

---

## 5. Minsta möjliga seed-slice

### Filer som behöver ändras

- **`scripts/seed-demo-provider.ts`** — enda filen. Berörda block:
  - `serviceData` (§4 i koden) — namn/beskrivning/pris.
  - `bookingSpecs` (§7) — strängreferenser `service: "..."` måste matcha nya namn.
  - `reviewSpecs` (§8) — samma strängreferenser + P-7-texten.
  - `noteSpecs` (§9) — endast om vi rör journaltext (P1 rör inte dessa).
  - `horseData[].specialNeeds` (§6) — redan bra; ingen ändring nödvändig.
  - Bokningsserie (§10) och konversation (§11) refererar `services["Omskoning"]`
    via variabeln `omskoningId` — **måste döpas om** om "Omskoning" försvinner (P2).
  - `provider.description` (§2 i koden) — synka uppräkningen (P-9).
- **Ingen** annan seed-fil berörs (`seed-staging-demo.sh` anropar bara denna).

### Objekt som påverkas

Service (5 → 6–7), Booking (endast service-referenser + någon fritext), Review
(service-referenser + 1 text), Provider (description). Horse/Note/Conversation:
oförändrade i P1.

### Risk

| Risk | Nivå | Notering |
|------|------|----------|
| **Reset rensar inte tjänster** | **Medel** | `resetDemoData()` raderar bokningar/hästar/kunder/anteckningar men **inte** Service. Vid namnbyte skapas nya tjänster medan gamla ("Omskoning", "Ungdomsverkning"...) blir kvar som föräldralösa på staging. **Åtgärd:** antingen lägg till tjänste-städning i reset, eller rensa gamla tjänster manuellt på staging efter slicen. Måste hanteras i P1/P2. |
| Strängnyckel-drift | Låg–Medel | Service-namn är nycklar som används på 4 ställen i samma fil. Missas en referens hoppas bokningen/recensionen över (loggas, kraschar inte). Sök/ersätt noggrant + kör seed och verifiera antal. |
| Bokningsserie/konversation bryts (P2) | Låg | `omskoningId` pekar på "Omskoning". Om den delas i Helskoning/Skoning fram måste serien/konversationen peka på en av dem. |
| "Aktuella rutter"-annons på landningssidan | Låg | Annonsen på `/` listar tjänstenamn ("Omskoning, Akutbesök..."). Den seedas **inte** av `seed-demo-provider.ts` (separat/manuellt på staging). Om den ska matcha måste den uppdateras separat — utanför denna slice. |
| Hjälpartikel `provider/demo-guide.md` | Låg | Nämner inloggning, inte tjänstenamn — sannolikt opåverkad, men verifiera. |
| Prod-påverkan | Ingen | Seeden är guardad (`assertStagingSeedSafe`) och körs bara mot staging. |

### Verifiering efter ev. implementation (för referens, ej nu)

Kör `seed-demo-provider.ts --reset` mot staging, logga in som Erik, kontrollera
att (1) tjänstelistan visar de nya namnen utan dubbletter, (2) bokningar/historik
visar rätt etiketter, (3) inga föräldralösa gamla tjänster ligger kvar.

---

## Referens

- Domänreferens (terminologi, ej priskopiering): <https://estrin.nu/prislista/>
  — verkliga termer: *helskoning*, *halvskoning (inkl. halv verkning)*,
  *verkning för barfotagång*, *avtrampad sko*, akut enligt timtaxa, risktillägg.
- Seed: `scripts/seed-demo-provider.ts`, `scripts/seed-staging-demo.sh`
- Demo-uppsättning: `docs/operations/demo-setup.md`
