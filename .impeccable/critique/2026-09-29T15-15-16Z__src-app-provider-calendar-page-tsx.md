---
target: leverantörskalender (supplier calendar view)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:src/app/provider/calendar/page.tsx"
target_fingerprint: "sha256:1b9906859512775d255208319be626a58f5462aee2ee9729531fbc43c2e1b1b4"
target_path: src/app/provider/calendar/page.tsx
timestamp: 2026-09-29T15-15-16Z
slug: src-app-provider-calendar-page-tsx
---
## Method: dual-agent (A: designgranskning i isolerad subagent · B: detector + browser-evidens i isolerad subagent)

Assessment A:s Chrome-anslutning gick inte att koppla upp i den subagenten, så den bygger på fullständig kodläsning snarare än egen live-inspektion. Huvudsessionen granskade därefter Assessment B:s fem skärmdumpar under syntesen för att visuellt verifiera A:s kodbaserade påståenden. De flesta av A:s påståenden bekräftades direkt i skärmdumparna.

## Design Health Score

| # | Heuristik | Poäng | Nyckelfynd |
|---|-----------|-------|------------|
| 1 | Visibility of System Status | 3 | Toasts + optimistisk uppdatering funkar bra, men Acceptera/Genomförd/Ej infunnit-knapparna i BookingDetailDialog saknar in-flight-tillstånd. |
| 2 | Match System / Real World | 3 | Bra svenskt domänspråk; "Avvisa" öppnar en dialog rubricerad "Avboka bokning?" |
| 3 | User Control and Freedom | 2 | slotPopup/dayPopup stängs bara via klick utanför — ingen Escape, ingen role="dialog". |
| 4 | Consistency and Standards | 1 | Tre oberoende statusfärg-implementationer i en och samma feature, bekräftat visuellt. |
| 5 | Error Prevention | 2 | Ombokningens tidsfält är fri text validerad i efterhand; Genomförd/Ej infunnit saknar bekräftelse. |
| 6 | Recognition Rather Than Recall | 2 | Månadsvyns statussignal är en färgad stapel utan ikon; legenden dold som standard. |
| 7 | Flexibility and Efficiency of Use | 2 | Inga tangentbordsgenvägar; uppvägs delvis av klicka-i-rutan-för-att-boka. |
| 8 | Aesthetic and Minimalist Design | 2 | Råa Tailwind-gråtoner + tre krockande statusfärgsystem; H1 saknar serif trots DESIGN.md-regel. |
| 9 | Error Recovery | 3 | Ombokning/tillgänglighet ger specifika fel; statusuppdatering faller tillbaka på generiskt fel. |
| 10 | Help and Documentation | 3 | FirstUseTooltip och engångsbanner är välplacerade och uppgiftsfokuserade. |
| **Totalt** | | **23/40** | **Acceptabel (57,5%)** |

## Design Specificity Verdict

**LLM-bedömning:** DESIGN.md är väldefinierat (Deep Pine, DM Serif Display, semantiska tokens, rounded-xl) men nästan inget syns i kalendern. H1 saknar font-serif, alla färger är råa Tailwind-utilities istället för tokens, korten använder rounded-lg border istället för rounded-xl. Detta är precis det anti-mönster DESIGN.md:s "Don't"-sektion varnar för.

**Deterministisk scan:** impeccable detect --json på alla fem filer gav 0 fynd, exit 0. Genuin lucka: detektorn flaggar inte "hårdkodad Tailwind-färg istället för semantisk token", trots att det är den mest genomgående avvikelsen.

**Visuella overlays:** Injektionen misslyckades pga sidans CSP (script-src blockerar korsdomän-script från live-servern på port 8400). Ingen synlig overlay finns. Fem vanliga skärmdumpar togs istället och bekräftar flera kodbaserade fynd (icke-serif H1, tre statusfärgstilar, trunkerade tjänstenamn på mobil).

## Overall Impression

Funktionellt kompetent kalender (klicka-för-att-boka, kontextuella statusknappar, mobil 3-dagarsvy) men har tappat kontakten med det egna designsystemet — Tailwind-defaults istället för Deep Pine/DM Serif Display/tokens. Tre kodfiler ritar samma bokningsstatus i tre olika färger, vilket gör legenden missvisande.

## What's Working

1. Mobil auto-förenkling till 3-dagarsvy under 768px — respekterar enhetens begränsning.
2. Kontextuella, statusstyrda åtgärder i BookingDetailDialog — bekräftat rent kort med korrekt Deep Pine "Acceptera"-knapp.
3. Klicka-för-att-boka direkt i rutnätet med förifylld popup.

## Priority Issues

**[P0] WeekCalendar:s klicka-för-att-boka är bara mus/touch, i standardvyn på desktop**
- Varför: WeekCalendar.tsx:322-341 är en vanlig div onClick utan role/tabIndex/tangentbord. MonthCalendar.tsx:162-193 har detta korrekt. viewMode defaultar till "week" på desktop → tangentbordsanvändare kan inte skapa bokning alls i standardvyn.
- Fix: Spegla MonthCalendar:s mönster i WeekCalendar:s dagkolumn.
- Kommando: /impeccable harden

**[P1] Flera kontroller understiger produktens egna 44px-touch-target-golv**
- Varför: BookingBlock.tsx:70 hårdkodar minHeight 28px. CalendarHeader vyväxlingsknappar är size="sm" (32px) utan manuell min-h-[44px]. Legend-knappen är en bar 16px-ikon utan padding.
- Fix: Ge BookingBlock ett riktigt 44px-golv, lägg till min-h-[44px] på vyväxlingsknapparna och legend-knappen.
- Kommando: /impeccable harden

**[P1] Tre oberoende statusfärgssystem i en enda feature**
- Varför: Bekräftat visuellt — månadsvyns solida färgstaplar matchar varken bokningsdialogens pastellbadge eller BookingBlock:s stil. Samma redan dokumenterade "Duplicated Status Rule", nu konkret synlig inom en feature.
- Fix: Gör varje vyns swatch matcha det den faktiskt renderar.
- Kommando: /impeccable clarify

**[P2] Månadsvyn kommunicerar status enbart via färg, text döljs på mobil**
- Varför: MonthCalendar.tsx:217-240 döljer tjänstenamn på mobil (hidden md:inline), bekräftat trunkerat i skärmdump.
- Fix: Återanvänd BookingBlock:s ikoner även på mobil.
- Kommando: /impeccable harden

**[P2] Ingen Escape eller dialog-semantik på de två handkodade popup-vyerna**
- Varför: slotPopup/dayPopup saknar role="dialog", fokushantering, Escape.
- Fix: Lägg till Escape-lyssnare, role="dialog", fokushantering.
- Kommando: /impeccable harden

## Persona Red Flags

**Alex (Poweranvändare)**: Noll tangentbordsgenvägar; skapa bokning i rutnätet är helt oåtkomligt via tangentbord i standardvyn.

**Sam (Tillgänglighet)**: WeekCalendar:s klickytor är icke-fokuserbara. Månadsvyns statuspunkter förmedlar mening enbart via färg. Popuparna får inget fokus.

**Casey (Mobil)**: 28px BookingBlock-höjd under tumvänligt golv. Trunkerade tjänstenamn i 3-dagarsvyn.

**Ny observation (skärmdump)**: En flytande grön mikrofon-FAB (röstloggning) ligger ovanpå kalenderrutnätets 13:00-rad på mobil — värt att verifiera att den inte stjäl klick.

## Minor Observations

- Bekräftelsedialogens titel "Avboka bokning?" visas även vid "Avvisa" av en väntande förfrågan.
- Statusknapparna i BookingDetailDialog saknar laddningstillstånd, till skillnad från ombokning/avbokning.
- getStatusStyles/getStatusLabel omdeklarerade i tre filer — risk att en ny status glöms i någon.
- CalendarHeader:s aktiva vyväxlingspiller är medvetet nästan-svart istället för grön (kodkommentar bekräftar avsikt).
- Ombokningens tidsfält är fri text validerad i efterhand.
- Engångshintar är localStorage-styrda och återkommer vid ny enhet/rensad data.

## Questions to Consider

- Kan en leverantör med en hand upptagen faktiskt skapa/kolla en bokning i veckovyn, eller antar interaktionen tyst ett skrivbord och en mus?
- Hur skulle skärmen se ut om pending/confirmed/completed var läsbara på ikon och text ensamma, med färg bara som förstärkning?
- Är det medvetet att "Kalender" är den enda skärmen som inte använder en enda deep-pine- eller serif-token, eller hann designsystemet bara aldrig hit?
- Vad skulle det kosta att ge WeekCalendar:s dagkolumn samma role/tabIndex/onKeyDown som MonthCalendar redan har?
