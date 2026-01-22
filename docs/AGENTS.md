# Agent-Team Guide

> Equinet har **7 specialiserade agenter** som tacker alla kritiska områden från MVP till produktion.

## Innehåll

1. [Agent-Översikt](#agent-översikt)
2. [När Använda Vilken Agent](#när-använda-vilken-agent)
3. [Agent-Kombinationer](#agent-kombinationer-för-olika-uppgifter)
4. [Best Practices](#best-practices-arbeta-med-agenter)
5. [Quick Reference](#quick-reference)
6. [Exempel-Scenarios](#exempel-scenarios)

---

## Agent-Översikt

| Agent | Färg | Ansvar | Använd när |
|-------|------|--------|------------|
| **security-reviewer** | Red | Säkerhetsrevision (OWASP, auth, data) | Efter nya API endpoints, före produktion |
| **cx-ux-reviewer** | Blue | UX/användarupplevelse | Efter UI-implementering, användarresor |
| **tech-architect** | Purple | Arkitektur & teknisk planering | Nya features, performance-problem |
| **test-lead** | Cyan | Test-strategi & TDD-workflow | Efter feature-implementation, coverage-gap |
| **data-architect** | Green | Prisma schema & datamodellering | Nya datamodeller, query-optimering |
| **quality-gate** | Yellow | DoD-verifiering & release management | Före merge, före release |
| **performance-guardian** | Orange | Performance & observability | Performance-problem, monitoring-design |

---

## När Använda Vilken Agent

### security-reviewer

- Efter implementerat ny auth-logik eller API-endpoints
- Före deploy till produktion
- När API exponerar känslig user data
- Efter säkerhetskritisk kod (payment, PII)

### cx-ux-reviewer

- Efter implementerat bokningsformulär eller användarflöde
- När UX-feedback behövs proaktivt
- Efter nya UI-komponenter
- Vid användbarhetsproblem

### tech-architect

- Nya major features som kräver arkitekturella beslut
- Performance-problem som påverkar skalning
- "Ska vi implementera caching nu eller senare?" - Data-driven beslut
- "Vilken arkitektur för pagination?" - Jämför alternativ
- **Inte för:** Enkel buggfix, UI-tweaks

### test-lead

- Efter feature-implementation - "Är testerna tillräckliga?"
- Coverage-rapport visar gap - "Vad saknas?"
- Komplex test-scenario - "Hur testar jag conditional fields?"
- TDD-planering - "Vilka tester ska jag skriva först?"

### data-architect

- Nya datamodeller - "Hur designar jag schema för länkade bokningar?"
- Performance-problem - "Vilka indexes behövs?"
- Query-optimering - "Är detta N+1 problem?"
- Migration-planering - "SQLite till PostgreSQL, vad krävs?"

### quality-gate

- Före merge - "Uppfyller vi DoD?"
- Före release - "Är vi redo för v1.4.0?"
- Breaking changes - "Vad påverkas?"
- Pre-push check - "Allt grönt?"

### performance-guardian

- Performance-problem - "Varför är dashboard långsam?"
- Production-förberedelse - "Hur implementerar vi monitoring?"
- Skalningsplanering - "Klarar vi 1000 samtidiga användare?"
- Caching-strategi - "Ska vi cacha provider-listan?"

---

## Agent-Kombinationer för Olika Uppgifter

### Sprint-Planering
```
tech-architect (arkitektur & roadmap)
+ data-architect (datamodellering)
+ performance-guardian (skalbarhet)
```

### Feature-Implementation (TDD-workflow)
```
1. test-lead (designa tester FÖRST)
2. [Implementera feature]
3. quality-gate (DoD-verifiering)
4. security-reviewer (om säkerhetskritisk)
```

### Pre-Merge Checklist
```
quality-gate (DoD compliance)
+ security-reviewer (om säkerhetskritisk kod)
+ test-lead (coverage-kontroll)
```

### Performance-Optimering
```
performance-guardian (bottleneck-identifiering)
+ data-architect (query-optimering, indexes)
+ tech-architect (caching-strategi)
```

### UX/Design Review
```
cx-ux-reviewer (användarupplevelse)
+ test-lead (E2E-tester för user flows)
```

---

## Best Practices: Arbeta med Agenter

### DO

- **Använd agenter proaktivt** - Inte bara när problem uppstår
- **Kombinera agenter** - Låt flera agenter granska olika aspekter
- **Följ rekommendationer** - Agenter är byggda på projekt-specifik kunskap
- **Dokumentera learnings** - Uppdatera CLAUDE.md med nya insights från agenter

### DON'T

- **Skippa quality-gate** - DoD existerar av en anledning
- **Ignorera security-reviewer** - Säkerhet är kritisk
- **Vänta med test-lead** - TDD = tests först, inte efteråt

---

## Quick Reference

```
Nya features?        -> tech-architect + data-architect + test-lead
Performance issue?   -> performance-guardian + data-architect
Säkerhetsaudit?      -> security-reviewer
UX-feedback?         -> cx-ux-reviewer
Coverage-gap?        -> test-lead
Före merge?          -> quality-gate
Datamodellering?     -> data-architect
Hitta kod?           -> Explore (eller Read om du vet fil)
```

---

## Exempel-Scenarios

### Scenario 1: Ny Feature "Payment Integration"

```
1. tech-architect    -> Analysera arkitektur och tredjepartsberoenden
2. data-architect    -> Designa schema för transactions och invoices
3. test-lead         -> Planera test-suite (TDD!)
4. [Implementera feature med TDD]
5. security-reviewer -> Granska PCI-compliance och säkerhet
6. quality-gate      -> Verifiera DoD innan merge
```

### Scenario 2: "Dashboard är långsam"

```
1. performance-guardian -> Identifiera bottleneck
2. data-architect       -> Analysera queries och föreslå indexes
3. tech-architect       -> Designa caching-strategi om behövs
4. test-lead            -> Lägg till performance-regression tests
```

### Scenario 3: "Klar att deploya v1.4.0?"

```
1. quality-gate         -> Pre-release checklist
2. security-reviewer    -> Final security audit
3. performance-guardian -> Verifiera monitoring är redo
4. test-lead            -> Konfirmera alla tester passerar
```

---

## Relaterade Dokument

- [CLAUDE.md](../CLAUDE.md) - Utvecklingsguide
- [GOTCHAS.md](GOTCHAS.md) - Vanliga problem och lösningar
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Bidragsguide
