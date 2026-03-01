// CLIENT-SAFE: This file must NOT import server-only modules (Prisma, fs, etc).
// It is imported by both server code (feature-flags.ts) and client components (admin UI).

export interface FeatureFlag {
  key: string
  label: string
  description: string
  defaultEnabled: boolean
  /** Whether this flag should be exposed via the public API. Defaults to true. */
  clientVisible: boolean
}

export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  voice_logging: {
    key: "voice_logging",
    label: "Röstloggning",
    description: "Röstbaserad arbetsloggning med AI-tolkning",
    defaultEnabled: true,
    clientVisible: true,
  },
  route_planning: {
    key: "route_planning",
    label: "Ruttplanering",
    description: "Ruttplaneringsverktyg för leverantörer",
    defaultEnabled: true,
    clientVisible: true,
  },
  route_announcements: {
    key: "route_announcements",
    label: "Rutt-annonser",
    description: "Publicera och hantera rutt-annonser",
    defaultEnabled: true,
    clientVisible: true,
  },
  customer_insights: {
    key: "customer_insights",
    label: "Kundinsikter",
    description: "AI-genererade kundinsikter i kundregistret",
    defaultEnabled: true,
    clientVisible: true,
  },
  due_for_service: {
    key: "due_for_service",
    label: "Besöksplanering",
    description: "Planera och följ upp återkommande besök",
    defaultEnabled: true,
    clientVisible: true,
  },
  group_bookings: {
    key: "group_bookings",
    label: "Gruppbokningar",
    description: "Gruppbokningsfunktionalitet",
    defaultEnabled: true,
    clientVisible: true,
  },
  business_insights: {
    key: "business_insights",
    label: "Affärsinsikter",
    description: "Utökad analytics-sida med tjänsteanalys, tidsanalys och kundretention",
    defaultEnabled: true,
    clientVisible: true,
  },
  self_reschedule: {
    key: "self_reschedule",
    label: "Självservice-ombokning",
    description: "Kunder kan boka om sina bokningar utan att kontakta leverantören",
    defaultEnabled: true,
    clientVisible: true,
  },
  recurring_bookings: {
    key: "recurring_bookings",
    label: "Återkommande bokningar",
    description: "Möjlighet att skapa återkommande bokningsserier",
    defaultEnabled: true,
    clientVisible: true,
  },
  offline_mode: {
    key: "offline_mode",
    label: "Offlineläge",
    description: "PWA-stöd med offline-cachning av bokningar och rutter",
    defaultEnabled: true,
    clientVisible: true,
  },
  follow_provider: {
    key: "follow_provider",
    label: "Följ leverantör",
    description: "Kunder kan följa leverantörer och få notiser vid nya rutt-annonser",
    defaultEnabled: true,
    clientVisible: true,
  },
  municipality_watch: {
    key: "municipality_watch",
    label: "Bevaka kommun",
    description: "Kunder kan bevaka kommun + tjänstetyp och få notiser vid nya rutt-annonser",
    defaultEnabled: true,
    clientVisible: true,
  },
  provider_subscription: {
    key: "provider_subscription",
    label: "Leverantörsprenumeration",
    description: "Stripe-baserad prenumerationsavgift för leverantörer",
    defaultEnabled: false,
    clientVisible: true,
  },
  customer_invite: {
    key: "customer_invite",
    label: "Kundinbjudningar",
    description: "Leverantörer kan bjuda in manuellt tillagda kunder att skapa konto",
    defaultEnabled: false,
    clientVisible: false,
  },
}
