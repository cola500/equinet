---
title: "Agent-Team Guide"
description: "Guide for the 3 specialized review agents: security-reviewer, tech-architect, cx-ux-reviewer"
category: guide
tags: [agents, security-review, architecture, ux-review, workflow]
status: active
last_updated: 2026-03-16
related:
  - CLAUDE.md
  - docs/guides/gotchas.md
sections:
  - Agent-Översikt
  - Trigger-kriterier
  - Best Practices
  - Quick Reference
  - Relaterade Dokument
---

# Agent-Team Guide

> Equinet har **3 specialiserade agenter** som kompletterar den automatiserade kvalitetspipelinen.

## Innehåll

1. [Agent-Översikt](#agent-översikt)
2. [Trigger-kriterier](#trigger-kriterier)
3. [Best Practices](#best-practices)
4. [Quick Reference](#quick-reference)

---

## Agent-Översikt

| Agent | Ansvar | Trigger |
|-------|--------|---------|
| **security-reviewer** | Säkerhetsrevision (OWASP, auth, data) | Efter nya/ändrade API-routes |
| **tech-architect** | Arkitektur, datamodellering, performance | Nya features, schema-design, performance-problem |
| **cx-ux-reviewer** | UX/användarupplevelse | Efter nya sidor eller UI-flöden |

### Vad täcktes tidigare av borttagna agenter?

| Borttagen agent | Täcks nu av |
|-----------------|-------------|
| test-lead | TDD inbyggt i `/implement`-skillen |
| data-architect | Absorberad i **tech-architect** |
| quality-gate | Automatiserade hooks (Husky pre-push) + CI |
| performance-guardian | Absorberad i **tech-architect** |

---

## Trigger-kriterier

### security-reviewer

Kör **efter** att nya eller ändrade API-routes är implementerade:

- Nya endpoints i `src/app/api/`
- Ändrad auth-logik eller session-hantering
- Kod som hanterar PII eller känslig data
- Före deploy till produktion

`/implement`-skillen triggar automatiskt en påminnelse om security-review när API-routes ändrats.

### tech-architect

Kör **före** implementation när:

- Nya major features kräver arkitekturella beslut
- Nya datamodeller behöver designas (Prisma schema)
- Performance-problem behöver utredas (queries, caching, skalning)
- Flera relaterade features ska planeras tillsammans

### cx-ux-reviewer

Kör **efter** implementation när:

- Nya sidor skapats i `src/app/(protected)/` eller `src/app/(public)/`
- Nya bokningsflöden eller användarresor implementerats
- Befintliga UI-flöden ändrats väsentligt

`/implement`-skillen flaggar automatiskt när nya sidor skapats.

#### Visuell verifiering (efterföljande steg)

Efter cx-ux-reviewer har gett feedback, verifiera visuellt med **Playwright MCP**:

1. Starta worktree dev-server om du arbetar i worktree: `npx next dev -p 3001`
2. Skapa testdata via API-anrop (snabbare än att klicka genom UI)
3. Batcha screenshots: logga in -> navigera alla berörda sidor -> ta screenshots
4. Kontrollera: loading states, skeleton-vyer, 404-hantering, a11y-attribut, formatering, layoutskift
5. Fixa eventuella problem direkt

> **Tips**: Visuell verifiering är värt det för UI/UX -- inte för ren affärslogik eller backend-ändringar.

---

## Best Practices

### DO

- **Kör security-reviewer på alla nya API-routes** -- det är den enda agenten som har bevisat värde konsekvent
- **Kör tech-architect tidigt** -- före implementation, inte efter
- **Kör cx-ux-reviewer på nya sidor** -- fångar UX-problem innan användare gör det

### DON'T

- **Kör INTE agenter för saker som är automatiserade** -- lint, typecheck, svenska, coverage hanteras av hooks och CI
- **Kör INTE tech-architect för enkel CRUD** -- den är för arkitekturella beslut
- **Kör INTE cx-ux-reviewer för backend-ändringar** -- den är för användargränssnitt

---

## Quick Reference

```
Ny feature med arkitektur?   -> tech-architect (FÖRE implementation)
Nya API-routes?              -> security-reviewer (EFTER implementation)
Nya sidor/UI-flöden?         -> cx-ux-reviewer (EFTER implementation)
Datamodellering/Prisma?      -> tech-architect
Performance-problem?         -> tech-architect
Coverage/tester?             -> Automatiserat (CI + /implement)
DoD/kvalitetscheck?          -> Automatiserat (Husky + CI)
```

---

## Relaterade Dokument

- [CLAUDE.md](../CLAUDE.md) - Utvecklingsguide
- [GOTCHAS.md](GOTCHAS.md) - Vanliga problem och lösningar
