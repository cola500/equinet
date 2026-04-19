---
title: "Sprint 40: Smart-replies prod-ifiering"
description: "Polera hackathon-prototyp till prod-standard: svenska, a11y, feature flag, tester, docs"
category: sprint
status: planned
last_updated: 2026-04-19
tags: [sprint, messaging, smart-replies, prod-hardening]
sections:
  - Sprint Overview
  - Stories
  - Exekveringsplan
---

# Sprint 40: Smart-replies prod-ifiering

## Sprint Overview

**Mål:** Ta hackathon-prototypen (`SmartReplyChips`) från "fungerar fint i demo" till prod-nivå — rätt svenska, a11y-regelrätt, gradvis rollout via flag, testad, dokumenterad.

**Bakgrund:** Smart-replies byggdes i 2h-hackathon 2026-04-19 (se `docs/hackathons/2026-04-19-smart-replies.md`). Johan testade och gav specifik feedback: templates-svenska klumpig, tid-format saknar veckodag, touch-target under projekt-regeln (36pt vs 44pt). Dessutom domän-fel: "Min adress" är fel — leverantören åker TILL kunden, inte tvärtom.

**Normal sprint-regler** (hackathon-läget är över): plan-fil, code-reviewer, TDD på ren logik, commit via feature branch + PR.

---

## Stories

### S40-0: Svenska + datum-veckodag + touch-target 44pt

**Prioritet:** 0
**Effort:** 30 min
**Domän:** webb (`src/components/provider/messages/SmartReplyChips.tsx` + `src/app/provider/messages/[bookingId]/page.tsx`)

**Aktualitet verifierad:**
- Bekräfta att `SmartReplyChips.tsx` existerar med hackathon-versionens 5 templates
- Verifiera att `min-h-[36px]` är kvar i className (brott mot `ui-components.md`)
- Verifiera att `datum`-formatering är `day: "numeric", month: "long"` (utan veckodag)

**Implementation:**

**Steg 1: Uppdatera templates**

Ta bort mall 4 ("Min adress: {adress}") helt — domän-fel eftersom leverantören åker till kunden. Även `adress`-fältet i `SmartReplyVars`-interfacet kan tas bort om inget använder det.

Nya 4 templates:
```ts
const TEMPLATES = [
  "Bokningen är bekräftad. Vi ses {datum} kl {tid}.",
  "Tack! Jag återkommer så snart jag kan.",
  "Ring mig på {telefon} om det brådskar.",
  "Vilken tid passar dig istället?",
]
```

Uppdatera `SmartReplyVars`-interfacet: ta bort `adress` om den inte används någon annanstans.

**Steg 2: Datum-format med veckodag**

I `page.tsx` `smartReplyVars`-byggaren:
```ts
datum: d ? d.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" }) : "",
```

Ger "onsdag 22 april" istället för "22 april".

**Steg 3: Touch-target 44pt**

I `SmartReplyChips.tsx`:
```tsx
className="... min-h-[44px] ..."  // var min-h-[36px]
```

Möjligen behöver padding ökas (`py-2` istället för `py-1.5`) för att få balanserad vertikal centering. Verifiera visuellt.

**Steg 4: Verifiera visuellt**

Playwright MCP eller manuell test i dev-server — chips ska vara lättklickbara på mobil.

**Acceptanskriterier:**
- [ ] 4 templates (inte 5), "Min adress"-borttagen
- [ ] Svenska omformulerade enligt S40-spec
- [ ] Datum-format inkluderar veckodag ("onsdag 22 april")
- [ ] Touch-target ≥44pt (enligt `ui-components.md`)
- [ ] `SmartReplyVars` uppstädat (ingen oanvänd `adress`)
- [ ] `npm run check:all` grön

**Reviews:** cx-ux-reviewer (svenska + touch-target), code-reviewer

**Arkitekturcoverage:** N/A.

---

### S40-1: Feature flag `smart_replies` + unit-tests

**Prioritet:** 1
**Effort:** 45 min
**Domän:** webb (feature flag + `SmartReplyChips.test.tsx`)

**Aktualitet verifierad:**
- Kolla att `smart_replies` inte redan finns i `src/lib/feature-flag-definitions.ts`
- Verifiera att `useFeatureFlag`-hook-mönstret används i närliggande komponenter (t.ex. `MessagingSection`)

**Implementation:**

**Steg 1: Lägg till flag**

I `src/lib/feature-flag-definitions.ts`:
```ts
smart_replies: {
  key: "smart_replies",
  label: "Snabbsvar för leverantörer",
  description: "Visar klickbara mall-chips ovanför skriv-fältet i messaging-tråden",
  defaultEnabled: false,
  clientVisible: true,
  category: "shared",
},
```

**Steg 2: Gate i ThreadView**

I `page.tsx`:
```ts
const smartRepliesEnabled = useFeatureFlag("smart_replies")
// ...
{smartRepliesEnabled && (
  <SmartReplyChips vars={smartReplyVars} onSelect={setContent} disabled={isSending} />
)}
```

**Steg 3: TDD för `expandTemplate`**

Skapa `src/components/provider/messages/SmartReplyChips.test.tsx`:
- `expands {key} with matching var`
- `leaves {key} intact when var missing`
- `expands multiple {keys} in same template`
- `handles undefined/empty vars object gracefully`
- `ignores non-matching braces (no false positives)`

BDD/enkel TDD: skriv RED-tester först, GREEN genom att köra befintlig funktion, REFACTOR om behövs.

**Steg 4: Testmockar uppdaterade**

- `src/lib/feature-flags.test.ts` kan behöva uppdaterad mock om defaults-set förändras
- `src/app/api/feature-flags/route.test.ts` likaså

**Acceptanskriterier:**
- [ ] `smart_replies` flag definierad, `defaultEnabled: false`
- [ ] ThreadView renderar chips BARA om flag enabled
- [ ] Minst 5 unit-tester för `expandTemplate`
- [ ] Feature-flag-tester fortfarande gröna
- [ ] `npm run check:all` grön

**Reviews:** code-reviewer (logik + test-täckning)

**Arkitekturcoverage:** N/A.

---

### S40-2: Docs (hjälpartikel + testing-guide + README)

**Prioritet:** 2
**Effort:** 30 min
**Domän:** docs (`src/lib/help/articles/provider/` + `docs/testing/testing-guide.md` + `README.md`)

**Aktualitet verifierad:**
- Läs befintlig `src/lib/help/articles/provider/meddelanden.md` (finns från S35-1) — uppdatera existerande eller skapa separat?
- Bekräfta att testing-guide har messaging-sektion (lades till i S38-1)

**Implementation:**

**Steg 1: Uppdatera leverantör-hjälpartikel**

Lägg till sektion i `src/lib/help/articles/provider/meddelanden.md`:

```markdown
## Snabbsvar

Ovanför skriv-fältet visas 4 klickbara snabbsvar:
- "Bokningen är bekräftad. Vi ses [datum] kl [tid]."
- "Tack! Jag återkommer så snart jag kan."
- "Ring mig på [ditt telefonnummer] om det brådskar."
- "Vilken tid passar dig istället?"

Klicka för att fylla i textrutan — du kan redigera innan du skickar.
```

**Steg 2: Testing-guide scenario**

Lägg till under messaging-sektionen i `docs/testing/testing-guide.md`:

```markdown
### Snabbsvar (feature flag `smart_replies`)
- [ ] Aktivera flag i admin/system
- [ ] Leverantör öppnar tråd → 4 chips synliga
- [ ] Klick på "Bokningen är bekräftad..." → datum+tid expanderas korrekt
- [ ] Klick på "Ring mig på..." → telefon från profil expanderas
- [ ] Textrutan uppdateras utan att skicka (leverantör kan redigera)
- [ ] Inaktivera flag → chips försvinner
```

**Steg 3: README.md Implementerade Funktioner**

Lägg till rad:
```markdown
- Snabbsvar i leverantörens meddelande-tråd (feature flag `smart_replies`, default off)
```

**Steg 4: Feature flag i rollout-checklistan**

Eftersom `defaultEnabled: false`: lägg till i `docs/operations/feature-flag-rollout-checklist.md` om tid finns (följer S39-2-mönstret).

**Acceptanskriterier:**
- [ ] `meddelanden.md` för leverantör har snabbsvar-sektion
- [ ] Testing-guide har snabbsvar-scenario
- [ ] README.md har snabbsvar-rad
- [ ] `npm run docs:validate` grön

**Reviews:** code-reviewer (trivial, kan skippas)

**Arkitekturcoverage:** N/A.

---

## Exekveringsplan

```
S40-0 (30 min, polish) -> S40-1 (45 min, flag + tester) -> S40-2 (30 min, docs)
```

**Total effort:** ~1.5-2h.

## Definition of Done (sprintnivå)

- [ ] S40-0/1/2 merged
- [ ] `npm run check:all` grön
- [ ] Visuell verifiering i dev-server + mobile-width
- [ ] Rollout-checklistan från S39-2 följd för `smart_replies` när vi senare sätter default: true
- [ ] Metrics-rapport post-sprint
