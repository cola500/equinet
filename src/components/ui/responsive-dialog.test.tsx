import { render, screen } from "@testing-library/react"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "./responsive-dialog"

// Mock useIsMobile
let mockIsMobile = false
vi.mock("@/hooks/useMediaQuery", () => ({
  useIsMobile: () => mockIsMobile,
}))

function TestDialog({ open = true }: { open?: boolean }) {
  return (
    <ResponsiveDialog open={open} onOpenChange={() => {}}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Test Title</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Test Description</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div>Body content</div>
        <ResponsiveDialogFooter>
          <button>Action</button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

describe("ResponsiveDialog", () => {
  afterEach(() => {
    mockIsMobile = false
  })

  describe("on desktop", () => {
    beforeEach(() => {
      mockIsMobile = false
    })

    it("renders Dialog (not Drawer) with content", () => {
      render(<TestDialog />)
      expect(screen.getByText("Test Title")).toBeInTheDocument()
      expect(screen.getByText("Test Description")).toBeInTheDocument()
      expect(screen.getByText("Body content")).toBeInTheDocument()
      expect(screen.getByText("Action")).toBeInTheDocument()

      // Dialog uses data-slot="dialog-content"
      expect(document.querySelector('[data-slot="dialog-content"]')).toBeInTheDocument()
      expect(document.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument()
    })
  })

  describe("on mobile", () => {
    beforeEach(() => {
      mockIsMobile = true
    })

    it("renders Drawer (not Dialog) with content", () => {
      render(<TestDialog />)
      expect(screen.getByText("Test Title")).toBeInTheDocument()
      expect(screen.getByText("Test Description")).toBeInTheDocument()
      expect(screen.getByText("Body content")).toBeInTheDocument()
      expect(screen.getByText("Action")).toBeInTheDocument()

      // Drawer uses data-slot="drawer-content"
      expect(document.querySelector('[data-slot="drawer-content"]')).toBeInTheDocument()
      expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeInTheDocument()
    })
  })

  it("does not render content when closed", () => {
    render(<TestDialog open={false} />)
    expect(screen.queryByText("Test Title")).not.toBeInTheDocument()
  })
})
