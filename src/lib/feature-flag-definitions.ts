// CLIENT-SAFE: This file must NOT import server-only modules (Prisma, fs, etc).
// It is imported by both server code (feature-flags.ts) and client components (admin UI).

export type FeatureFlagCategory = "provider" | "customer" | "shared"

export interface FeatureFlag {
  key: string
  label: string
  description: string
  defaultEnabled: boolean
  /** Whether this flag should be exposed via the public API. Defaults to true. */
  clientVisible: boolean
  category: FeatureFlagCategory
}

export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  voice_logging: {
    key: "voice_logging",
    label: "Röstloggning",
    description: "Röstbaserad arbetsloggning med AI-tolkning",
    defaultEnabled: true,
    clientVisible: true,
    category: "provider",
  },
  route_planning: {
    key: "route_planning",
    label: "Ruttplanering",
    description: "Ruttplaneringsverktyg för leverantörer",
    defaultEnabled: true,
    clientVisible: true,
    category: "provider",
  },
  route_announcements: {
    key: "route_announcements",
    label: "Rutt-annonser",
    description: "Publicera och hantera rutt-annonser",
    defaultEnabled: true,
    clientVisible: true,
    category: "provider",
  },
  customer_insights: {
    key: "customer_insights",
    label: "Kundinsikter",
    description: "AI-genererade kundinsikter i kundregistret",
    defaultEnabled: true,
    clientVisible: true,
    category: "provider",
  },
  due_for_service: {
    key: "due_for_service",
    label: "Besöksplanering",
    description: "Planera och följ upp återkommande besök",
    defaultEnabled: true,
    clientVisible: true,
    category: "provider",
  },
  group_bookings: {
    key: "group_bookings",
    label: "Gruppbokningar",
    description: "Gruppbokningsfunktionalitet",
    defaultEnabled: true,
    clientVisible: true,
    category: "provider",
  },
  business_insights: {
    key: "business_insights",
    label: "Affärsinsikter",
    description: "Utökad analytics-sida med tjänsteanalys, tidsanalys och kundretention",
    defaultEnabled: true,
    clientVisible: true,
    category: "provider",
  },
  self_reschedule: {
    key: "self_reschedule",
    label: "Självservice-ombokning",
    description: "Kunder kan boka om sina bokningar utan att kontakta leverantören",
    defaultEnabled: true,
    clientVisible: true,
    category: "customer",
  },
  recurring_bookings: {
    key: "recurring_bookings",
    label: "Återkommande bokningar",
    description: "Möjlighet att skapa återkommande bokningsserier",
    defaultEnabled: true,
    clientVisible: true,
    category: "provider",
  },
  offline_mode: {
    key: "offline_mode",
    label: "Offlineläge",
    description: "PWA-stöd med offline-cachning av bokningar och rutter",
    defaultEnabled: true,
    clientVisible: true,
    category: "shared",
  },
  follow_provider: {
    key: "follow_provider",
    label: "Följ leverantör",
    description: "Kunder kan följa leverantörer och få notiser vid nya rutt-annonser",
    defaultEnabled: true,
    clientVisible: true,
    category: "customer",
  },
  municipality_watch: {
    key: "municipality_watch",
    label: "Bevaka kommun",
    description: "Kunder kan bevaka kommun + tjänstetyp och få notiser vid nya rutt-annonser",
    defaultEnabled: true,
    clientVisible: true,
    category: "customer",
  },
  provider_subscription: {
    key: "provider_subscription",
    label: "Leverantörsprenumeration",
    description: "Stripe-baserad prenumerationsavgift för leverantörer",
    defaultEnabled: false,
    clientVisible: true,
    category: "provider",
  },
  customer_invite: {
    key: "customer_invite",
    label: "Kundinbjudningar",
    description: "Leverantörer kan bjuda in manuellt tillagda kunder att skapa konto",
    defaultEnabled: false,
    clientVisible: true,
    category: "provider",
  },
  push_notifications: {
    key: "push_notifications",
    label: "Push-notiser",
    description: "Skicka push-notiser via APNs till iOS-appen",
    defaultEnabled: false,
    clientVisible: false,
    category: "shared",
  },
  help_center: {
    key: "help_center",
    label: "Hjälpcentral",
    description: "Inbyggd hjälpcentral med sökbara artiklar per roll",
    defaultEnabled: true,
    clientVisible: true,
    category: "shared",
  },
  stable_profiles: {
    key: "stable_profiles",
    label: "Stallprofiler",
    description: "Stallägare kan skapa profiler, publicera stallplatser och bjuda in hästägare",
    defaultEnabled: false,
    clientVisible: true,
    category: "shared",
  },
  stripe_payments: {
    key: "stripe_payments",
    label: "Stripe-betalningar",
    description: "Betalning via Stripe (kort/Swish) i bokningsflödet",
    defaultEnabled: false,
    clientVisible: true,
    category: "shared",
  },
  demo_mode: {
    key: "demo_mode",
    label: "Demo-läge",
    description: "Strippar ner UI:t till kärnflödet: dashboard, bokningar, kunder, tjänster. Döljer alla sekundära features.",
    defaultEnabled: false,
    clientVisible: true,
    category: "shared",
  },
  supabase_auth_poc: {
    key: "supabase_auth_poc",
    label: "Supabase Auth PoC",
    description: "Aktiverar test-route för Supabase Auth proof-of-concept",
    defaultEnabled: false,
    clientVisible: false,
    category: "shared",
  },
  data_retention: {
    key: "data_retention",
    label: "GDPR datalagring",
    description: "Automatisk radering av inaktiva konton efter 2 år + 30 dagars varning",
    defaultEnabled: false,
    clientVisible: false,
    category: "shared",
  },
}
