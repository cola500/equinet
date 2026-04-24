import { renderToString } from "react-dom/server"
import { describe, it, expect, vi } from "vitest"
import Home from "./page"

vi.mock("@/components/layout/Header", () => ({
  Header: () => <header data-testid="mock-header" />,
}))

vi.mock("@/components/AnnouncementPreview", () => ({
  AnnouncementPreview: () => <div data-testid="mock-announcement-preview" />,
}))

vi.mock("lucide-react", () => ({
  Search: () => <svg />,
  CalendarDays: () => <svg />,
  Bell: () => <svg />,
  Heart: () => <svg />,
  Route: () => <svg />,
  Users: () => <svg />,
  MessageSquare: () => <svg />,
  Map: () => <svg />,
  BarChart3: () => <svg />,
  UserCheck: () => <svg />,
  ChevronDown: () => <svg />,
  Scissors: () => <svg />,
  Stethoscope: () => <svg />,
  Dumbbell: () => <svg />,
}))

vi.mock("@/components/icons/HorseIcon", () => ({
  HorseIcon: () => <svg />,
}))

vi.mock("@/components/landing/DemoLoginButton", () => ({
  DemoLoginButton: () => <button>Demo</button>,
}))

vi.mock("@/lib/demo-mode", () => ({
  isDemoMode: () => false,
}))

describe("Kategori-ikoner på landningssidan", () => {
  it("renderar kategori-ikoner (Hovslagare, Veterinär, Tränare) i SSR-HTML", () => {
    const html = renderToString(<Home />)
    expect(html).toContain("Hovslagare")
    expect(html).toContain("Veterinär")
    expect(html).toContain("Tränare")
  })

  it("kategori-ikoner länkar till /providers med korrekt search-param", () => {
    const html = renderToString(<Home />)
    expect(html).toContain("/providers?search=hovslagare")
    expect(html).toContain("/providers?search=veterinär")
    expect(html).toContain("/providers?search=tränare")
  })
})

describe("Landningssidan FAQ — SSR-integritet", () => {
  it("inkluderar FAQ-svar i SSR-HTML utan JS-gates", () => {
    // renderToString simulerar SSR — useEffect körs INTE, mounted förblir false
    // Med den gamla koden visas bara frågor, inte svar
    const html = renderToString(<Home />)

    expect(html).toContain("Det är gratis att skapa konto")
  })

  it("renderar alla FAQ-frågor i SSR-HTML", () => {
    const html = renderToString(<Home />)

    expect(html).toContain("Kostar det något att använda Equinet?")
    expect(html).toContain("Vilka tjänster kan jag boka?")
    expect(html).toContain("Finns Equinet som app?")
  })

  it("innehåller details-element för FAQ-accordion", () => {
    // Native <details> ersätter Radix Accordion — noll hydration-risk
    const html = renderToString(<Home />)

    expect(html).toContain("<details")
  })
})
