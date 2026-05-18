---
title: Figma MCP-spike
description: Utvärdering av community-MCP (figma-developer-mcp) för design->kod-flöde mot Equinet. Slutsats: tekniken funkar, men Equinet är inte moget för Figma-driven workflow ännu.
category: spike
status: closed
last_updated: 2026-05-18
sections:
  - Hypotes
  - Vad vi testade
  - Vad som fungerade
  - Vad som inte fungerade
  - Varför vi inte fortsätter nu
  - När det kan bli relevant igen
  - Tekniska lärdomar (för framtida MCP-arbete)
---

# Figma MCP-spike (2026-05-18)

## Hypotes

> "Figmas MCP kan ge oss design->kod-konvertering i Claude Code och korta tiden från mockup till komponent."

## Vad vi testade

- **Community-MCP** `figma-developer-mcp` v0.11.0 (GLips/Figma-Context-MCP) — REST API + Personal Access Token. Funkar med gratis Figma-konto.
- **Inte testat:** Figmas officiella Dev Mode MCP (kräver Pro+ seat).
- Konfigurerade MCP i `.mcp.json`, först med env-substitution via `${FIGMA_API_KEY}` i `.env.local` + wrapper-script. När det failade: hårdkodad token + `.mcp.json` i `.gitignore`.
- Läste en test-fil — först en tom grå rektangel, sedan en Material 3 XR App Bar från Figma Community.
- Översatte M3 App Bar till en React/Tailwind-komponent som demonstration.

## Vad som fungerade

- **MCP startade och svarade.** Data kommer tillbaka kompakt (`globalVars` med style-referenser istället för uppblåsta objekt) — bra för token-användning.
- **Tre nivåer av styrning:** `fileKey`, `nodeId`, `depth` — kan hämta specifika frames utan att dra hela filen.
- **Design->kod-översättning gav ~70% användbar kod direkt.** Layout (flex, padding, gap) översätts rakt till Tailwind. Färgvärden kommer som hex. Komponentnamn ("Headline", "Leading icon") ger semantik.

## Vad som inte fungerade

- **`${ENV_VAR}`-substitution i `.mcp.json` expanderas inte i Claude Code.** Tom token skickades till MCP-processen, Figma svarade `403 Invalid token`. Tog tre omstarts-rundor + en `5 Whys`-analys att hitta. Lösningen blev hårdkodad token + gitignore.
- **Community-MCP är read-only.** Verktygen är `get_figma_data` och `download_figma_images`. Inga skriv-verktyg. Att "skapa något i Figma från Claude" går inte via denna kanal — bara via Figma Dev Mode MCP (Pro+) eller egen Plugin.
- **Material 3 ≠ shadcn.** Test-filen drog in M3-tokens från Figma Community (Roboto-font, M3 surface-colors). Equinet använder shadcn + Inter. Den genererade komponenten behövde manuell mappning mot vårt design-system.
- **Ikon-broar är manuella.** Figma exporterar SVG via `download_figma_images`, men då tappar vi lucide-konsistens. Alternativt: mappa ikonnamn (`menu` -> `lucide Menu`) på fri hand.
- **Token-säkerhetsmodellen skalar dåligt i team.** Varje utvecklare måste skapa egen Personal Access Token och hårdkoda i sin lokala `.mcp.json` (gitignored). Inget delningsbart team-flöde.

## Varför vi inte fortsätter nu

Den verkliga flaskhalsen är **inte tekniken** — utan **design-org-mognaden**:

- Equinet har **ingen Figma-driven designprocess** idag. Vi designer i kod, eller i ad-hoc-mockups.
- Utan **delade design-tokens** mellan Figma och shadcn ger MCP:n en mismatch som kostar mer att rätta till än den sparar.
- Spiken konsumerade en hel session på debugging av token-flöde och säkerhetsmodell — för en feature vi inte kan använda i nuvarande arbetsläge.

Cost/benefit nu: **negativ**.

## När det kan bli relevant igen

Återkom till det här om något av följande triggas:

1. **Vi börjar designa i Figma med ett library som matchar shadcn-tokens** (egenbyggt eller community).
2. **Vi går till Figma Pro+** för Dev Mode MCP — då blir flödet officiellt supporterat och token-flödet enklare.
3. **En designer kommer in i teamet** som faktiskt producerar Figma-mockups regelbundet.

Tidigast trigger: när designflöde mognar i Equinet. Ingen aktiv watch — vi tar upp det igen när någon av ovan inträffar.

## Tekniska lärdomar (för framtida MCP-arbete)

Värt att komma ihåg när nästa MCP-server övervägs:

- **`${ENV_VAR}` i `.mcp.json` expanderas inte** i Claude Code. Antingen hårdkoda + gitignore, eller använd MCP-server som tar config via egen mekanism (t.ex. HTTP-MCP med OAuth).
- **`403 Invalid token` är tvetydigt.** Snabbaste isoleringssteg: direkt `curl -H "X-Figma-Token: $TOKEN" https://api.figma.com/v1/me`. Funkar `/v1/me` är token giltig — problemet ligger då i MCP-processens env eller filspecifika behörigheter.
- **Hemligheter i `.mcp.json` betyder filen måste gitignoras** — vilket bryter team-delning av övriga MCP-servrar. För Equinet idag spelar det ingen roll (vi delar inte `.mcp.json` ändå), men det är värt att veta vid större team.
- **Community-MCP:s säkerhetsmodell är inte teamfärdig.** Personlig token utan utgångstid, per utvecklare. Acceptabelt för spike, inte för produktion.

---

**Författare:** Spike körd av Claude tillsammans med Johan, 2026-05-18.
**Relaterade dokument:** `.gitignore` (`.mcp.json` är gitignored som efterspel av spiken).
