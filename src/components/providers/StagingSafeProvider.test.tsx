import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { StagingSafeProvider, useStagingSafe } from "./StagingSafeProvider"

function Probe() {
  const safe = useStagingSafe()
  return <span>{safe ? "staging-safe" : "live-prod"}</span>
}

describe("StagingSafeProvider / useStagingSafe", () => {
  it("exposes true when seeded staging-safe", () => {
    render(
      <StagingSafeProvider initialStagingSafe={true}>
        <Probe />
      </StagingSafeProvider>
    )
    expect(screen.getByText("staging-safe")).toBeInTheDocument()
  })

  it("exposes false when seeded live-production", () => {
    render(
      <StagingSafeProvider initialStagingSafe={false}>
        <Probe />
      </StagingSafeProvider>
    )
    expect(screen.getByText("live-prod")).toBeInTheDocument()
  })

  it("defaults to false (fail-safe) without a provider", () => {
    render(<Probe />)
    expect(screen.getByText("live-prod")).toBeInTheDocument()
  })
})
