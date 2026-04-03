import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Mock feature flag (server-side)
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
}))

// Mock Supabase browser client
const mockSignInWithPassword = vi.fn()
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}))

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockRedirect = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  redirect: (...args: unknown[]) => {
    mockRedirect(...args)
    throw new Error("NEXT_REDIRECT")
  },
}))

import { isFeatureEnabled } from "@/lib/feature-flags"
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

describe("Supabase Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  describe("Feature flag gate", () => {
    it("redirects to /login when supabase_auth_poc flag is disabled", async () => {
      mockIsFeatureEnabled.mockResolvedValue(false)

      const { default: SupabaseLoginPage } = await import("./page")

      await expect(async () => {
        // The server component calls redirect() which throws
        await SupabaseLoginPage()
      }).rejects.toThrow("NEXT_REDIRECT")

      expect(mockRedirect).toHaveBeenCalledWith("/login")
      expect(mockIsFeatureEnabled).toHaveBeenCalledWith("supabase_auth_poc")
    })
  })

  describe("Login form", () => {
    // Helper to render the client form component directly
    async function renderForm() {
      const { SupabaseLoginForm } = await import("./SupabaseLoginForm")
      render(<SupabaseLoginForm />)
    }

    it("renders email and password fields", async () => {
      await renderForm()

      expect(screen.getByLabelText("Email")).toBeInTheDocument()
      expect(screen.getByLabelText("Lösenord")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Logga in" })).toBeInTheDocument()
    })

    it("shows error on invalid credentials", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials", status: 400 },
      })

      await renderForm()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "wrongpassword")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(screen.getByText("Ogiltig email eller lösenord")).toBeInTheDocument()
      })
    })

    it("shows email not verified message", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Email not confirmed", status: 400 },
      })

      await renderForm()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "password123")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(screen.getByText(/inte verifierad/)).toBeInTheDocument()
      })
    })

    it("redirects to dashboard on successful login", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: "user-1", email: "test@example.com" },
          session: { access_token: "token" },
        },
        error: null,
      })

      await renderForm()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "password123")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard")
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it("disables submit button while loading", async () => {
      // Never resolve to keep loading state
      mockSignInWithPassword.mockReturnValue(new Promise(() => {}))

      await renderForm()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "password123")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Loggar in..." })).toBeDisabled()
      })
    })

    it("shows generic error on unexpected failure", async () => {
      mockSignInWithPassword.mockRejectedValue(new Error("Network error"))

      await renderForm()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "password123")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(screen.getByText(/gick fel/)).toBeInTheDocument()
      })
    })
  })
})
