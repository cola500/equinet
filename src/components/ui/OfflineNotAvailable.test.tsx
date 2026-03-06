import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { OfflineNotAvailable } from "./OfflineNotAvailable"

describe("OfflineNotAvailable", () => {
  it("renders offline message with page name", () => {
    render(<OfflineNotAvailable pageName="Affärsinsikter" />)

    expect(screen.getByText("Ej tillgänglig offline")).toBeInTheDocument()
    expect(
      screen.getByText("Affärsinsikter kräver internetanslutning och kan inte användas offline.")
    ).toBeInTheDocument()
    expect(screen.getByTestId("offline-not-available")).toBeInTheDocument()
  })

  it("does not render a retry button", () => {
    render(<OfflineNotAvailable pageName="Export" />)

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
