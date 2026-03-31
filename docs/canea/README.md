# Canea One — Genomlysning av enterprise-system

## Bakgrund

Vi har ett komplext enterprise-system (Canea One-liknande) där förändringstakten är lägre än den borde vara. Istället för att starta ett stort transformationsprogram vill vi identifiera de viktigaste flaskhalsarna och åtgärda dem inkrementellt.

Det här är ingen arkitekturstudie på papper. Vi utgår från faktisk data (git-historik, CI-metriker) och faktiska utvecklarupplevelser (intervjuer).

## Dokument

| Dokument | Målgrupp | Syfte |
|----------|----------|-------|
| [Analysmetod](analysis-method.md) | Tech leads, utvecklingsteam | Så här genomför vi analysen — steg för steg |
| [Ledningssammanfattning](executive-summary.md) | IT-ledning, beslutsfattare | Varför, hur, investering — en sida att skicka uppåt |

## Ansatsen i fem steg

1. **Mät först** — git-historik och CI-data visar var friktionen faktiskt sitter
2. **Lyssna** — 8–10 utvecklarintervjuer bekräftar eller motsäger datan
3. **Välj en slice** — den modul som är mest ändrad, mest fruktad och avgränsbar
4. **Fem små förbättringar** — strangler fig, karakteriseringstester, snabbare CI, lokal feedback-loop, DORA-dashboard
5. **Mät igen** — bestäm nästa steg baserat på resultat, inte magkänsla

## Nästa steg

1. Förankra ansatsen med IT-ledning (använd [ledningssammanfattningen](executive-summary.md))
2. Boka tid med 2–3 utvecklare för analysfasen (vecka 1)
3. Boka 8–10 intervjuer med utvecklare från olika team
4. Sätt upp åtkomst till git-historik och CI-metriker
