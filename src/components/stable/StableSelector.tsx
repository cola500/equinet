"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { clientLogger } from "@/lib/client-logger"

interface StableResult {
  id: string
  name: string
  municipality: string | null
}

interface StableSelectorProps {
  horseId: string
  currentStable: { id: string; name: string; municipality: string | null } | null
  onStableChanged: (stable: StableResult | null) => void
}

export function StableSelector({
  horseId,
  currentStable,
  onStableChanged,
}: StableSelectorProps) {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<StableResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  const searchStables = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([])
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(
        `/api/stables?search=${encodeURIComponent(query)}&limit=10`
      )
      if (res.ok) {
        const data = await res.json()
        setResults(
          data.map((s: StableResult) => ({
            id: s.id,
            name: s.name,
            municipality: s.municipality,
          }))
        )
      }
    } catch (err) {
      clientLogger.error("Failed to search stables", err)
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchStables(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, searchStables])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleSelect = async (stable: StableResult) => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/horses/${horseId}/stable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stableId: stable.id }),
      })
      if (res.ok) {
        onStableChanged(stable)
        setSearch("")
        setShowDropdown(false)
      }
    } catch (err) {
      clientLogger.error("Failed to set stable", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemove = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/horses/${horseId}/stable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stableId: null }),
      })
      if (res.ok) {
        onStableChanged(null)
      }
    } catch (err) {
      clientLogger.error("Failed to remove stable", err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <Label>Stall</Label>
      {currentStable ? (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
          <div>
            <a
              href={`/stables/${currentStable.id}`}
              className="font-medium text-blue-600 hover:underline"
            >
              {currentStable.name}
            </a>
            {currentStable.municipality && (
              <span className="text-sm text-gray-500 ml-2">
                {currentStable.municipality}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={isSaving}
          >
            {isSaving ? "Tar bort..." : "Ta bort"}
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            placeholder="Sök stall..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => search.length >= 2 && setShowDropdown(true)}
          />
          {showDropdown && (search.length >= 2 || isSearching) && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
              {isSearching ? (
                <div className="p-3 text-sm text-gray-500">Söker...</div>
              ) : results.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">
                  Inga stall hittades
                </div>
              ) : (
                results.map((stable) => (
                  <button
                    key={stable.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => handleSelect(stable)}
                    disabled={isSaving}
                  >
                    <span className="font-medium">{stable.name}</span>
                    {stable.municipality && (
                      <span className="text-sm text-gray-500 ml-2">
                        {stable.municipality}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
