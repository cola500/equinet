import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MunicipalitySelect } from "./municipality-select"

// Mock municipality search
vi.mock("@/lib/geo/municipalities", () => ({
  searchMunicipalities: (query: string) => {
    const all = [
      { name: "Kungsbacka", county: "Halland" },
      { name: "Kungälv", county: "Västra Götaland" },
      { name: "Göteborg", county: "Västra Götaland" },
    ]
    return all.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
  },
}))

describe("MunicipalitySelect", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    placeholder: "Sök kommun...",
  }

  describe("ARIA attributes", () => {
    it("has combobox role on input", () => {
      render(<MunicipalitySelect {...defaultProps} />)
      const input = screen.getByRole("combobox")
      expect(input).toBeInTheDocument()
    })

    it("has aria-expanded=false when closed", () => {
      render(<MunicipalitySelect {...defaultProps} />)
      const input = screen.getByRole("combobox")
      expect(input).toHaveAttribute("aria-expanded", "false")
    })

    it("has aria-expanded=true when open with results", async () => {
      const user = userEvent.setup()
      render(<MunicipalitySelect {...defaultProps} />)
      const input = screen.getByRole("combobox")
      await user.type(input, "Kung")
      expect(input).toHaveAttribute("aria-expanded", "true")
    })

    it("has aria-autocomplete=list on input", () => {
      render(<MunicipalitySelect {...defaultProps} />)
      const input = screen.getByRole("combobox")
      expect(input).toHaveAttribute("aria-autocomplete", "list")
    })

    it("has aria-controls pointing to listbox", async () => {
      const user = userEvent.setup()
      render(<MunicipalitySelect {...defaultProps} />)
      const input = screen.getByRole("combobox")
      await user.type(input, "Kung")
      expect(input).toHaveAttribute("aria-controls", "municipality-listbox")
    })

    it("renders listbox with correct role and id", async () => {
      const user = userEvent.setup()
      render(<MunicipalitySelect {...defaultProps} />)
      await user.type(screen.getByRole("combobox"), "Kung")
      const listbox = screen.getByRole("listbox")
      expect(listbox).toHaveAttribute("id", "municipality-listbox")
    })

    it("renders options with role=option", async () => {
      const user = userEvent.setup()
      render(<MunicipalitySelect {...defaultProps} />)
      await user.type(screen.getByRole("combobox"), "Kung")
      const options = screen.getAllByRole("option")
      expect(options).toHaveLength(2) // Kungsbacka, Kungälv
    })

    it("sets aria-activedescendant on arrow down", async () => {
      const user = userEvent.setup()
      render(<MunicipalitySelect {...defaultProps} />)
      const input = screen.getByRole("combobox")
      await user.type(input, "Kung")
      await user.keyboard("{ArrowDown}")
      expect(input).toHaveAttribute("aria-activedescendant", "municipality-option-0")
    })

    it("marks selected option with aria-selected", async () => {
      const user = userEvent.setup()
      render(<MunicipalitySelect {...defaultProps} value="Kungsbacka" />)
      await user.clear(screen.getByRole("combobox"))
      await user.type(screen.getByRole("combobox"), "Kung")
      const options = screen.getAllByRole("option")
      expect(options[0]).toHaveAttribute("aria-selected", "true")
      expect(options[1]).toHaveAttribute("aria-selected", "false")
    })
  })
})
