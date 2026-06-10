---
title: llms.txt Spike — Equinet och Portfolio
description: Read-only analys av om Equinet och Johans portfolio bör införa llms.txt-standarden. Bedömer värde, risker per yta (staging/repo/portfolio) och föreslår första-implementation. 2026-05-20.
category: research
status: active
last_updated: 2026-05-20
tags:
  - research
  - llms-txt
  - seo
  - ai-discovery
  - documentation
  - security
related:
  - ../security/security-sprint-continuity-2026-05.md
  - ../ux/equinet-system-map-2026-05.md
sections:
  - Vad är llms.txt
  - Värde per yta
  - Risker
  - Rekommenderad första implementation
  - Exempel-utkast
  - Vad som ALDRIG ska inkluderas
  - Sammanfattande beslutspunkter
  - Nästa steg
---

## Vad är llms.txt

Proposed standard (Jeremy Howard m.fl., 2024-2025) för att hjälpa LLM-baserade söktjänster (ChatGPT search, Perplexity, Claude search, Bing Copilot) att förstå en webbplats innehåll. En markdown-fil på rot (`/llms.txt`) med:

- H1-rubrik = sajt-namn
- Blockquote = kort beskrivning
- Markdown-sektioner med länkar till viktigaste sidor/docs

Skiljer sig från `robots.txt`:
- `robots.txt` = åtkomst-instruktioner ("crawla inte detta")
- `llms.txt` = navigations-/discovery-hjälp ("här är vad som är värt att förstå")

Stora aktörer som Anthropic, FastAPI, Cursor m.fl. har börjat publicera dessa.

---

## Värde per yta

### Equinet staging/demo — INTE rekommenderat

**Nästan inget värde, betydande risk.**

- Staging har redan `Disallow: /` i robots.txt (S-10 från Slice 1) — LLM-crawlers som respekterar robots ska inte besöka över huvud taget
- Men: vissa LLM-bots ignorerar robots.txt om de hittar `/llms.txt` (eftersom filen är specifikt opt-in)
- Det skulle motverka hela demo-isoleringen
- En llms.txt på staging skulle dessutom indexera demo-state, demo-user (Erik Järnfot), demo-bokningar

### Equinet repo/docs — OK som intern referens

**Lågt-medel värde, hanterbar risk om scope:as.**

- Repot är **publikt** på GitHub (`githubRepoVisibility: public` enligt Vercel-meta)
- Docs är därmed redan tekniskt åtkomliga via GitHub Search, men inte LLM-optimerade
- En `docs/llms.txt` (internt) skulle hjälpa **AI-utvecklarassistenter** (Claude Code, Copilot, Cursor) navigera repot:
  - Pekar på CLAUDE.md, docs/INDEX.md, architecture-docs
  - Skiljer mellan stabila docs och retros/sprint-arbete
- **Existerande motsvarigheter:** CLAUDE.md (primär entry-point) och `docs/INDEX.md` (docs-index) fyller liknande roll. En llms.txt skulle vara tunn additiv vinst.

### Johans personliga portfolio — Primär kandidat

**Högst värde, lägst risk.**

- Portfolio-innehåll är per definition publikt och marknadsförande
- LLM-baserade söktjänster blir bättre på att svara på "Vem är Johan Lindengard?", "Vad är Equinet?", "Berätta om en agilist som bygger med AI"
- Lyfter Equinet som case study
- Identifierar Johan som agilist + AI-engaged builder
- Inget känsligt — informationen finns redan publikt

---

## Risker

| Risk | Bedömning | Mitigation |
|------|-----------|------------|
| **Exponera intern säkerhetsdokumentation** | HÖG om feltänkt | Filtrera bort `docs/security/*`, `docs/retrospectives/*-security-*`, fixes.txt, pentest-rapporter |
| **Sensitive info i pentest-rapporter och remediation-backlog** | HÖG | `remediation-backlog-fixes-txt-2026-05.md` listar HIGH/MEDIUM-fynd som inte är fixade — får ALDRIG indexeras |
| **Demo-data + test-användare upptäcks via Equinet-llms.txt** | HÖG om på staging | Lägg inte llms.txt på staging över huvud taget |
| **Staging/prod-förvirring** | MEDIUM | Olika domäner — staging är `equinet-staging.johanlindengard.com`, prod blir `equinet.johanlindengard.com`. Skilj llms.txt per domän |
| **SEO/robots-konflikt på staging** | LÅG-MEDIUM | Staging har `Disallow: /`. Om llms.txt läggs där blir det paradox. Lös genom att inte lägga llms.txt på staging |
| **LLM-discovery av nuvarande svagheter** (t.ex. 3A.fu.5 prod-bucket-parity inte fixad än) | MEDIUM | Granska alla refererade filer manuellt innan publicering |
| **Versions-drift** mellan llms.txt och faktiska docs | LÅG | Underhåll som vanlig docs-fil med samma review-process |
| **Identitets-läckage** (test-användare, ID:n) | LÅG om filtrerat | Inga test-user-emails, inga UUID:s från staging-Supabase |

---

## Rekommenderad första implementation

| Plats | Status | Tidsplan |
|-------|--------|----------|
| **Johans portfolio (`johanlindengard.com/llms.txt`)** | ✅ **REKOMMENDERAS NU** | Kan göras direkt — separat repo/site, lågrisk |
| **`docs/llms.txt` i Equinet-repot (intern referens)** | 🟡 OK att börja experimentera | Som intern utvecklar-referens, ej publikt hostad. Pekar på stabila architecture-docs, ej security |
| **Publik `equinet.johanlindengard.com/llms.txt` (prod)** | ⏸ VÄNTA | Efter prod-launch + efter Sprint 3-B (H1-H10) + efter remediation-backlog är stängd |
| **Staging `equinet-staging.johanlindengard.com/llms.txt`** | ❌ ALDRIG | Bryter demo-isoleringen. Staging är `Disallow: /` |

---

## Exempel-utkast

### A) Portfolio (`johanlindengard.com/llms.txt`)

```markdown
# Johan Lindengard

> Agilist och produktchef som bygger AI-assisterade SaaS-produkter. Specialiserad
> på att designa arbetsprocesser där AI-agenter (Claude, GPT) genererar
> produktionskod under tydliga säkerhets- och kvalitetsgates.

## Aktuella projekt

- [Equinet](https://equinet.johanlindengard.com): Bokningsplattform för hästtjänster.
  Next.js, Prisma, Supabase. Hybrid iOS-app via WKWebView + SwiftUI.
  AI-assisterat utvecklingsflöde med dual-loop TDD och pre-commit secret scanning.

## Om mig

- [Om Johan](https://johanlindengard.com/om): Bakgrund som agilist, inte utvecklare.
  Designar AI-assisterad utveckling.
- [Kontakt](https://johanlindengard.com/kontakt): Hur du når mig.

## Skrivningar och case studies

- [Case: Equinet säkerhetshärdning](https://johanlindengard.com/case/equinet-security):
  Hur AI-assisterad sprint identifierade och stängde fyra CRITICAL-fynd över 48h.
- [Agile + AI playbook](https://johanlindengard.com/blog/agile-ai-playbook):
  Process-mönster för AI-genererad kod i produktion.

## Optional

- [GitHub](https://github.com/cola500): Publika repon
- [LinkedIn](https://linkedin.com/in/...): Professionell profil
```

### B) Equinet intern `docs/llms.txt` (ej hostad publikt)

```markdown
# Equinet — Developer Reference

> Bokningsplattform för hästtjänster. Next.js 16 + Prisma + Supabase Auth.
> Detta är en intern referens för AI-utvecklarassistenter (Claude Code,
> Cursor). Ladda denna fil för snabb orientering innan kodändringar.

## Primär entrypoint

- [CLAUDE.md](/CLAUDE.md): Process-guide, workflow, kodpreferenser
- [README.md](/README.md): Setup, kommandon, stack
- [docs/INDEX.md](/docs/INDEX.md): Docs-index

## Arkitektur

- [Code map](/.claude/rules/code-map.md): Domän till fil-mappning
- [Booking flow](/docs/architecture/booking-flow.md): Kärndomän
- [Patterns](/docs/architecture/patterns.md): Återanvändbara mönster
- [Refactor triggers](/docs/architecture/refactor-triggers.md): Vad utlöser refactor

## Testning och kvalitet

- [Testing rules](/.claude/rules/testing.md): BDD dual-loop
- [API route rules](/.claude/rules/api-routes.md): Säkerhetscheckista
- [Code review checklist](/.claude/rules/code-review-checklist.md)

## UX och systemkarta

- [System map](/docs/ux/equinet-system-map-2026-05.md): Alla routes, roller, flows
- [Mermaid diagrams](/docs/ux/equinet-mermaid-diagrams-2026-05.md): Visuella diagram

## Optional

- [Gotchas](/docs/guides/gotchas.md): Kända fallgropar
```

### C) Eventuell framtida publik Equinet (`equinet.johanlindengard.com/llms.txt`)

```markdown
# Equinet

> Booking platform for equine services in Sweden. Connect horse owners with
> farriers, veterinarians, and instructors. Recurring bookings, group bookings,
> route planning, integrated messaging and payments.

## For service providers

- [Become a provider](https://equinet.johanlindengard.com/register): Sign up flow
- [Find providers](https://equinet.johanlindengard.com/providers): Public search

## For customers

- [Open route stops](https://equinet.johanlindengard.com/announcements): Book farrier route stops nearby
- [Find stables](https://equinet.johanlindengard.com/stables): Stable directory

## About

- [Privacy policy](https://equinet.johanlindengard.com/integritetspolicy)
- [Terms of use](https://equinet.johanlindengard.com/anvandarvillkor)
```

(Detta utkast är **inte** klart för publicering — kräver beslut om vilken målgrupp, vilka publika sidor som ska lyftas, och launch-status.)

---

## Vad som ALDRIG ska inkluderas

| Kategori | Konkret innehåll |
|----------|------------------|
| **Säkerhetsdokumentation** | `docs/security/fixes.txt`, `docs/security/pentest-*.md`, `docs/security/remediation-backlog-*.md`, `docs/security/staging-security-audit-*.md`, `docs/security/zap-baseline-*.html`, `docs/security/PENTEST-REPORT-*.md` |
| **Sprint-retros med säkerhetsfynd** | `docs/retrospectives/2026-05-18-sprint-3a-security-remediation.md`, `docs/retrospectives/2026-05-06-block-2-staging-and-login-incident.md`, `docs/security/slice-1-2-retro.md` |
| **Continuity- och remediation-docs** | `docs/security/security-sprint-continuity-2026-05.md`, `docs/security/security-hardening-sprint-backlog.md`, `docs/security/sprint-closure-2026-05.md` |
| **Operational guides med interna detaljer** | `docs/operations/staging-environment-setup.md`, `docs/operations/feature-flag-rollout-checklist.md` |
| **Infrastructure-specifika** | `.env.example`, Vercel project-IDs, Supabase project-IDs (`xybyzflfxnqqyxnvjklv`, `zzdamokfeenencuggjjp`) |
| **Test- och demo-användare** | Erik Järnfot, andra seed-personas, mock-customer-IDs från staging |
| **fixes.txt-referenser** | Filen själv har skip-list-undantag i pre-commit-scanner, men dess innehåll exponerar exploit-vägar — får aldrig länkas |
| **Internal MFA/auth-implementation** | `docs/security/mfa-admin.md`, `docs/security/rls-findings.md` |
| **`/staging.*`-domäner** | Alla staging-URL:er |

---

## Sammanfattande beslutspunkter

| Fråga | Svar |
|-------|------|
| **Var hör llms.txt PRIMÄRT hemma?** | Johans portfolio. Publik, lågrisk, primärt värde |
| **Kan vi börja med intern `docs/llms.txt` i Equinet-repot?** | Ja, som AI-utvecklarreferens, ej hostad publikt. Lågrisk eftersom repot redan är publikt på GitHub |
| **När är publik Equinet-llms.txt aktuell?** | Efter prod-launch + Sprint 3-B + ZAP-regression. Inte före |
| **Staging?** | Aldrig |
| **Vilken konkret första-action?** | Skissa portfolio-llms.txt i Johans portfolio-repo (separat från detta repo) |
| **Underhållskostnad?** | Låg om filerna behandlas som vanliga docs med review |

---

## Nästa steg

1. **Johan beslutar** om portfolio-llms.txt ska implementeras (separat repo, ej i detta projekt)
2. Om JA: portfolio-llms.txt utkast (sektion A ovan) används som startpunkt
3. **Skjut upp** `docs/llms.txt` i Equinet-repot tills första iteration av portfolio-llms.txt validerats
4. **Lägg in återbesök** i security continuity-doc att utvärdera publik Equinet-llms.txt när 3B (H1-H10) är klar

**Inga ändringar gjorda i Equinet-repot utöver denna analys-fil.** Inga commits, inga pushar.
