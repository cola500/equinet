import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TimeSlotButton } from "./TimeSlotButton"

describe("TimeSlotButton", () => {
  it("renders the start time", () => {
    render(
      <TimeSlotButton
        startTime="09:00"
        endTime="09:30"
        isAvailable={true}
        isSelected={false}
        onClick={() => {}}
      />
    )

    expect(screen.getByText("09:00")).toBeInTheDocument()
  })

  it("is clickable when available", () => {
    const onClick = vi.fn()
    render(
      <TimeSlotButton
        startTime="09:00"
        endTime="09:30"
        isAvailable={true}
        isSelected={false}
        onClick={onClick}
      />
    )

    fireEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("is not clickable when unavailable", () => {
    const onClick = vi.fn()
    render(
      <TimeSlotButton
        startTime="09:00"
        endTime="09:30"
        isAvailable={false}
        isSelected={false}
        onClick={onClick}
      />
    )

    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it("shows selected state visually", () => {
    render(
      <TimeSlotButton
        startTime="09:00"
        endTime="09:30"
        isAvailable={true}
        isSelected={true}
        onClick={() => {}}
      />
    )

    const button = screen.getByRole("button")
    // Selected state should have ring styling
    expect(button.className).toMatch(/ring/)
  })

  it("shows available state with green styling", () => {
    render(
      <TimeSlotButton
        startTime="09:00"
        endTime="09:30"
        isAvailable={true}
        isSelected={false}
        onClick={() => {}}
      />
    )

    const button = screen.getByRole("button")
    expect(button.className).toMatch(/bg-green/)
  })

  it("shows unavailable state with gray styling", () => {
    render(
      <TimeSlotButton
        startTime="09:00"
        endTime="09:30"
        isAvailable={false}
        isSelected={false}
        onClick={() => {}}
      />
    )

    const button = screen.getByRole("button")
    expect(button.className).toMatch(/bg-gray/)
  })
})
