# Canea One — Genomlysning av enterprise-system

Pragmatisk metod för att identifiera förbättringsområden i ett komplext enterprise-system (Canea One-liknande). Fokus på inkrementell förbättring — inte stora transformationsprogram.

## Dokument

| Dokument | Målgrupp | Innehåll |
|----------|----------|----------|
| [Analysmetod](analysis-method.md) | Utvecklingsteam & teknisk ledning | Hotspot-analys, intervjufrågor, teststrategi, fem konkreta förbättringar |
| [Ledningssammanfattning](executive-summary.md) | IT-ledning & beslutsfattare | Varför, hur, investering — en sida |

## Kort om ansatsen

1. **Mät först** — git-historik och CI-data visar var friktionen sitter
2. **Lyssna** — 8–10 utvecklarintervjuer bekräftar (eller motsäger) datan
3. **Välj en slice** — den modul som är mest ändrad, mest fruktad och avgränsbar
4. **Fem små förbättringar** — strangler fig, karakteriseringstester, snabbare CI, lokal feedback-loop, DORA-dashboard
5. **Mät igen** — bestäm nästa steg baserat på resultat
