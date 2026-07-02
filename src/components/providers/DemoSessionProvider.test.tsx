import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { DemoSessionProvider, useDemoSession } from "./DemoSessionProvider"

function Probe() {
  const demo = useDemoSession()
  return <span>{demo ? "demo" : "prod"}</span>
}

describe("DemoSessionProvider / useDemoSession", () => {
  it("exposes true when seeded with a demo session", () => {
    render(
      <DemoSessionProvider initialDemoSession={true}>
        <Probe />
      </DemoSessionProvider>
    )
    expect(screen.getByText("demo")).toBeInTheDocument()
  })

  it("exposes false when seeded prod-like", () => {
    render(
      <DemoSessionProvider initialDemoSession={false}>
        <Probe />
      </DemoSessionProvider>
    )
    expect(screen.getByText("prod")).toBeInTheDocument()
  })

  it("defaults to false without a provider", () => {
    render(<Probe />)
    expect(screen.getByText("prod")).toBeInTheDocument()
  })
})
