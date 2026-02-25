import { renderHook, act } from "@testing-library/react"
import { useDialogState } from "./useDialogState"

describe("useDialogState", () => {
  it("starts closed by default", () => {
    const { result } = renderHook(() => useDialogState())
    expect(result.current.open).toBe(false)
  })

  it("starts open when initialOpen is true", () => {
    const { result } = renderHook(() => useDialogState(true))
    expect(result.current.open).toBe(true)
  })

  it("opens the dialog", () => {
    const { result } = renderHook(() => useDialogState())
    act(() => result.current.openDialog())
    expect(result.current.open).toBe(true)
  })

  it("closes the dialog", () => {
    const { result } = renderHook(() => useDialogState(true))
    act(() => result.current.close())
    expect(result.current.open).toBe(false)
  })

  it("toggles the dialog", () => {
    const { result } = renderHook(() => useDialogState())

    act(() => result.current.toggle())
    expect(result.current.open).toBe(true)

    act(() => result.current.toggle())
    expect(result.current.open).toBe(false)
  })

  it("setOpen works as controlled setter", () => {
    const { result } = renderHook(() => useDialogState())

    act(() => result.current.setOpen(true))
    expect(result.current.open).toBe(true)

    act(() => result.current.setOpen(false))
    expect(result.current.open).toBe(false)
  })

  it("returns stable function references", () => {
    const { result, rerender } = renderHook(() => useDialogState())

    const first = {
      openDialog: result.current.openDialog,
      close: result.current.close,
      toggle: result.current.toggle,
    }

    rerender()

    expect(result.current.openDialog).toBe(first.openDialog)
    expect(result.current.close).toBe(first.close)
    expect(result.current.toggle).toBe(first.toggle)
  })
})
