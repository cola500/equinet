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
