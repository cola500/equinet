import { describe, it, expect, beforeEach } from "vitest"
import {
  getRuntimeSetting,
  setRuntimeSetting,
  getAllRuntimeSettings,
  clearRuntimeSettings,
} from "./runtime-settings"

describe("runtime-settings", () => {
  beforeEach(() => {
    clearRuntimeSettings()
  })

  describe("getRuntimeSetting", () => {
    it("returns undefined for unset key", () => {
      expect(getRuntimeSetting("nonexistent")).toBeUndefined()
    })

    it("returns the value for a set key", () => {
      setRuntimeSetting("foo", "bar")
      expect(getRuntimeSetting("foo")).toBe("bar")
    })
  })

  describe("setRuntimeSetting", () => {
    it("overwrites an existing value", () => {
      setRuntimeSetting("key", "first")
      setRuntimeSetting("key", "second")
      expect(getRuntimeSetting("key")).toBe("second")
    })
  })

  describe("getAllRuntimeSettings", () => {
    it("returns empty object when no settings", () => {
      expect(getAllRuntimeSettings()).toEqual({})
    })

    it("returns all set settings", () => {
      setRuntimeSetting("a", "1")
      setRuntimeSetting("b", "2")
      expect(getAllRuntimeSettings()).toEqual({ a: "1", b: "2" })
    })

    it("returns a copy (not the internal reference)", () => {
      setRuntimeSetting("x", "y")
      const all = getAllRuntimeSettings()
      all["x"] = "mutated"
      expect(getRuntimeSetting("x")).toBe("y")
    })
  })

  describe("clearRuntimeSettings", () => {
    it("removes all settings", () => {
      setRuntimeSetting("a", "1")
      setRuntimeSetting("b", "2")
      clearRuntimeSettings()
      expect(getAllRuntimeSettings()).toEqual({})
    })
  })
})
