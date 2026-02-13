# Mobile Design Improvements Plan

## Overview
Improve the visual quality, brand identity, and UX of Equinet's mobile pages. Focus on the highest-impact changes that make the app feel polished and distinctive rather than generic.

## Phase 1: Skeleton Loaders (replace spinners)

### 1a. Create Skeleton loading components
- **File**: `src/components/ui/skeleton.tsx` -- already exists via shadcn, verify it's available
- **File**: `src/components/loading/BookingCardSkeleton.tsx` (NEW)
  - Skeleton that matches booking card layout: title line, description line, 2-col info grid, button row
  - Render 3 instances stacked vertically
- **File**: `src/components/loading/ProviderCardSkeleton.tsx` (NEW)
  - Skeleton that matches provider card: title, description, star rating line, services list, button
  - Render in same grid as actual cards (md:grid-cols-2 lg:grid-cols-3)
- **File**: `src/components/loading/HorseCardSkeleton.tsx` (NEW)
  - Skeleton with image square placeholder + title + description + button row
  - Render in same grid as actual horse cards

### 1b. Replace spinner loading states on key pages
- **File**: `src/app/customer/bookings/page.tsx`
  - Replace spinner div (line ~354-358) with `<BookingCardSkeleton count={3} />`
- **File**: `src/app/providers/page.tsx`
  - Replace spinner div (line ~676-680) with `<ProviderCardSkeleton count={6} />`
- **File**: `src/app/customer/horses/page.tsx`
  - Replace spinner div (line ~244-248) with `<HorseCardSkeleton count={3} />`
- **File**: `src/app/notifications/page.tsx`
  - Replace spinner div (line ~143-146) with notification skeleton (inline, simple rows)

**Tests**: No behavior change, existing tests should pass. Visual-only change.

## Phase 2: Collapse search filters on providers page (mobile)

### 2a. Refactor providers page search section
- **File**: `src/app/providers/page.tsx`
  - On mobile: Show ONLY the main search input + a "Filter" button with active filter count badge
  - "Filter" button opens a Drawer (use existing Drawer component) with:
    - City filter input
    - "Besöker område" input
    - Place search (ort/postnummer) + "Använd min position" button
    - Radius selector
    - "Visa resultat" button at bottom to close drawer
  - On desktop (md+): Keep current inline layout (no behavior change)
  - Show result count text below search: "{n} leverantörer" (or "Inga träffar")
  - Active filter chips remain visible below search on both mobile and desktop

**Tests**: Existing E2E tests may need minor selector adjustments if elements move into drawer. Check providers E2E spec.

## Phase 3: Booking card visual hierarchy with left-border status

### 3a. Add status-based left border to booking cards
- **File**: `src/app/customer/bookings/page.tsx`
  - Add `border-l-4` to each booking Card based on status:
    - pending: `border-l-yellow-400`
    - confirmed: `border-l-green-500`
    - cancelled: `border-l-red-400`
    - completed: `border-l-blue-400`
    - in_route: `border-l-purple-500`
  - First upcoming booking: Add subtle highlight (`bg-green-50/30` or similar)

### 3b. Upgrade filter tabs to segment control style
- **File**: `src/app/customer/bookings/page.tsx`
  - Wrap filter buttons in a `bg-gray-100 rounded-lg p-1 flex` container
  - Active tab: `bg-white shadow-sm rounded-md` pill style
  - Inactive: transparent, text-gray-600
  - Transition: `transition-all duration-200`

**Tests**: No behavior change, existing tests should pass. Selectors use text content, not styling.

## Phase 4: Brand colors and warm palette

### 4a. Update CSS custom properties
- **File**: `src/app/globals.css`
  - Change `--primary` from pure black (`oklch(0.205 0 0)`) to a deep forest green
  - Add custom brand CSS variables:
    - `--brand-green`: Deep forest green (e.g., `oklch(0.45 0.12 155)` ~ #2D5A3D)
    - `--brand-gold`: Warm gold accent (e.g., `oklch(0.75 0.1 85)` ~ #C9A96E)
    - `--brand-sand`: Warm sand background
  - Change background from cold gray to warm stone: slightly warmer `--background`

### 4b. Update components to use brand colors
- **File**: `src/components/layout/BottomTabBar.tsx`
  - Active color: from `text-green-600` to brand green (use CSS var or custom Tailwind class)
- **File**: `src/app/customer/bookings/page.tsx`
  - Filter tab active state: use brand green
- **File**: Global search-replace where `green-600` is used as primary action color
  - Create a Tailwind extend color `brand` in tailwind config OR use CSS variables
  - Approach: Add `brand` color to CSS vars, update key touchpoints (buttons stay `primary` which we're updating)

**Note**: Be surgical here. Only update the primary action green and background warmth. Don't touch status colors (yellow, red, blue, purple for booking states).

## Phase 5: Tab bar polish

### 5a. Improve bottom tab bar active state
- **File**: `src/components/layout/BottomTabBar.tsx`
  - Active tab: Add a small pill background behind icon+label (`bg-green-100/80 rounded-full px-3 py-1`)
  - Active icon: Scale up slightly via class (`h-[22px] w-[22px]` or similar with transition)
  - Tab bar background: `bg-white/90 backdrop-blur-lg` for glassmorphism effect
  - Add `transition-all duration-200` to tab items

**Tests**: No behavior change.

## Phase 6: Stagger animations on lists

### 6a. Add stagger animation utility
- **File**: `src/app/globals.css`
  - Add a `@keyframes fadeInUp` animation: `from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); }`
  - Add utility class `.animate-fade-in-up` with configurable `animation-delay`

### 6b. Apply to card lists
- **File**: `src/app/customer/bookings/page.tsx` -- each Card gets stagger style
- **File**: `src/app/providers/page.tsx` -- each provider Card
- **File**: `src/app/customer/horses/page.tsx` -- each horse Card
- **File**: `src/app/notifications/page.tsx` -- each notification Card
- Pattern: `style={{ animationDelay: `${index * 50}ms` }}` + `animate-fade-in-up` class
- Use `animation-fill-mode: both` so items start invisible

**Tests**: No behavior change.

## Out of Scope (future work)
- Typography change (requires Google Font addition + testing across all pages)
- Custom illustrations for empty states (requires design assets)
- Provider profile images/avatars
- Background textures/patterns
- Dark mode updates

## Definition of Done
- [ ] All skeleton loaders replace spinners on 4 key pages
- [ ] Provider search filters collapse into drawer on mobile
- [ ] Booking cards have status-colored left borders
- [ ] Filter tabs use segment control pattern
- [ ] Brand colors applied (warm green primary, warm background)
- [ ] Tab bar has pill active state + backdrop blur
- [ ] Stagger animations on card lists
- [ ] All existing unit tests pass
- [ ] All existing E2E tests pass (desktop project)
- [ ] No TypeScript errors
