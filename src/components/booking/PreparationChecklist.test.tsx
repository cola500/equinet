import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { PreparationChecklist } from "./PreparationChecklist"
import { PREPARATION_CHECKLIST } from "@/lib/preparation-checklist"

describe("PreparationChecklist", () => {
  it("renders heading", () => {
    render(<PreparationChecklist />)
    expect(screen.getByText("Inför besöket")).toBeInTheDocument()
  })

  it("renders all checklist items", () => {
    render(<PreparationChecklist />)
    for (const item of PREPARATION_CHECKLIST) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
  })

  it("renders exactly 4 items", () => {
    render(<PreparationChecklist />)
    const listItems = screen.getAllByRole("listitem")
    expect(listItems).toHaveLength(4)
  })
})
