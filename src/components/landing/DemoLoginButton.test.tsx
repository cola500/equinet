import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { DemoLoginButton } from "./DemoLoginButton"

const mockSignInWithPassword = vi.fn()
const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

describe("DemoLoginButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders button with correct label", () => {
    render(<DemoLoginButton />)
    expect(screen.getByRole("button", { name: /se demo som leverantör/i })).toBeInTheDocument()
  })

  it("calls signInWithPassword with demo credentials on click", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    render(<DemoLoginButton />)

    fireEvent.click(screen.getByRole("button", { name: /se demo som leverantör/i }))

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "erik.jarnfot@demo.equinet.se",
        password: "DemoProvider123!",
      })
    })
  })

  it("redirects to provider dashboard on successful login", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    render(<DemoLoginButton />)

    fireEvent.click(screen.getByRole("button", { name: /se demo som leverantör/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/provider/dashboard")
    })
  })

  it("shows loading state during login", async () => {
    mockSignInWithPassword.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
    )
    render(<DemoLoginButton />)

    fireEvent.click(screen.getByRole("button", { name: /se demo som leverantör/i }))

    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("shows error message when login fails", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    })
    render(<DemoLoginButton />)

    fireEvent.click(screen.getByRole("button", { name: /se demo som leverantör/i }))

    await waitFor(() => {
      expect(screen.getByText(/kunde inte starta demo/i)).toBeInTheDocument()
    })
  })
})
