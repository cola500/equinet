---
title: "S4-4: UX-polish native -- haptic feedback"
description: "Lagg till sensoryFeedback pa alla native-vyer for konsekvent haptics"
category: plan
status: active
last_updated: 2026-04-01
sections:
  - Audit
  - Approach
  - Andringar
---

# S4-4: UX-polish native

## Audit

Alla 7 native-vyer har loading, empty, error och pull-to-refresh.
Enda saknade monster: **haptic feedback** -- bara NativeDueForServiceView har det.

## Approach

Lagg till `.sensoryFeedback()` pa 5 vyer (1-2 rader per vy).
Inga nya filer, inga tester paverkade (visuell/haptic feedback ar inte testbart i XCTest).
Verifiering: bygg + visuell kontroll i simulator.

## Andringar

| Vy | Feedback | Trigger |
|----|----------|---------|
| NativeDashboardView | `.sensoryFeedback(.success, trigger:)` | `viewModel.todayBookings.count` |
| NativeBookingsView | `.sensoryFeedback(.selection, trigger:)` | `viewModel.selectedFilter` |
| NativeCustomersView | `.sensoryFeedback(.selection, trigger:)` | `viewModel.selectedFilter` |
| NativeServicesView | `.sensoryFeedback(.success, trigger:)` | `viewModel.services.count` |
| NativeReviewsView | `.sensoryFeedback(.success, trigger:)` | `viewModel.reviews.count` |

Stationsflode: Green -> Verify -> Merge
