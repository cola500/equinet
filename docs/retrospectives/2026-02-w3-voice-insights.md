# Vecka 3 Februari del 2: Röstloggning & Insikter (2026-02-13 -- 2026-02-16)

> Konsoliderad sammanfattning av 8 retrospectives från röstloggning, kundinsikter, infrastruktur och UX-förbättringar.

## Sammanfattning

| Session | Datum | Ämne | Filändringar | Tester | Resultat |
|---------|-------|------|--------------|--------|----------|
| 1 | 2026-02-13 | Vokabulärinlärning + dedikerad röstloggningssida | 10 ändrade, 5 nya | 29 nya (1630 totalt) | Chunk-baserad diff-algoritm för att fånga korrigeringar |
| 2 | 2026-02-13 | Röstloggning för fältleverantörer (MVP) | 10 nya | 101 nya (1601 totalt) | Web Speech API, AI-tolkning, Zod-validering av LLM-output |
| 3 | 2026-02-14 | Röstfunktioner UX-förbättringar | 10 ändrade, 1 ny | 3 nya (1633 totalt) | VoiceTextarea drop-in-replacement, FAB mobil, rikare LLM-kontext |
| 4 | 2026-02-15 | Claude Code Best Practices | 1 ändrad, 5 nya | 0 nya (1707 totalt) | Glob-matchade `.claude/rules/` från monolitisk CLAUDE.md |
| 5 | 2026-02-15 | Customer Insight Cards (kundinsikter) | 1 ändrad, 5 nya | 21 nya (1695 totalt) | AI-insikter (bokningsfrekvens, mönster, VIP-status) |
| 6 | 2026-02-15 | Plan Shift Left (kvalitetsstrategi) | 6 ändrade, 1 ny, 4 borttagna | 0 nya (1707 totalt) | 7 agenter -> 3, icke-blockerande planchecklista |
| 7 | 2026-02-16 | Kalender-UX-förbättringar | 9 ändrade, 2 nya tester | 16 nya (1765 totalt) | Now-line, statusikoner, kontextuell popup, click-outside-pattern |
| 8 | 2026-02-16 | Redis-backade feature flags + säkerhet | 14 ändrade, 8 nya | 42 nya (1749 totalt) | Redis-persistent flags för Vercel serverless, login rate limiting |

---

## Viktiga Learnings

### Röstloggning & AI-integrationer

**1. Defense-in-depth för AI-output-validering**
- Aldrig `as`-casts på LLM-output. Alltid Zod-schema med `.safeParse()`, `.default()`, `.transform()`.
- Referens-ID-validering mot känd context-lista förhindrar prompt injection.
- Graceful degradation: text-input fallback när Web Speech API inte stöds.

**2. Vokabulärinlärning via edit-diff**
- Spara `originalX` i state vid AI-tolkning. Vid bekräftelse, jämför med redigerat värde.
- Chunk-baserad diff (common prefix/suffix) är rätt abstraktion för enkla ändringar.
- Persistera max 50 termer (FIFO) som nullable String i databas, parse vid behov.

**3. Gransknings-först för AI-features**
- Innan merge: säkerhet (injection, rate limiting), arkitektur (error handling), UX (bulk-flöde).
- Hittade 6 blockerande problem i röstlogging-MVP som testning inte hade täckt.

### Designmönster & Arkitektur

**4. AI Service-mönster (tredje instansen)**
```
Constructor: { apiKey?: string } med env-fallback
Metod: async method(context): Promise<Result<T, Error>>
Zod-schema med .default() + .transform() + confidence clamping
stripMarkdownCodeBlock() för LLM-svar
Error-mapping till HTTP status
```
Mönstret har beprövats för: röstlogg-tolkning, snabbanteckningar, kundinsikter.

**5. Hook-extrahering för dialog -> sida**
1. Extrahera ALL state + handlers till custom hook
2. Lägg till ny state (t.ex. `originalWorkPerformed`)
3. Bygg sida som använder hooken
4. Refaktorera dialogen att använda samma hook
5. Uppdatera navigering (router.push istf setState)

**6. Ref-baserad click-outside-detection**
```tsx
// setTimeout(0) förhindrar att samma klick som öppnade popupen också stänger den
const timer = setTimeout(() => {
  document.addEventListener("mousedown", handleClickOutside)
}, 0)
```
Robustare än `stopPropagation` -- blockerar inte andra event-lyssnare.

**7. Undvik nästlade `<button>` -- använd `<div role="button">`**
Ren HTML + accessibility utan React-varningar. Lägg till `tabIndex={0}` + keyboard handler.

### Infrastruktur & Vercel

**8. In-memory state är illusion i serverless**
- In-memory state (session 19: runtime-settings) fungerar ALDRIG mellan requests på Vercel.
- MÅSTE använda Redis för shared state (feature flags, runtime config).
- Prioritetskedja: `env > Redis > in-memory > default` ger graceful degradation.

**9. Admin GET ska returnera actual state, inte raw storage**
- `getFeatureFlags()` (hela prioritetskedjan) = source of truth.
- `getAllRuntimeSettings()` (bara ett lager) kan visa felaktig state på Vercel.

**10. Constructor-mocking med Vitest**
```typescript
class MockRedis {
  get = mockRedisGet
  set = mockRedisSet
}
// Använd class, inte vi.fn().mockImplementation()
```

### Utvecklingsprocess & Dokumentation

**11. Glob-matchade rules-filer > monolitisk CLAUDE.md**
- `.claude/rules/*.md` med `paths:`-frontmatter laddar rätt regler vid rätt tillfälle.
- 467 rader -> 198 rader CLAUDE.md (57% reducering).
- Claude följer korta, kontextspecifika instruktioner bättre än långa.

**12. Automatisera objektiva regler, agentera subjektiva bedömningar**
- Objektiva: lint, coverage, svenska tecken-check -> CI/hooks.
- Subjektiva: säkerhet, arkitektur, UX -> agenter.
- 7 agenter -> 3 agenter utan funktionsförlust.

**13. Shift-left via icke-blockerande checklista**
- Steg 1b i `/implement`: flagga kvalitetsluckor utan att stoppa implementationen.
- Förebygger vanliga misstag (saknad rate limiting, fel språk, glömd `.strict()`) billigt.

---

## Nyckelmetrik

| Metrik | Värde | Trend |
|--------|-------|-------|
| Totala tester | 1749 | +148 från session 66 |
| Regressioner | 0 | Stabil |
| Typecheck errors | 0 | Stabil |
| Lint warnings | 0 | Stabil (sedan session 66) |
| Feature flags (PostgreSQL-backed) | 13 | Redis-persistent från session 8 |
| Agenter | 3 | 7 -> 3 (Session 6) |
| Rules-filer | 5 | `.claude/rules/` nytt från session 4 |

---

## Arkitektoniska Förbättringar

### Röstloggning-stack
- **MVP (session 2)**: Web Speech API + Anthropic Claude + Zod-validering
- **Iteration 1 (session 1)**: Vokabulärinlärning via edit-diff + dedikerad sida
- **Iteration 2 (session 3)**: VoiceTextarea drop-in-replacement, rikare LLM-kontext, bulk-flöde

### Feature Flag-arkitektur
- **Gen 1 (session 18)**: PostgreSQL-backed, client SSR, 30s cache
- **Gen 2 (session 8)**: Redis-persistent för Vercel, prioritetskedja env > Redis > in-memory > default

### Kalender-interaktioner
- **Gen 1**: Dialog-baserad, statisk vy
- **Gen 2 (session 7)**: Popup-baserad med kontextuell meny, now-line, statusikoner, hover-hints

---

## 5 Whys från Session 8

### Problem: Feature flag toggles kunde inte sättas tillbaka på Vercel

1. **Varför?** Admin UI visade fel state efter sidladdning (alla flaggor visades som PÅ)
2. **Varför?** `isFlagEnabled()` läste från `getAllRuntimeSettings()` som var tomt
3. **Varför?** `getAllRuntimeSettings()` är in-memory, och varje Vercel-instans startar med tomt minne
4. **Varför?** Runtime settings designades för single-process (lokal dev) och anpassades aldrig för serverless
5. **Varför?** Det saknades arkitekturell granskning av hur in-memory state beter sig i serverless

**Åtgärd:** Migrerat till Redis-backad state. Dokumenterat i GOTCHAS.md.

---

## Patterns Att Spara

| Pattern | Användning | Session |
|---------|-----------|---------|
| AI Service (constructor + Result + Zod + error-mapping) | Röstlogg, snabbanteckningar, kundinsikter | 2, 5 |
| Hook-extrahering (dialog -> sida) | Röstloggning, wizard-UI | 1 |
| VoiceTextarea drop-in-replacement | Alla textinmatningsfält | 3 |
| Ref-based click-outside | Popup-menyer | 7 |
| Redis för shared state | Feature flags, runtime config | 8 |
| Glob-matchade rules-filer | Kontextspecifik dokumentation | 4 |
| Shift-left checklist | Planering innan implementation | 6 |

---

## Öppna Förbättringar

| Prioritet | Ämne | Källa |
|-----------|------|--------|
| LÅGT | Diff-algoritmen hanterar bara en sammanhängande ändring | Session 1 |
| LÅGT | Transactional confirm-route för röstloggning | Session 2 |
| LÅGT | Caching av kundinsikter (24h TTL) | Session 5 |
| LÅGT | Popup-logik-duplicering mellan WeekCalendar/MonthCalendar | Session 7 |
| MEDEL | useVoiceWorkLog hook-tester med renderHook | Session 1 |
| MEDEL | VoiceTextarea unit-tester (rendering, feedback) | Session 3 |
| MEDEL | Silent Redis error handling i setFeatureFlagOverride | Session 8 |
| MEDEL | In-memory state i serverless dokumenteras som gotcha | Session 8 |
| HÖG | Staging-testning för serverless-specifik funktionalitet | Session 8 |

---

## Relaterade Dokument

- **Röstloggning:** `docs/guides/voice-logging.md`
- **Feature Flags:** `.claude/rules/feature-flags.md`
- **Database:** `docs/architecture/database.md`
- **Pentest:** `docs/security/pentest-2026-02-15.md`

---

*Originalfiler: [docs/archive/retrospectives-raw/](../archive/retrospectives-raw/)*
*Konsoliderat 2026-02-28*
