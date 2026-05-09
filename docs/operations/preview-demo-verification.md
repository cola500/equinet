---
title: "Preview Demo Verification — feature/s66-1-demo-consistency-smoke"
description: "Verifieringsstatus för Vercel preview-deploy av S66-1/S66-2. Programmatisk smoke blockeras av Vercel Deployment Protection — manuell browserbaserad demo är vägen framåt."
category: operations
status: active
last_updated: 2026-05-02
tags: [preview, vercel, demo-mode, deployment-protection, smoke]
sections:
  - 1. Branch och preview-URL
  - 2. Deploymentstatus
  - 3. Smoke-resultat
  - 4. Tolkning
  - 5. Rekommenderad podd-testväg
  - 6. Möjliga framtida förbättringar
---

# Preview Demo Verification

Kort verifieringsnote för demo-konsistens-smoke-slicen. **Ingen kodändring.** Bara observerad status.

---

## 1. Branch och preview-URL

| | |
|---|---|
| Branch | `feature/s66-1-demo-consistency-smoke` |
| Commits framför `main` | `fc41c1d5` (S66-1) + `5cb4ee06` (S66-2) |
| Preview-URL | `https://equinet-en0jro9dh-cola500s-projects.vercel.app` |
| Vercel-projekt | `cola500s-projects/equinet-app` |
| Verifierad | 2026-05-02 |

## 2. Deploymentstatus

Vercel rapporterar **Ready** för preview-deploymenten. Build-tid 2 min. Inget i Vercels logg pekar på app-byggfel.

## 3. Smoke-resultat

`APP_URL=<preview-url> npm run demo:check:prod`:

```
✓ APP_URL — https://equinet-en0jro9dh-cola500s-projects.vercel.app
✗ GET /login — HTTP 401
✗ GET /api/feature-flags — malformed JSON
Summary: 1 ok, 0 warn, 2 fail
```

Råa HTTP-headers från `/login`:

```
HTTP/2 401
content-type: text/html
server: Vercel
set-cookie: _vercel_sso_nonce=...
x-robots-tag: noindex
```

`/api/feature-flags` returnerar samma HTML-SSO-sida → JSON.parse failar i scriptet → "malformed JSON".

## 4. Tolkning

- **Det är inte ett app-fel.** Vercel Deployment Protection (preview-SSO) returnerar 401 + en HTML-redirect till Vercel-inlogg. Cookien `_vercel_sso_nonce` är signaturen.
- **Det är inte BotID.** Inga `x-vercel-mitigated`-headers. Prod-scenariot 2026-05-02 gav `429 + x-vercel-mitigated: challenge`. Preview-scenariot ger `401 + _vercel_sso_nonce`. Olika skyddslager, samma effekt på programmatisk smoke (blockerad).
- **Smoke-scriptet faller medvetet på 401.** Vår BotID-heuristik triggar specifikt på 429 + Vercel-headers, inte 401. Det är rätt design — 401 är en legitim signal som vi inte vill maskera.
- **Appen är inte verifierad trasig.** Vi vet inte ännu om demo-flödet fungerar i preview, bara att vi inte kunnat verifiera det programmatiskt.

## 5. Rekommenderad podd-testväg

För att verifiera demo i preview just nu — utan kodändring och utan ny infrastruktur:

1. Öppna `https://equinet-en0jro9dh-cola500s-projects.vercel.app/login` i browser.
2. Om Vercel-SSO-skärm visas: logga in med det Vercel-konto som äger `cola500s-projects`. Cookien sätts → fortsatta requests passerar.
3. Logga in i appen som demo-provider: `provider@example.com` / `ProviderPass123!`.
4. Walkthrough enligt `docs/demo-mode.md` "Demo-flöde (produktion)":
   - Dashboard — statistik, kommande bokningar, pending-förfrågan.
   - Bokningar — bekräfta pending, se historik.
   - Kunder — 4 kunder med hästar.
   - Tjänster — 4 tjänster.
   - Kalender — veckoöversikt.
5. Kontrollera att inga `DEMO-SEED`/`Test Testsson`/Registrera-knapp läcker (samma assertioner som `e2e/demo-flow.spec.ts`).

## 6. Möjliga framtida förbättringar

Inga av dessa är akuta. Lista för framtida bedömning:

- **Vercel Protection Bypass-token för automation.** Generera i Vercel UI → Project Settings → Deployment Protection → Protection Bypass for Automation. Skickas som `?x-vercel-protection-bypass=<token>` eller header. Då kan smoke köras programmatiskt mot preview.
- **Browserbaserad Playwright-verifiering med Vercel-cookie.** Sätt `_vercel_sso_nonce` (eller motsvarande efter SSO-flöde) i Playwright-context och kör `e2e/demo-flow.spec.ts` mot preview. Tyngre infrastruktur men ger fullständig E2E-täckning av preview.
- **WARN-hantering för 401 + `_vercel_sso_nonce` i smoke-scriptet.** Samma mönster som S66-2 BotID-detektion: detektera Vercel SSO-skydd och rapportera `⚠ WARN` ("Programmatic preview smoke blocked by Vercel Deployment Protection") istället för `✗ FAIL`. Liten ändring (~15 rader + tester). Värt att göra om vi börjar köra smoke mot preview rutinmässigt.

---

**Status:** Branch pushad, preview Ready, programmatisk verifiering blockerad av plattformsskydd. Manuell browserbaserad verifiering är rekommenderad väg framåt för podd-test.
