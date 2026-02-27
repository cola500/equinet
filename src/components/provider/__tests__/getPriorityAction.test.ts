import { describe, it, expect } from "vitest"
import { getPriorityAction } from "../PriorityActionCard"

// Route type matching dashboard usage
interface TestRoute {
  id: string
  routeName: string
  routeDate: string
  startTime: string
  status: string
  stops?: Array<{ status: string }>
}

function makeRoute(overrides: Partial<TestRoute> = {}): TestRoute {
  return {
    id: "route-1",
    routeName: "Testrutt",
    routeDate: "2026-03-01",
    startTime: "08:00",
    status: "planned",
    ...overrides,
  }
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0]
}

function tomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split("T")[0]
}

describe("getPriorityAction", () => {
  it("returns pending action when there are pending bookings", () => {
    const result = getPriorityAction(3, [], true)
    expect(result).toEqual({
      type: "pending",
      message: "Du har 3 nya förfrågningar",
      href: "/provider/bookings",
      variant: "warning",
    })
  })

  it("returns singular form for 1 pending booking", () => {
    const result = getPriorityAction(1, [], true)
    expect(result?.message).toBe("Du har 1 ny förfrågan")
  })

  it("returns route-today when there is a route today", () => {
    const routes = [makeRoute({ routeDate: todayISO() })]
    const result = getPriorityAction(0, routes, true)
    expect(result).toEqual({
      type: "route-today",
      message: "Du har en rutt idag",
      href: `/provider/routes/${routes[0].id}`,
      variant: "success",
    })
  })

  it("returns route-tomorrow when there is a route tomorrow", () => {
    const routes = [makeRoute({ routeDate: tomorrowISO() })]
    const result = getPriorityAction(0, routes, true)
    expect(result).toEqual({
      type: "route-tomorrow",
      message: "Du har en rutt imorgon",
      href: `/provider/routes/${routes[0].id}`,
      variant: "info",
    })
  })

  it("returns onboarding when not complete", () => {
    const result = getPriorityAction(0, [], false)
    expect(result).toEqual({
      type: "onboarding",
      message: "Slutför din profil",
      href: "/provider/profile",
      variant: "default",
    })
  })

  it("returns null when nothing matches", () => {
    const result = getPriorityAction(0, [], true)
    expect(result).toBeNull()
  })

  it("prioritizes pending over route-today", () => {
    const routes = [makeRoute({ routeDate: todayISO() })]
    const result = getPriorityAction(2, routes, false)
    expect(result?.type).toBe("pending")
  })

  it("prioritizes route-today over route-tomorrow", () => {
    const routes = [
      makeRoute({ id: "today", routeDate: todayISO() }),
      makeRoute({ id: "tomorrow", routeDate: tomorrowISO() }),
    ]
    const result = getPriorityAction(0, routes, true)
    expect(result?.type).toBe("route-today")
    expect(result?.href).toBe("/provider/routes/today")
  })

  it("prioritizes route-tomorrow over onboarding", () => {
    const routes = [makeRoute({ routeDate: tomorrowISO() })]
    const result = getPriorityAction(0, routes, false)
    expect(result?.type).toBe("route-tomorrow")
  })

  it("ignores routes with past dates", () => {
    const routes = [makeRoute({ routeDate: "2020-01-01" })]
    const result = getPriorityAction(0, routes, true)
    expect(result).toBeNull()
  })
})
