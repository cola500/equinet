export interface DemoPersona {
  /** Button text. */
  label: string
  /** Demo account email. */
  email: string
  /** Demo account password. */
  password: string
  /** Where to go after sign-in (use /dashboard to route per userType). */
  redirectTo: string
}

/**
 * Public demo credentials — intentionally hardcoded, not secret.
 *
 * Single source of truth for the demo personas so the login page and the
 * landing page always offer the same accounts (no credential duplication).
 * Both route via /dashboard, which sends each persona to the right start
 * (customer → /hem, provider → calendar) without hardcoding role redirects.
 */
export const DEMO_PERSONAS = {
  customer: {
    label: "Demo som hästägare",
    email: "lisa.andersson@gmail.com",
    password: "DemoOwner123!",
    redirectTo: "/dashboard",
  },
  provider: {
    label: "Demo som leverantör",
    email: "erik.jarnfot@demo.equinet.se",
    password: "DemoProvider123!",
    redirectTo: "/dashboard",
  },
} satisfies Record<string, DemoPersona>
