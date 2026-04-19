import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HorseForm, emptyHorseForm, type HorseFormData } from "./HorseForm"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// shadcn/ui ResponsiveDialog uses a portal -- stub it for unit tests
vi.mock("@/components/ui/responsive-dialog", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/components/ui/responsive-dialog")>()
  return {
    ...orig,
    ResponsiveDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }
})

function renderForm(overrides: Partial<{
  formData: HorseFormData
  isSaving: boolean
  submitLabel: string
  onSubmit: () => void
  setFormData: (data: HorseFormData) => void
}> = {}) {
  const props = {
    formData: emptyHorseForm,
    setFormData: vi.fn(),
    onSubmit: vi.fn(),
    isSaving: false,
    submitLabel: "Lägg till",
    ...overrides,
  }
  return { ...render(<HorseForm {...props} />), props }
}

describe("HorseForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Fältrendering", () => {
    it("renderar namnfält som obligatoriskt", () => {
      renderForm()
      const input = screen.getByLabelText(/^Namn/i) as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.required).toBe(true)
    })

    it("renderar valfria fält: ras, färg, födelseår, kön", () => {
      renderForm()
      expect(screen.getByLabelText(/^Ras$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Färg$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Födelseår$/i)).toBeInTheDocument()
      // Kön-select renderas via SelectTrigger med id="horse-gender"
      expect(document.getElementById("horse-gender")).toBeInTheDocument()
    })

    it("renderar fält för registreringsnummer och chipnummer", () => {
      renderForm()
      expect(screen.getByLabelText(/registreringsnummer/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/chipnummer/i)).toBeInTheDocument()
    })

    it("renderar fält för specialbehov", () => {
      renderForm()
      expect(screen.getByLabelText(/specialbehov/i)).toBeInTheDocument()
    })

    it("visar submitLabel på knappen", () => {
      renderForm({ submitLabel: "Spara ändringar" })
      expect(screen.getByRole("button", { name: "Spara ändringar" })).toBeInTheDocument()
    })
  })

  describe("Submit-knapp aktivering", () => {
    it("är inaktiv när namn är tomt", () => {
      renderForm({ formData: { ...emptyHorseForm, name: "" } })
      const btn = screen.getByRole("button", { name: /lägg till/i })
      expect(btn).toBeDisabled()
    })

    it("är inaktiv när namn bara innehåller blanksteg", () => {
      renderForm({ formData: { ...emptyHorseForm, name: "   " } })
      const btn = screen.getByRole("button", { name: /lägg till/i })
      expect(btn).toBeDisabled()
    })

    it("är aktiv när namn är ifyllt", () => {
      renderForm({ formData: { ...emptyHorseForm, name: "Blansen" } })
      const btn = screen.getByRole("button", { name: /lägg till/i })
      expect(btn).not.toBeDisabled()
    })

    it("är inaktiv under sparning", () => {
      renderForm({ formData: { ...emptyHorseForm, name: "Blansen" }, isSaving: true })
      const btn = screen.getByRole("button", { name: /sparar/i })
      expect(btn).toBeDisabled()
    })

    it("visar 'Sparar...' under sparning", () => {
      renderForm({ formData: { ...emptyHorseForm, name: "Blansen" }, isSaving: true })
      expect(screen.getByRole("button", { name: /sparar/i })).toBeInTheDocument()
    })
  })

  describe("Formulärinteraktion", () => {
    it("anropar setFormData vid namnändring", async () => {
      const user = userEvent.setup()
      const { props } = renderForm()

      const input = screen.getByLabelText(/^Namn/i)
      await user.type(input, "B")

      expect(props.setFormData).toHaveBeenCalledWith(
        expect.objectContaining({ name: "B" })
      )
    })

    it("anropar setFormData vid rasändring", async () => {
      const user = userEvent.setup()
      const { props } = renderForm()

      const input = screen.getByLabelText(/^Ras$/i)
      await user.type(input, "S")

      expect(props.setFormData).toHaveBeenCalledWith(
        expect.objectContaining({ breed: "S" })
      )
    })

    it("anropar onSubmit vid formulärsubmit", async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
      renderForm({ formData: { ...emptyHorseForm, name: "Blansen" }, onSubmit })

      const btn = screen.getByRole("button", { name: /lägg till/i })
      await user.click(btn)

      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
  })

  describe("Fördatafyllning", () => {
    it("visar befintliga värden i fälten", () => {
      const formData: HorseFormData = {
        name: "Blansen",
        breed: "Shetlandsponny",
        birthYear: "2018",
        color: "Brun",
        gender: "gelding",
        specialNeeds: "Allergisk mot äpplen",
        registrationNumber: "752009876543210",
        microchipNumber: "752093100012345",
      }
      renderForm({ formData })

      expect((screen.getByLabelText(/^Namn/i) as HTMLInputElement).value).toBe("Blansen")
      expect((screen.getByLabelText(/^Ras$/i) as HTMLInputElement).value).toBe("Shetlandsponny")
      expect((screen.getByLabelText(/^Färg$/i) as HTMLInputElement).value).toBe("Brun")
      expect((screen.getByLabelText(/^Födelseår$/i) as HTMLInputElement).value).toBe("2018")
      expect((screen.getByLabelText(/specialbehov/i) as HTMLTextAreaElement).value).toBe("Allergisk mot äpplen")
    })
  })
})
