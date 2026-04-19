---
title: "S41-0: Fix message-ordning"
description: "Klient-reverse i ThreadView + MessagingDialog så nyast renderas nederst"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Ändringar
  - Approach
  - Risker
---

# S41-0: Fix message-ordning

## Aktualitet verifierad

**Kommandon körda:** `grep -n "messages\.map\|\.reverse()"` i page.tsx + MessagingDialog.tsx; `grep orderBy PrismaConversationRepository.ts`
**Resultat:** Varken page.tsx eller MessagingDialog.tsx har `.reverse()`. Server returnerar `orderBy: desc`. Bug bekräftad i båda render-punkter.
**Beslut:** Fortsätt

## Ändringar

**Filer som ändras:**
- `src/app/provider/messages/[bookingId]/page.tsx` — lägg till `[...messages].reverse()`
- `src/components/customer/bookings/MessagingDialog.tsx` — samma

**Filer som skapas:**
- Tester för message-ordning (i befintliga testfiler eller nya)

## Approach

1. Hitta befintliga tester för ThreadView och MessagingDialog
2. Lägg till test "messages renderas i kronologisk ordning (äldst överst, nyast nederst)"
3. Kör → RED (saknar reverse)
4. Lägg till `[...messages].reverse()` i båda render-punkter
5. Kör → GREEN
6. Verifiera scrollIntoView/bottomRef fortfarande pekar på sista element
7. `npm run check:all`

## Risker

- `bottomRef` på sista element i listan: efter reverse pekar sista elementet på nyaste meddelandet — det är korrekt
- Mutation av props: använd spread `[...messages]` inte `messages.reverse()` direkt
