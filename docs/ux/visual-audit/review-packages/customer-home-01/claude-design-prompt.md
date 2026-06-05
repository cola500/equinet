You are a senior product designer. Evaluate design concepts for a NEW HOME screen for the
horse-owner persona in Equinet, and recommend a direction. This is a design review — not code.

PRODUCT
Equinet is an AI-assisted booking and coordination platform for equine services (farriers,
equine vets, equine therapists) in Sweden. The UI is in Swedish. Brand tone: practical,
trustworthy, calm — not playful or flashy. Primary colour is green (dark forest green), serif
display headings (DM Serif Display) over Inter body, shadcn/ui components. Keep the existing
visual language.

DIRECTION (already decided)
- The PROVIDER's home is the Calendar.
- The horse OWNER's home should be THEIR HORSES.
Today the owner has no home at all: after login they land on the public provider search, which
is the wrong mental model.

PERSONA & STORY
A Swedish horse owner (e.g. Lisa, 2 horses) who logs in roughly once a week. Her first question is:
"How are my horses — do I need to do anything?" The home must answer that in under 2 seconds:
is any horse OVERDUE for a visit (act), and when is the NEXT one booked (reassurance). Booking
and search are actions that follow from a horse's status — not the home itself.

WHAT'S ATTACHED
- wireframes.md: three low-fidelity concepts for a horse-led home:
  A. Horse-centric — horse cards lead; status + next/last visit inside each card; no separate alert.
  B. Mixed (horse-led) — a thin "needs attention" strip on top (overdue + next booking), then a
     compact horse grid, then a "find help" CTA.
  C. Action-first — leads with a to-do list (needs attention / book help / follow up history);
     horses lower down.
- 9 reference screenshots of the EXISTING UI (mobile + desktop): customer bookings, customer
  horses (with a per-horse due-status badge), horse profile + care history, public provider
  search, provider profile + book, and the "share horse profile with vet" dialog. These show the
  existing visual language and the components/data we want to reuse (horse cards, due badge,
  booking cards) — they are NOT home proposals.

DATA / HOOKS ALREADY AVAILABLE (assume these; no new backend)
- Horses (name, breed, age, photo) — useHorses() / GET /api/horses.
- Per-horse due status (overdue / upcoming / ok, days until due) — useDueForService() /
  GET /api/customer/due-for-service. This is the key "needs attention" signal and is ALREADY computed.
- Next/last booking — GET /api/bookings.
- Care history & notes (per horse) — for drill-down on the horse profile, not the home.

DELIVER
1. Which concept (A / B / C) — or a HYBRID — best fits a low-frequency Swedish horse owner, and why.
2. What MUST appear above the fold on MOBILE.
3. How to keep a calm, horse-near feel and AVOID a "dashboard"/to-do feel.
4. How to handle empty data (0 horses / 0 bookings) and many horses.
5. A recommended FIRST implementation slice (minimal MVP) — what to build first.
6. What screenshots/data are needed before implementation.
7. (If useful) a simple ASCII/wireframe sketch of your recommended layout, mobile-first.

CONSTRAINTS
- Mobile-first.
- No full redesign; reuse Equinet's existing visual language and components.
- No new business model.
- Prefer a small MVP that uses only the existing data/hooks listed above.
- Swedish product, horse owners in Sweden — copy suggestions in Swedish where relevant.
- Prioritise trygghet (reassurance), enkelhet (simplicity) and a horse-near feeling over feature density.

End with one open question for the product owner if a decision is genuinely theirs to make.
