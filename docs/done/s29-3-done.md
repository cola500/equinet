---
title: "S29-3 Done: Task.detached -> Task"
description: "Already fixed in S24-5"
category: retro
status: active
last_updated: 2026-04-17
sections:
  - Status
---

# S29-3 Done: Task.detached -> Task

## Status

**Redan åtgärdat.** Fixades i S24-5 (commit 4dc3feab) och verifierades i S27-6 (commit 40ab99b0).

Inga `Task.detached` finns i AuthManager eller PushManager. Grep över hela `ios/Equinet/Equinet/` bekräftar -- bara i extern dependency (swift-concurrency-extras).

## Acceptanskriterier

- [x] Inga `Task.detached` kvar i AuthManager eller PushManager
- [x] iOS-tester passerar (294/294)
