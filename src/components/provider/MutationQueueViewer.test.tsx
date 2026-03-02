import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/lib/offline/mutation-queue", () => ({
  getUnsyncedMutations: vi.fn(async () => []),
  updateMutationStatus: vi.fn(),
  clearAllMutations: vi.fn(),
}))

vi.mock("@/lib/offline/sync-engine", () => ({
  getTabCoordinator: () => ({
    onSyncCompleted: vi.fn(),
    onCacheUpdated: vi.fn(),
  }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { MutationQueueViewer } from "./MutationQueueViewer"
import { getUnsyncedMutations, updateMutationStatus } from "@/lib/offline/mutation-queue"
import type { PendingMutation } from "@/lib/offline/db"

const mockGetUnsynced = vi.mocked(getUnsyncedMutations)
const mockUpdateStatus = vi.mocked(updateMutationStatus)

function makeMutation(overrides: Partial<PendingMutation> = {}): PendingMutation {
  return {
    id: 1,
    method: "PUT",
    url: "/api/bookings/a",
    body: "{}",
    entityType: "booking",
    entityId: "a",
    createdAt: Date.now(),
    status: "pending",
    retryCount: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUnsynced.mockResolvedValue([])
})

describe("MutationQueueViewer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <MutationQueueViewer open={false} onOpenChange={vi.fn()} />
    )
    expect(container.textContent).toBe("")
  })

  it("shows empty state when no mutations", async () => {
    render(<MutationQueueViewer open={true} onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/inga väntande ändringar/i)).toBeInTheDocument()
    })
  })

  it("shows pending mutations with yellow badge", async () => {
    mockGetUnsynced.mockResolvedValue([
      makeMutation({ id: 1, status: "pending", entityType: "booking" }),
    ])

    render(<MutationQueueViewer open={true} onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/väntande/i)).toBeInTheDocument()
    })
  })

  it("shows failed mutations with red badge", async () => {
    mockGetUnsynced.mockResolvedValue([
      makeMutation({ id: 1, status: "failed", error: "HTTP 500 after 3 retries" }),
    ])

    render(<MutationQueueViewer open={true} onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/misslyckad/i)).toBeInTheDocument()
    })
  })

  it("shows conflict mutations with orange badge", async () => {
    mockGetUnsynced.mockResolvedValue([
      makeMutation({ id: 1, status: "conflict", error: "HTTP 409" }),
    ])

    render(<MutationQueueViewer open={true} onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/konflikt/i)).toBeInTheDocument()
    })
  })

  it("shows mutation summary count", async () => {
    mockGetUnsynced.mockResolvedValue([
      makeMutation({ id: 1, status: "pending" }),
      makeMutation({ id: 2, status: "failed", entityId: "b" }),
      makeMutation({ id: 3, status: "conflict", entityId: "c" }),
    ])

    render(<MutationQueueViewer open={true} onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/3 ändringar/i)).toBeInTheDocument()
    })
  })

  it("dismiss button removes a mutation", async () => {
    mockGetUnsynced
      .mockResolvedValueOnce([
        makeMutation({ id: 1, status: "conflict", error: "HTTP 409" }),
      ])
      .mockResolvedValueOnce([])

    render(<MutationQueueViewer open={true} onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/konflikt/i)).toBeInTheDocument()
    })

    const dismissBtn = screen.getByRole("button", { name: /ignorera/i })
    fireEvent.click(dismissBtn)

    await waitFor(() => {
      expect(mockUpdateStatus).toHaveBeenCalledWith(1, "synced")
    })
  })

  it("shows error message for failed/conflict mutations", async () => {
    mockGetUnsynced.mockResolvedValue([
      makeMutation({ id: 1, status: "failed", error: "HTTP 500 after 3 retries" }),
    ])

    render(<MutationQueueViewer open={true} onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/HTTP 500/)).toBeInTheDocument()
    })
  })

  it("maps entity types to Swedish labels", async () => {
    mockGetUnsynced.mockResolvedValue([
      makeMutation({ id: 1, entityType: "booking", status: "pending" }),
      makeMutation({ id: 2, entityType: "availability-schedule", entityId: "s1", status: "pending" }),
    ])

    render(<MutationQueueViewer open={true} onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/bokning/i)).toBeInTheDocument()
      expect(screen.getByText(/schema/i)).toBeInTheDocument()
    })
  })
})
