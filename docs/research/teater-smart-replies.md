# Teaterföreställning i tre akter
## "Erik svarar på ett meddelande"

---

### Personae

**Erik Järnfot** — hovslagare, 58. Har kört hovslagare i 30 år. Equinet Pro-konto. Svarar på meddelanden med en tumme, sitter i lastbilshytten.

**Anna** — häst-mamma, 35. Har bokat Eriks besök för sin häst Majestät. Ställer en följdfråga via appen.

**Appen** — tiger mest. Visar chips.

**Tid och plats:** Fredag förmiddag, 2026-05-02. Erik sitter parkerad vid ett stall i Knivsta. Anna är hemma i köket.

---

## AKT 1 — Chipen som inte lyssnar

Anna har precis skickat ett meddelande i bokningstråden:

> "Hej Erik! Jag undrar — kan du titta lite extra på Majestäts vänster bakben när du är här? Hon har haltat lite de senaste dagarna."

Erik öppnar tråden. Han ser Annas meddelande. Under tråden, ovanför skrivfältet, dyker fyra gröna chips upp:

1. "Bokningen är bekräftad. Vi ses fredag 2 maj kl 14:00."
2. "Tack, jag återkommer så snart jag kan."
3. "Ring mig på 070-612 34 56 om det brådskar."
4. "Vilken tid passar dig istället?"

Erik: läser chipen. Läser Annas fråga igen.

Erik: *"Hon frågar om hältningen. Inget av de här svaren handlar om det."*

Chip 1 är logistik-bekräftelse — Anna vet redan att de ses fredag. Chip 3 uppmanar Anna att ringa, fast hon just skickade ett chat-meddelande. Chip 4 är direkt kontraproduktivt — ingen har föreslagit att byta tid.

Erik väljer chip 2: "Tack, jag återkommer så snart jag kan." Han tänker följa upp med ett riktigt svar.

▎ 🚨 **GAP 1 — Chips är kontextblinda.** De fyra mallarna visas alltid, oavsett vad kunden ▎
▎ faktiskt frågade om. Vid en logistikfråga ("Vilken dörr ska jag öppna?") är de relevanta. ▎
▎ Vid en medicinsk följdfråga ("Hon har haltat lite") är de meningslösa eller vilseledande. ▎
▎ Appen läser inte konversationen — den visar samma fyra chip till alla, alltid. ▎

---

## AKT 2 — Variabeln som aldrig fylldes i

Nu är det Björn Olsson, en annan leverantör. Björn är hundtränare, 44. Han skapade sitt Equinet-konto förra veckan och har ännu inte fyllt i telefonnummer i sin profil.

En kund har skickat: "Hoppas du är frisk! Ser fram emot att ses."

Björn öppnar tråden. Chips dyker upp:

1. "Bokningen är bekräftad. Vi ses lördag 3 maj kl 10:00."
2. "Tack, jag återkommer så snart jag kan."
3. **"Ring mig på {telefon} om det brådskar."**
4. "Vilken tid passar dig istället?"

Björn ser chip 3. Han klickar på den utan att titta noga.

Chip-texten hamnar i skrivfältet. Han trycker "Skicka".

Kunden får meddelandet:

> Ring mig på **{telefon}** om det brådskar.

▎ 🚨 **GAP 2 — {telefon} expanderas inte om leverantören saknar telefonnummer i profilen.** ▎
▎ Koden gör `profile?.phone ?? ""` — om `phone` är `undefined` returneras tom sträng. ▎
▎ Men `expandTemplate` ersätter `{telefon}` med tom sträng bara om nyckeln finns med värde. ▎
▎ Kolla: `vars[key as keyof SmartReplyVars] ?? \`{\${key}}\`` — om värdet är `undefined`, ▎
▎ returneras `{telefon}` oexpanderat. Kunden ser en teknisk placeholder i ett skickat meddelande. ▎

---

## AKT 3 — Det som skrevs försvann

Erik är tillbaka. Han läser Annas meddelande om hältningen. Han börjar skriva ett riktigt svar i skrivfältet:

> "Hej Anna! Absolut, jag tittar på bakbenet. Det kan vara..."

Han är halvvägs igenom meningen. Telefonen tuttar till — ett annat meddelande från en annan kund. Erik glider med tummen och råkar trycka på chip 2: "Tack, jag återkommer så snart jag kan."

Hans halvfärdiga mening försvinner. Ersatt av chip-texten.

Erik: *"Va hände?"*

Han ser chip-texten i fältet. Han inser att hans svar är borta.

▎ 🚨 **GAP 3 — Chip-klick ersätter (inte appendar) textarea-innehållet utan varning.** ▎
▎ `onSelect={(text) => setContent(text)}` — en hård setState, inte `prev + text`. ▎
▎ Om leverantören har börjat skriva och råkar klicka ett chip förlorar de texten utan undo. ▎
▎ Chips sitter tätt under tråden, lätt att missta ett chip-tryck för scroll i en smal viewport. ▎

---

## AKT 4 (liten, men viktig) — Den femte frasen

Erik parkerar vid nästa stall. Han vill snabbt meddela nästa kund:

> "Jag är på väg, ca 15 minuter."

Han öppnar tråden. Chips:

1. Bokning bekräftad (skickade det igår)
2. Tack, jag återkommer (återkom inte)
3. Ring mig om det brådskar (kunden har inget bråttom)
4. Vilken tid passar dig istället? (ingen fråga om tid)

Inget chip för det han faktiskt vill säga. Han skriver det manuellt. 8 sekunder. Men han är hovslagare med handskarna på och fingertopp-precision är en utmaning.

▎ 🚨 **GAP 4 — De fyra mallarna täcker inte de mest frekventa leverantörsbehoven i fält.** ▎
▎ "Jag är på väg / ca X minuter" är troligen det vanligaste korta meddelandet en leverantör ▎
▎ skickar. Det saknas. "Jag är här nu, är du hemma?" saknas. "Kan du öppna grinden?" saknas. ▎
▎ Mallarna är designade för kontorsarbete, inte för en leverantör som sitter i en lastbil. ▎

---

## 🎬 Ridån går ner

Erik och Anna möts vid stallet. Majestät blir skodd. Hältningen undersöks (och visar sig vara ett löst sko). Appen spelade en liten roll — men hade kunnat spela en större.

---

## Gap-sammanfattning

| # | Akt | Gap | Allvarlighet | Svårighet att fixa |
|---|-----|-----|--------------|-------------------|
| 1 | 1 | Chips är kontextblinda — fyra mallar oavsett kundens fråga | Medel | Medel (behöver kontext-läsning eller mer mallar) |
| 2 | 2 | `{telefon}` visar placeholder om leverantören saknar telefonnummer | Hög | Låg (grå ut chip, validera `vars.telefon` före visning) |
| 3 | 3 | Chip-klick ersätter befintlig textarea-text utan varning | Medel | Låg (ändra `setContent(text)` till att bara sätta om fältet är tomt, annars visa confirm) |
| 4 | 4 | Chip-urvalet matchar inte typiska leverantörsbehov i fält | Medel | Låg (byt/utöka mallarna) |

---

## Mönster i gapen

**GAP 1 och 4** handlar om malldesign — vad som valdes att representera "smart". De fyra nuvarande mallarna är defensiva kontor-svar ("jag återkommer"). En hovslagare i lastbilen vill skicka lokal/ETA-information. Mallarna speglar vad designern trodde leverantörer säger, inte vad de faktiskt skriver.

**GAP 2 och 3** är tekniska — enkla att fixa, men borde ha hittats i review. GAP 2 är en one-liner (`vars.telefon ? chip : chip.disabled`). GAP 3 är en medveten UX-policy som kan diskuteras.

---

## Rekommenderade fixes (prioritetsordning)

**Fix 1 — GAP 2 (kritisk, 30 min):**
Grå ut / dölj chip 3 om `vars.telefon` är tom sträng. Alternativt: visa chip men med en liten indikator "Lägg till telefonnummer i profilen".

```tsx
// SmartReplyChips.tsx
// Grå ut chip om variabeln saknas
const hasUnresolvedVar = /\{\w+\}/.test(text)
className={`... ${hasUnresolvedVar ? "opacity-40 cursor-not-allowed" : ""}`}
disabled={disabled || hasUnresolvedVar}
```

**Fix 2 — GAP 3 (medel, 1 timme):**
Varna om fältet redan har text när chip klickas. Enklast: om `content.trim()` inte är tomt, visa en `toast` + låt klicket ersätta ändå (eller byt till append + radbrytning).

**Fix 3 — GAP 4 (medel, 30 min):**
Byt ut en av de fyra mallarna mot "Jag är på väg, kommer om ca {minuter} minuter." eller "Jag är framme nu!" — men detta kräver produktdiskussion om vilka mallar som faktiskt används (saknar telemetri).

**Fix 4 — GAP 1 (stor, kräver diskussion):**
Kontextbaserade chips är ett AI-problem. Enklaste alternativet utan AI: fler mallar (8–10 st, scrollbar rad) som leverantören kan konfigurera själv. Mer ambitiöst: analysera senaste kundens meddelande och rankulera chips. Post-launch.

---

*Vilken fix ska vi ta i sprint 63?*
