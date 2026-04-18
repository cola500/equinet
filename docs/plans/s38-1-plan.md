---
title: "S38-1: Messaging docs-complement (M7-gap)"
description: "Stäng M7-gap från S35-S37: testing-guide + NFR + security/messaging.md"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Approach
  - Risker
---

# S38-1: Messaging docs-complement

## Aktualitet verifierad

**Kommandon körda:**
- `grep -i "messaging\|meddelanden" docs/testing/testing-guide.md` → 0 träffar
- `grep "messaging\|RLS.*Conversation" NFR.md` → 0 träffar
- `ls docs/security/` → ingen messaging.md

**Beslut:** Fortsätt — alla tre gap bekräftade.

## Approach

1. `docs/testing/testing-guide.md` — lägg till messaging-scenario
2. `NFR.md` — lägg till messaging-RLS-rad + uppdatera testantal
3. `docs/security/messaging.md` — ny minimal fil med frontmatter

## Risker

N/A (ren docs-story, ingen kod).
