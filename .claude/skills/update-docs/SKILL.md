---
name: update-docs
description: Systematiskt uppdatera dokumentation efter en feature-implementation
argument-hint: "<kort beskrivning av feature, t.ex. 'offline mutation queue'>"
---

Uppdatera dokumentation efter implementation av: **$ARGUMENTS**

## 1. Inventera andringar

Kor dessa parallellt for att forsta vad som andrats:

```bash
git log --oneline -20         # Senaste commits
git diff main --stat          # Andrade filer (om pa feature branch)
npm run test:run -- --reporter=dot 2>&1 | tail -5  # Testantal
```

## 2. Checklista -- vilka dokument berors?

Ga igenom varje fil och bedom om den behovs uppdateras. Las filen FORST, redigera sedan.

| Fil | Uppdatera nar... |
|-----|-------------------|
| `docs/architecture/offline-pwa.md` | Offline-relaterade andringar (cache, sync, mutations, SW) |
| `docs/architecture/database.md` | Schemaaandringar (nya tabeller, falt, relationer) |
| `docs/guides/feature-docs.md` | Ny eller andrad anvandarvand funktionalitet |
| `docs/architecture/booking-flow.md` | Andringar i bokningsflode (status, betalning, avbokning) |
| `docs/plans/*.md` | Planerade features som nu ar implementerade -- markera som KLAR |
| `docs/guides/gotchas.md` | Ny gotcha upptackt under implementation |
| `README.md` | Ny feature, uppdaterat testantal, nya npm scripts |
| `NFR.md` | Ny production readiness-kapabilitet, uppdaterat testantal |
| `CLAUDE.md` | Ny key learning, ny snabbreferenslank |

## 3. Utfor uppdateringar

For varje relevant fil:

1. **Las filen** -- forsta befintlig struktur och stil
2. **Redigera minimalt** -- andra bara det som behovs, behall filens format
3. **Uppdatera testantal** bara om det andrats signifikant (50+ nya tester)
4. **Uppdatera datum** i filer som har "Senast uppdaterad"-falt

### Nyckelprinciper

- Las ALLTID filen innan redigering
- Behall filens befintliga stil och format
- Svenska med korrekta a, a, o i all text (utom MEMORY.md)
- Skapa ALDRIG nya docs-filer utan diskussion (utom retros via `/retro`)
- Lank till befintliga filer med relativa sokvagar

## 4. Verifiera

```bash
npm run typecheck         # 0 errors
npm run check:swedish     # Inga nya varningar
```

Kontrollera manuellt att:
- Alla filankar pekar pa filer som faktiskt finns
- Testantal ar konsistenta mellan README.md, NFR.md och CLAUDE.md
- Inga dubbla eller motstridiga uppgifter i olika dokument
