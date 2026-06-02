---
title: "Deployment Verification Guide"
description: "Var verifierar man vad? Snabb beslutsguide för staging/prod-isolation, demo-läge och varför equinet-staging-app feature-branch-previews blir 'Canceled by Ignored Build Step' (förväntat)."
category: operations
status: active
last_updated: 2026-06-02
tags: [deployment, verification, staging, demo-mode, vercel, branch-isolation]
depends_on:
  - docs/operations/environments.md
  - docs/operations/staging-environment-setup.md
related:
  - docs/operations/demo-setup.md
  - docs/operations/preview-demo-verification.md
sections:
  - Quick Decision Tree
  - Environment Mapping
  - Important Rules
  - Common Confusions
  - Verification Matrix
  - Architecture Decision Record
---

# Deployment Verification Guide

> **Syfte:** sluta återupptäcka hur staging/prod-isolationen fungerar. Om du ska verifiera
> en demo-UX-ändring — läs detta först, börja inte gräva i Vercel-loggar.

---

## Quick Decision Tree

```
Provider Demo UX?
  → Verifiera på STAGING
  → https://equinet-staging.johanlindengard.com

Demo mode (demo_mode aktivt)?
  → Endast STAGING (equinet-staging-app). Inte prod, inte feature-previews.

Feature-branch-preview för demo-UX?
  → INTE en giltig verifieringsmiljö (se nedan).

"Varför är equinet-staging-app-previewen CANCELED?"
  → Förväntat. Ignored Build Step. Branch-isolationen fungerar.

Vill du se ändringen FÖRE merge?
  → A) Lokal demo-mode (NEXT_PUBLIC_DEMO_MODE=true), eller
  → B) Merge till staging och verifiera på staging-domänen.
```

---

## Environment Mapping

| Branch | Vercel-projekt | Syfte | Custom domain |
|--------|----------------|-------|----------------|
| `main` | **equinet-app** | Produktion | `equinet.johanlindengard.com` |
| `staging` | **equinet-staging-app** | Demo / Staging | `equinet-staging.johanlindengard.com` |

Verifierat 2026-06-02 via Vercel API (`get_project`): `equinet-staging-app` äger domänen
`equinet-staging.johanlindengard.com`. Det är två **separata** Vercel-projekt med varsin
Production Branch.

> **OBS — drift mot [environments.md](./environments.md):** environments.md (2026-05-08)
> beskriver en tidigare uppsättning där *ett* projekt (`equinet-app`) serverade båda
> domänerna via Host-header-routing. Det stämmer inte längre — staging-domänen serveras nu
> av det dedikerade projektet `equinet-staging-app`. Den här guiden gäller vid konflikt.

---

## Important Rules

- **Demo-UX verifieras endast på staging** (`equinet-staging.johanlindengard.com`).
- **equinet-app-previews är INTE demo-verifiering.** Prod-projektet bygger previews för alla
  branches, men där är `demo_mode` inte aktivt → du ser vanlig provider-vy, inte demon.
- **equinet-staging-app bygger endast `staging`-branchen.** Feature-branches ignoreras
  medvetet av staging-projektet (kostnads-/isolationskontroll).
- **Feature-branch-previews på staging-projektet kan bli "Canceled by Ignored Build Step".**
  Det är **önskat beteende**, inte ett fel.
- **Inga Vercel-config-ändringar** för att kringgå detta utan uttryckligt beslut — det
  motverkar isolationen.

---

## Common Confusions

**"Previewen fungerar i equinet-app men inte i staging-projektet — är staging trasigt?"**
Nej. equinet-app bygger previews för alla branches; equinet-staging-app bygger bara sin
Production Branch (`staging`) och avbryter resten via Ignored Build Step.

**"demo_mode saknas i previewen."**
`demo_mode` är aktivt på equinet-staging-app (staging). equinet-app-previewen kör utan det
→ full login-form (med "Registrera dig"/"Glömt lösenord"), ingen DemoLoginButton, vanlig
provider-nav. Det är rätt — det är inte demomiljön.

**"En CANCELED deploy står i PR-checkarna — har något gått sönder?"**
Nej. Checken rapporterar oftast "pass" (Ignored Build Step = skip = grönt), men själva
deploymenten markeras `CANCELED` med `target: null` och en bygg-tid på ~9 sekunder. Det är
signaturen för en avsiktligt skippad build.

**Sidonot (separat gap, G1):** equinet-app-previewens *auth* kan nå staging-Supabase (man
kan logga in som en staging-användare i en equinet-app-preview). Det är den kända
DATABASE_URL/Supabase-delningen i [staging-environment-setup.md](./staging-environment-setup.md)
(G1/G2) — inte relevant för demo-UX-verifiering, men förklarar varför login ibland "funkar"
i en preview där det inte borde spela roll.

---

## Verification Matrix

| Scenario | Verifiera här |
|----------|---------------|
| Demo-UX | **staging** (`equinet-staging.johanlindengard.com`) |
| Demo-navigation | **staging** |
| Demo-läge (demo_mode-beteende) | **staging** |
| Feature-branch-kod (logik) | **PR + tester** (`npm run check:all`, render-/unit-tester) |
| Produktions-UX | **equinet-app** (`equinet.johanlindengard.com`) |
| Pre-merge visuell demo-koll | **lokal demo-mode** (`NEXT_PUBLIC_DEMO_MODE=true`) |

---

## Architecture Decision Record

### ADR: Demo Mode Verification

**Status:** Accepterad (2026-06-02).

**Kontext:** Demo-läget (`demo_mode`) styr en förenklad provider-vy avsedd för
pilot-demos. Det är env-gate:at på staging-projektet och finns inte i prod eller i
prod-projektets feature-previews. Det ledde upprepade gånger till förvirring kring var
demo-UX ska verifieras och varför staging-projektets feature-previews blir CANCELED.

**Beslut:** Demo-läge är **endast garanterat aktivt** i:

- Vercel-projekt: **equinet-staging-app**
- Branch: **staging**
- Domän: **equinet-staging.johanlindengard.com**

**Konsekvenser:**

- Feature-branch-previews är **inte** en giltig verifieringsmiljö för demo-UX.
- `"Canceled by Ignored Build Step"` på staging-projektet är **normalt och önskat**.
- Demo-UX får **inte** valideras i equinet-app-previews.
- För pre-merge-verifiering: använd lokal `NEXT_PUBLIC_DEMO_MODE=true`, eller merga till
  `staging` och verifiera på staging-domänen.

**Verifieringskällor:** komponentnivå via tester (PR), live demo-beteende via staging.
