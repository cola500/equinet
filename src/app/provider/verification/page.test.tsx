import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ isLoading: false, isProvider: true })),
}))

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock("@/components/layout/ProviderLayout", () => ({
  ProviderLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/loading/GenericListSkeleton", () => ({
  GenericListSkeleton: () => <div>skeleton</div>,
}))

vi.mock("@/hooks/useDialogState", () => ({
  useDialogState: () => ({ open: false, openDialog: vi.fn(), close: vi.fn() }),
}))

vi.mock("@/components/ui/image-upload", () => ({
  ImageUpload: () => <div>upload</div>,
}))

import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import ProviderVerificationPage from "./page"

describe("ProviderVerificationPage offline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders OfflineNotAvailable when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<ProviderVerificationPage />)

    expect(screen.getByTestId("offline-not-available")).toBeInTheDocument()
  })
})
