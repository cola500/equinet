import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HelpCenter } from "./HelpCenter"

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe("HelpCenter", () => {
  it("renders section headings for customer role", () => {
    render(<HelpCenter role="customer" basePath="/customer/help" />)

    expect(screen.getByText("Hjälp")).toBeInTheDocument()
    expect(screen.getByText("Bokningar")).toBeInTheDocument()
    expect(screen.getByText("Hästar")).toBeInTheDocument()
  })

  it("renders section headings for provider role", () => {
    render(<HelpCenter role="provider" basePath="/provider/help" />)

    expect(screen.getByText("Hjälp")).toBeInTheDocument()
    expect(screen.getByText("Bokningar")).toBeInTheDocument()
  })

  it("renders section headings for admin role", () => {
    render(<HelpCenter role="admin" basePath="/admin/help" />)

    expect(screen.getByText("Hjälp")).toBeInTheDocument()
    expect(screen.getByText("Hantering")).toBeInTheDocument()
  })

  it("renders search input", () => {
    render(<HelpCenter role="customer" basePath="/customer/help" />)

    expect(
      screen.getByPlaceholderText("Sök bland artiklar...")
    ).toBeInTheDocument()
  })

  it("renders article cards with links", () => {
    render(<HelpCenter role="customer" basePath="/customer/help" />)

    const link = screen.getByRole("link", { name: /Boka en tjänst/i })
    expect(link).toHaveAttribute("href", "/customer/help/boka-en-tjanst")
  })

  it("filters articles when searching", async () => {
    const user = userEvent.setup()
    render(<HelpCenter role="customer" basePath="/customer/help" />)

    const searchInput = screen.getByPlaceholderText("Sök bland artiklar...")
    await user.type(searchInput, "häst")

    await waitFor(() => {
      expect(screen.getByText(/artiklar matchar/)).toBeInTheDocument()
    })
  })

  it("shows empty state for no matching search", async () => {
    const user = userEvent.setup()
    render(<HelpCenter role="customer" basePath="/customer/help" />)

    const searchInput = screen.getByPlaceholderText("Sök bland artiklar...")
    await user.type(searchInput, "xyznonexistent123")

    await waitFor(() => {
      expect(
        screen.getByText("Inga artiklar matchade din sökning.")
      ).toBeInTheDocument()
    })
  })
})
