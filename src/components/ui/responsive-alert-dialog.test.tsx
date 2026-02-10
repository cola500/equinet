import { render, screen } from "@testing-library/react"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
} from "./responsive-alert-dialog"

// Mock useIsMobile
let mockIsMobile = false
vi.mock("@/hooks/useMediaQuery", () => ({
  useIsMobile: () => mockIsMobile,
}))

function TestAlertDialog({ open = true }: { open?: boolean }) {
  return (
    <ResponsiveAlertDialog open={open} onOpenChange={() => {}}>
      <ResponsiveAlertDialogContent>
        <ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogTitle>Confirm Delete</ResponsiveAlertDialogTitle>
          <ResponsiveAlertDialogDescription>Are you sure?</ResponsiveAlertDialogDescription>
        </ResponsiveAlertDialogHeader>
        <ResponsiveAlertDialogFooter>
          <ResponsiveAlertDialogCancel>Cancel</ResponsiveAlertDialogCancel>
          <ResponsiveAlertDialogAction>Delete</ResponsiveAlertDialogAction>
        </ResponsiveAlertDialogFooter>
      </ResponsiveAlertDialogContent>
    </ResponsiveAlertDialog>
  )
}

describe("ResponsiveAlertDialog", () => {
  afterEach(() => {
    mockIsMobile = false
  })

  describe("on desktop", () => {
    beforeEach(() => {
      mockIsMobile = false
    })

    it("renders AlertDialog (not Drawer) with content", () => {
      render(<TestAlertDialog />)
      expect(screen.getByText("Confirm Delete")).toBeInTheDocument()
      expect(screen.getByText("Are you sure?")).toBeInTheDocument()
      expect(screen.getByText("Cancel")).toBeInTheDocument()
      expect(screen.getByText("Delete")).toBeInTheDocument()

      // AlertDialog uses data-slot="alert-dialog-content"
      expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeInTheDocument()
      expect(document.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument()
    })
  })

  describe("on mobile", () => {
    beforeEach(() => {
      mockIsMobile = true
    })

    it("renders Drawer (not AlertDialog) with content", () => {
      render(<TestAlertDialog />)
      expect(screen.getByText("Confirm Delete")).toBeInTheDocument()
      expect(screen.getByText("Are you sure?")).toBeInTheDocument()
      expect(screen.getByText("Cancel")).toBeInTheDocument()
      expect(screen.getByText("Delete")).toBeInTheDocument()

      // Drawer uses data-slot="drawer-content"
      expect(document.querySelector('[data-slot="drawer-content"]')).toBeInTheDocument()
      expect(document.querySelector('[data-slot="alert-dialog-content"]')).not.toBeInTheDocument()
    })

    it("renders action buttons with touch-friendly size", () => {
      render(<TestAlertDialog />)
      const cancelBtn = screen.getByText("Cancel")
      const deleteBtn = screen.getByText("Delete")

      // Both buttons should have min-h-[44px] for touch targets
      expect(cancelBtn.className).toContain("min-h-[44px]")
      expect(deleteBtn.className).toContain("min-h-[44px]")
    })
  })

  it("does not render content when closed", () => {
    render(<TestAlertDialog open={false} />)
    expect(screen.queryByText("Confirm Delete")).not.toBeInTheDocument()
  })
})
