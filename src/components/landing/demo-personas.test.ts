import { describe, it, expect } from "vitest"
import { DEMO_PERSONAS } from "./demo-personas"

describe("DEMO_PERSONAS", () => {
  it("maps the customer persona to the Lisa demo account", () => {
    expect(DEMO_PERSONAS.customer).toEqual({
      label: "Demo som hästägare",
      email: "lisa.andersson@gmail.com",
      password: "DemoOwner123!",
      redirectTo: "/dashboard",
    })
  })

  it("maps the provider persona to the Erik demo account", () => {
    expect(DEMO_PERSONAS.provider).toEqual({
      label: "Demo som leverantör",
      email: "erik.jarnfot@demo.equinet.se",
      password: "DemoProvider123!",
      redirectTo: "/dashboard",
    })
  })

  it("routes both personas via /dashboard", () => {
    expect(DEMO_PERSONAS.customer.redirectTo).toBe("/dashboard")
    expect(DEMO_PERSONAS.provider.redirectTo).toBe("/dashboard")
  })
})
