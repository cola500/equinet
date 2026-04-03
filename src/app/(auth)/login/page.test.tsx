import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Mock Supabase browser client
const mockSignInWithPassword = vi.fn()
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}))

// Mock native bridge
const mockRequestMobileToken = vi.fn().mockResolvedValue(undefined)
vi.mock("@/lib/native-bridge", () => ({
  requestMobileTokenForNative: () => mockRequestMobileToken(),
}))

// Mock demo mode
vi.mock("@/lib/demo-mode", () => ({
  isDemoMode: vi.fn().mockReturnValue(false),
}))

// Mock client logger
vi.mock("@/lib/client-logger", () => ({
  clientLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()
let mockSearchParams = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
}))

// Mock sonner toast
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

import LoginPage from "./page"
import { isDemoMode } from "@/lib/demo-mode"
const mockIsDemoMode = vi.mocked(isDemoMode)

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    mockIsDemoMode.mockReturnValue(false)
  })

  function renderLogin() {
    render(<LoginPage />)
  }

  describe("Rendering", () => {
    it("renders email and password fields", () => {
      renderLogin()

      expect(screen.getByLabelText("Email")).toBeInTheDocument()
      expect(screen.getByLabelText("Lösenord")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Logga in" })).toBeInTheDocument()
    })

    it("shows register link when not in demo mode", () => {
      renderLogin()

      expect(screen.getByText("Registrera dig här")).toBeInTheDocument()
      expect(screen.getByText("Glömt lösenord?")).toBeInTheDocument()
    })

    it("hides register and forgot password links in demo mode", () => {
      mockIsDemoMode.mockReturnValue(true)
      renderLogin()

      expect(screen.queryByText("Registrera dig här")).not.toBeInTheDocument()
      expect(screen.queryByText("Glömt lösenord?")).not.toBeInTheDocument()
    })
  })

  describe("Successful login", () => {
    it("calls Supabase signInWithPassword and redirects to dashboard", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: "u1" }, session: { access_token: "tok" } },
        error: null,
      })

      renderLogin()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "password123")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password123",
        })
        expect(mockPush).toHaveBeenCalledWith("/dashboard")
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it("requests mobile token on successful login", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: "u1" }, session: { access_token: "tok" } },
        error: null,
      })

      renderLogin()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "password123")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(mockRequestMobileToken).toHaveBeenCalled()
      })
    })

    it("redirects to callbackUrl if provided and starts with /", async () => {
      mockSearchParams = new URLSearchParams("callbackUrl=/provider/calendar")
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: "u1" }, session: { access_token: "tok" } },
        error: null,
      })

      renderLogin()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "password123")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/provider/calendar")
      })
    })

    it("ignores callbackUrl that does not start with /", async () => {
      mockSearchParams = new URLSearchParams("callbackUrl=https://evil.com")
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: "u1" }, session: { access_token: "tok" } },
        error: null,
      })

      renderLogin()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "password123")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard")
      })
    })
  })

  describe("Error handling", () => {
    it("shows error on invalid credentials", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials", status: 400 },
      })

      renderLogin()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "wrong")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(screen.getByText("Ogiltig email eller lösenord")).toBeInTheDocument()
      })
    })

    it("shows email not verified message with resend link", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Email not confirmed", status: 400 },
      })

      renderLogin()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "password123")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(screen.getByText(/inte verifierad/)).toBeInTheDocument()
        expect(screen.getByText("Skicka nytt verifieringsmail")).toBeInTheDocument()
      })
    })

    it("shows generic error on network failure", async () => {
      mockSignInWithPassword.mockRejectedValue(new Error("Network error"))

      renderLogin()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "password123")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(screen.getByText(/gick fel/)).toBeInTheDocument()
      })
    })

    it("disables submit button while loading", async () => {
      mockSignInWithPassword.mockReturnValue(new Promise(() => {}))

      renderLogin()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Lösenord"), "password123")
      await user.click(screen.getByRole("button", { name: "Logga in" }))

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Loggar in..." })).toBeDisabled()
      })
    })
  })

  describe("Search params toasts", () => {
    it("shows success toast when registered=true", () => {
      mockSearchParams = new URLSearchParams("registered=true")
      renderLogin()

      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Kontot har skapats"),
        expect.any(Object)
      )
    })

    it("shows success toast when verified=true", () => {
      mockSearchParams = new URLSearchParams("verified=true")
      renderLogin()

      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("verifierats"),
        expect.any(Object)
      )
    })
  })
})
