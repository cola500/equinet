---
title: "S9-5 Done: Onboarding-spike"
description: "Resultat av test av registreringsflode for ny leverantor"
category: retro
status: active
last_updated: 2026-04-02
sections:
  - Acceptanskriterier
  - Definition of Done
  - Laerdomar
---

# S9-5 Done: Onboarding-spike

## Acceptanskriterier

- [x] Testat registreringsflödet som ny leverantör på equinet-app.vercel.app
- [x] Dokumenterat vad som fungerar och vad som saknas
- [x] Identifierat minimum viable onboarding
- [x] Effort-uppskattning för att fixa luckorna

## Definition of Done

- [x] Research-dokument skrivet (`docs/research/onboarding-spike.md`)
- [x] Feature branch, redo for review

## Laerdomar

1. **Registreringen fungerar tekniskt** -- formularet ar rent, valideringen bra,
   kontotyp-valjaren sjalvforklarande. Tekniken ar inte problemet.

2. **Onboarding-vagledning saknas helt** -- efter inloggning finns ingen guide,
   checklista eller wizard. En ny leverantor ser en tom dashboard utan aning
   om vad nasta steg ar. Detta ar den storsta blockeraren.

3. **Felmeddelande vid overifierad email ar missvisande** -- "Ogiltig email
   eller losenord" istallet for "Din e-post ar inte verifierad". Skapar
   forvirring och onodiga supportarenden.

4. **Tom-tillstand ar tyst** -- tomma tjanstlistor, bokningslistor etc visar
   bara tom yta utan forklaring eller CTA. Laga effort att fixa, stor effekt.

5. **Profil-sidan ar overraskande komplett** -- alla falt finns (adress,
   serviceomrade, oppettider, profilbild). Problemet ar att ny leverantor
   inte vet att de behover fylla i dessa.
