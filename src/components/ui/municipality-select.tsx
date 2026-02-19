"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { searchMunicipalities, type Municipality } from "@/lib/geo/municipalities"

interface MunicipalitySelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
}

export function MunicipalitySelect({
  value,
  onChange,
  placeholder = "Sök kommun...",
  id,
}: MunicipalitySelectProps) {
  const [query, setQuery] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<Municipality[]>([])
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Sync query with external value
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        // Reset query to selected value if user clicked away without selecting
        if (query !== value) {
          setQuery(value)
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [value, query])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    setHighlightIndex(-1)

    if (newQuery.length >= 1) {
      setResults(searchMunicipalities(newQuery))
      setIsOpen(true)
    } else {
      setResults([])
      setIsOpen(false)
    }

    // Clear selected value if user is typing
    if (value && newQuery !== value) {
      onChange("")
    }
  }

  const handleSelect = (municipality: Municipality) => {
    setQuery(municipality.name)
    onChange(municipality.name)
    setIsOpen(false)
    setHighlightIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightIndex >= 0 && highlightIndex < results.length) {
        handleSelect(results[highlightIndex])
      }
    } else if (e.key === "Escape") {
      setIsOpen(false)
      setQuery(value)
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.children
      if (items[highlightIndex]) {
        items[highlightIndex].scrollIntoView?.({ block: "nearest" })
      }
    }
  }, [highlightIndex])

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen && results.length > 0}
        aria-controls="municipality-listbox"
        aria-autocomplete="list"
        aria-activedescendant={highlightIndex >= 0 ? `municipality-option-${highlightIndex}` : undefined}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (query.length >= 1 && results.length > 0) {
            setIsOpen(true)
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          id="municipality-listbox"
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-white shadow-lg"
        >
          {results.map((municipality, index) => (
            <li
              key={municipality.name}
              id={`municipality-option-${index}`}
              role="option"
              aria-selected={municipality.name === value}
              onClick={() => handleSelect(municipality)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === highlightIndex
                  ? "bg-green-100 text-green-900"
                  : "hover:bg-gray-100"
              } ${municipality.name === value ? "font-semibold" : ""}`}
            >
              {municipality.name}
            </li>
          ))}
        </ul>
      )}
      {isOpen && query.length >= 1 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white p-3 text-sm text-gray-500 shadow-lg">
          Ingen kommun matchar &quot;{query}&quot;
        </div>
      )}
    </div>
  )
}
