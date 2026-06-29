---
title: "Dependency Maintenance Backlog (npm audit)"
description: "Prioriterad plan för att beta av kvarvarande npm audit-advisories i små, verifierbara PR:er efter att Next.js high-DoS-fixen redan deployats till prod."
category: operations
status: active
last_updated: 2026-06-29
tags: [dependencies, security, npm-audit, tech-debt, maintenance]
related:
  - docs/sprints/backlog.md
sections:
  - Sammanfattning
  - Bakgrund
  - Inventering
  - Klassificering
  - Klusteranalys
  - Prioriterad plan (PR-slices)
  - Riskmatris
  - Checklista
  - Uppskjutet (hög risk)
  - Arbetssätt per PR
---

# Dependency Maintenance Backlog (npm audit)

> Underlag framtaget 2026-06-29 mot `main` @ `2c6af632` (Node 20, CI-paritet).
> **Inga uppgraderingar är gjorda här** — detta är ren analys + plan.

## Sammanfattning

Efter att den enda reellt prod-exponerade risken (Next.js high-severity DoS)
åtgärdats via `next` 16.1.7 → 16.2.9 (PR #431, live i prod) återstår **23
advisories**: 3 critical, 8 high, 11 moderate, 1 low.

**Inga av dessa är en drift-blocker.** De är koncentrerade till ett fåtal
"ägar-paket" (Sentry, Vitest, apns2, ESLint, standard-version). Nästan alla har
en fix **inom samma major** — den stora vinsten kommer från att bumpa ~6 direkta
beroenden, inte 23 transitiva. Två kräver större lyft (major-bump eller
verktygsbyte) och ett par bör utvärderas men troligen skjutas upp.

Rekommendation: beta av i **8 små PR:er** ordnade efter (allvarlighet åtgärdad ×
låg risk). De fem första är låg risk och rensar merparten av critical/high.

## Bakgrund

- Next.js 16.2.9 är deployad till production och verifierad (high-DoS borta).
- Kvarvarande advisories hanteras som separat maintenance-slice (denna doc).
- Hela arbetet ska göras utan `npm audit fix --force` och utan breda
  blind-uppgraderingar — en ägar-dep per PR, audit-delta verifieras efteråt.

## Inventering

23 kvarvarande advisories (audit mot `main`, Node 20):

| Severity | Paket | Advisory (kort) |
|----------|-------|-----------------|
| critical | fast-jwt | Accepterar okända `crit`-headers (RFC 7515-brott) |
| critical | handlebars | JavaScript Injection via AST Type Confusion |
| critical | vitest | Godtycklig filläsning/-exekvering när Vitest UI-server lyssnar |
| high | flatted | Unbounded recursion DoS i `parse()` |
| high | lodash | Code Injection via `_.template` |
| high | minimatch | ReDoS via upprepade wildcards |
| high | picomatch | Method Injection i POSIX-teckenklasser |
| high | rollup | Arbitrary File Write via Path Traversal |
| high | undici | WebSocket 64-bit length-overflow → parser-krasch |
| high | vite | Path Traversal i optimized deps `.map`-hantering |
| high | ws | Uninitialized memory disclosure + DoS från små fragment |
| moderate | @opentelemetry/core | Unbounded memory i W3C Baggage-propagering |
| moderate | @opentelemetry/instrumentation-http | (via @opentelemetry/core) |
| moderate | @opentelemetry/resources | (via @opentelemetry/core) |
| moderate | @opentelemetry/sdk-trace-base | (via @opentelemetry/core) |
| moderate | @sentry/nextjs | (via @sentry/node + @sentry/webpack-plugin) |
| moderate | @sentry/node | (via @opentelemetry/instrumentation-http) |
| moderate | @sentry/webpack-plugin | (via uuid) |
| moderate | brace-expansion | Zero-step sequence → process-hang/minnesutmattning |
| moderate | js-yaml | Quadratic-complexity DoS i merge-key-hantering |
| moderate | postcss | XSS via oescapad `</style>` i CSS-stringify |
| moderate | uuid | Saknad buffer-bounds-check i v3/v5/v6 |
| low | @babel/core | Arbitrary File Read via sourceMappingURL-kommentar |

`next` listas fortfarande som **moderate** men enbart för att den buntar
`postcss` (`next.via = ["postcss"]`) — Next.js egen kod har **noll** kvarvarande
advisories.

## Klassificering

Runtime/dev avser hur paketet faktiskt används i Equinet, inte bara var i
`package.json` det står.

| Paket | Typ | Direkt/Transitiv | Exploaterbar i Equinets användning? |
|-------|-----|------------------|--------------------------------------|
| fast-jwt | **runtime** (apns2) | transitiv | Nej — apns2 *signerar* JWT till Apple; vulnen gäller lax *verifiering* |
| undici | **runtime** (apns2) | transitiv | Nej — HTTP/2-klient utåt mot Apple, inte ws-server |
| ws | runtime (supabase) + dev (jsdom, bundle-analyzer) | transitiv | Nej — klient utåt mot betrodd Supabase; vulnen drabbar ws-*server* |
| postcss | build (next/tailwind) | transitiv | Nej — bygger egen CSS, ingen otrusted input vid runtime |
| @sentry/nextjs (+node, +otel ×4, +uuid) | **runtime** (felmonitorering) | dir + transitiv | Marginellt — otel-baggage minnesallokering |
| vitest, vite, rollup, flatted, picomatch | dev/test/build | dir + transitiv | Nej — kör aldrig i prod; vitest-vuln kräver UI-server på nätet |
| handlebars, lodash | dev (standard-version) | transitiv | Nej — release-verktyg, körs lokalt på egna mallar |
| minimatch, js-yaml, brace-expansion | dev (eslint) | transitiv | Nej — lint/build-verktyg |
| @babel/core | dev/build | transitiv | Nej — build-tid på egen kod |

**Slutsats:** ingen av de 23 är exploaterbar i Equinets faktiska runtime-användning.
De är tech-debt/hygien, inte aktiv risk — vilket motiverar att hantera dem som
planerat underhåll snarare än hotfix.

## Klusteranalys

Advisories grupperar sig under ett fåtal direkta "ägar-paket". Att bumpa ägaren
drar med de transitiva fixarna:

| Ägar-dep (i package.json) | Nuv. → mål | Drar med (advisories som rensas) | Fix-typ |
|---------------------------|------------|----------------------------------|---------|
| `@sentry/nextjs` (dep) | 10.36.0 → 10.62.0 | @opentelemetry/* ×4, @sentry/node, @sentry/webpack-plugin, uuid, rollup, picomatch, @babel/core | samma major |
| `apns2` (dep) | 12.2.0 (oförändrad) | fast-jwt → 6.2.4, undici → 7.28 (apns2 tillåter redan dessa) | transitiv patch |
| `vitest` + `@vitest/ui` + `@vitest/coverage-v8` (dev) | 4.0.18 → 4.1.9 | vitest, vite, flatted, picomatch | samma major |
| `standard-version` (dev, **deprecerad**) | 9.5.0 → ersätt | handlebars, lodash | verktygsbyte |
| `@supabase/supabase-js` (dep) | 2.101.1 → 2.108.2 | ws (runtime-kedjan) | samma major |
| `@next/bundle-analyzer` (dev) | 16.1.7 → 16.2.9 | ws (dev-kedjan, via webpack-bundle-analyzer) | samma major |
| `eslint` / `@eslint/eslintrc` (dev) | 9.x | minimatch, js-yaml, brace-expansion | transitiv patch (helst) / major (vid behov) |
| `@tailwindcss/postcss` (dev) | 4 → 4.3.1 | postcss (+ next-moderate via postcss) | samma major |

## Prioriterad plan (PR-slices)

Ordnad efter (allvarlighet åtgärdad × låg risk). En ägar-dep per PR; verifiera
audit-delta + `check:all` + relevant smoke efter varje.

1. **PR-A — `@sentry/nextjs` 10.36.0 → 10.62.0** (LÅG, runtime)
   Störst utdelning: rensar ~9 advisories (otel ×4, @sentry/node,
   @sentry/webpack-plugin, uuid + ev. rollup/picomatch/babel) i en samma-major-bump.
   Verifiera: build + Sentry error-capture-smoke (test-event når Sentry).

2. **PR-B — apns2-transitiver: fast-jwt 6.2.4 + undici 7.28** (LÅG, runtime)
   Rensar fast-jwt (critical) + undici (high). apns2 behöver **inte** ändras —
   dess ranges (`fast-jwt ^6.0.1`, `undici ^7.9.0`) tillåter redan patcharna.
   Styr via riktad `npm update fast-jwt undici` eller `overrides`. **Inte** audit fix.
   Verifiera: build + PushDeliveryService-tester + (om möjligt) en push-sandbox.

3. **PR-C — Vitest-svit 4.0.18 → 4.1.9** (`vitest`, `@vitest/ui`, `@vitest/coverage-v8`) (MEDEL, dev)
   Rensar vitest (critical), vite (high), flatted (high), picomatch. Dev-only men
   rör testkedjan → kör **hela** sviten + coverage. Medel p.g.a. blast-radius i CI.

4. **PR-D — Ersätt `standard-version` → `commit-and-tag-version`** (MEDEL, dev)
   Rensar handlebars (critical) + lodash (high). standard-version är övergiven;
   `commit-and-tag-version` är en underhållen drop-in-fork. Byt dep + `release*`-scripts
   i package.json. Verifiera: `npm run release -- --dry-run` ger korrekt changelog/tagg.

5. **PR-E — `@supabase/supabase-js` 2.101.1 → 2.108.2** (LÅG, runtime)
   Rensar ws på runtime-kedjan. Verifiera: build + realtime/auth-smoke.

6. **PR-F — `@next/bundle-analyzer` 16.1.7 → 16.2.9** (LÅG, dev)
   Rensar ws på dev-kedjan (webpack-bundle-analyzer). Verifiera: `npm run analyze`.

7. **PR-G — `@tailwindcss/postcss` 4 → 4.3.1** (LÅG, build)
   Rensar postcss (moderate) + tar bort `next`-moderate (som bara hängde på postcss).
   Verifiera: build + visuell stickprovskontroll av styling.

8. **PR-H — ESLint-transitiver: minimatch, js-yaml, brace-expansion** (MEDEL, dev)
   Försök först transitiv patch inom eslint 9 (`npm update` + ev. `overrides`).
   Endast om det inte räcker: utvärdera eslint 9 → 10 (MAJOR, se Uppskjutet).
   Verifiera: `npm run lint` på hela repot.

## Riskmatris

| Risk | PR | Motivering |
|------|-----|-----------|
| **LÅG** | A (Sentry), B (apns2-transitiver), E (supabase-js), F (bundle-analyzer), G (tailwind/postcss) | Samma major / patch inom range, isolerad blast-radius, verifierbar med build + riktad smoke. |
| **MEDEL** | C (vitest), D (standard-version-byte), H (eslint-transitiver) | C rör testinfra (hela CI-sviten); D är verktygsbyte med scriptändring; H kan tvingas till transitiv-override-pyssel. Inga API-brott väntade men kräver noggrann verifiering. |
| **HÖG** | (uppskjutet) `@vitejs/plugin-react` 5 → 6, `eslint` 9 → 10 | Major-bumpar med risk för config/plugin-brott. Ska bara göras om samma-major-vägen inte rensar respektive advisory — annars onödig risk. |

## Checklista

Prioriterad ordning (kryssa av när respektive PR är mergad + audit-delta verifierad):

- [ ] **PR-A** `@sentry/nextjs` → 10.62.0 (LÅG) — rensar otel ×4, uuid, @sentry/node, @sentry/webpack-plugin (+ ev. rollup/picomatch/babel)
- [ ] **PR-B** apns2-transitiver: fast-jwt 6.2.4 + undici 7.28 (LÅG) — rensar fast-jwt (critical) + undici (high)
- [ ] **PR-C** Vitest-svit → 4.1.9 (MEDEL) — rensar vitest (critical), vite, flatted, picomatch
- [ ] **PR-D** standard-version → commit-and-tag-version (MEDEL) — rensar handlebars (critical) + lodash (high)
- [ ] **PR-E** `@supabase/supabase-js` → 2.108.2 (LÅG) — rensar ws (runtime)
- [ ] **PR-F** `@next/bundle-analyzer` → 16.2.9 (LÅG) — rensar ws (dev)
- [ ] **PR-G** `@tailwindcss/postcss` → 4.3.1 (LÅG) — rensar postcss + next-moderate
- [ ] **PR-H** ESLint-transitiver (MEDEL) — rensar minimatch (high), js-yaml, brace-expansion
- [ ] **Slutaudit** — bekräfta 0 critical/high kvar; dokumentera ev. medvetet kvarlämnade

## Uppskjutet (hög risk)

Görs **endast** om samma-major-vägen ovan inte rensar respektive advisory:

- **`eslint` 9 → 10** (MAJOR) — flat config används redan, men major lint-bump kan
  bryta regler/plugins. Föredra transitiv patch i PR-H.
- **`@vitejs/plugin-react` 5 → 6** (MAJOR) — endast om vitest 4.1.9 inte drar med en
  fixad `vite`. Verifiera mot React 19 + vitest-setup.

## Arbetssätt per PR

1. Branch från `main` (aldrig staging — undvik att blanda in Slice 1-arbetet).
2. Ändra **en** ägar-dep (eller en riktad override) — inget bredare.
3. `npm install` (Node 20 = CI-paritet), bekräfta minimal lockfile-diff.
4. `npm run check:all` + `npm run build` + riktad smoke per PR ovan.
5. `npm audit` — dokumentera delta (vilka advisories försvann).
6. PR mot `main`, vänta in full CI (E2E ingår på main-PR:er), merga, verifiera prod.
7. **Aldrig** `npm audit fix --force`; **aldrig** blind multi-paket-bump.
