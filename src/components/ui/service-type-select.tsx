"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { useServiceTypes } from "@/hooks/useMunicipalityWatches"

interface ServiceTypeSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
}

export function ServiceTypeSelect({
  value,
  onChange,
  placeholder = "Sök tjänstetyp...",
  id,
}: ServiceTypeSelectProps) {
  const { serviceTypes } = useServiceTypes()
  const [query, setQuery] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = query.length >= 1
    ? serviceTypes.filter((s) =>
        s.toLowerCase().includes(query.toLowerCase())
      )
    : []

  // Sync query with external value
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
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
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }

    // Clear selected value if user is typing
    if (value && newQuery !== value) {
      onChange("")
    }
  }

  const handleSelect = (serviceType: string) => {
    setQuery(serviceType)
    onChange(serviceType)
    setIsOpen(false)
    setHighlightIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filtered.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightIndex >= 0 && highlightIndex < filtered.length) {
        handleSelect(filtered[highlightIndex])
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
        aria-expanded={isOpen && filtered.length > 0}
        aria-controls="service-type-listbox"
        aria-autocomplete="list"
        aria-activedescendant={highlightIndex >= 0 ? `service-type-option-${highlightIndex}` : undefined}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (query.length >= 1 && filtered.length > 0) {
            setIsOpen(true)
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <ul
          ref={listRef}
          id="service-type-listbox"
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-white shadow-lg"
        >
          {filtered.map((serviceType, index) => (
            <li
              key={serviceType}
              id={`service-type-option-${index}`}
              role="option"
              aria-selected={serviceType === value}
              onClick={() => handleSelect(serviceType)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === highlightIndex
                  ? "bg-green-100 text-green-900"
                  : "hover:bg-gray-100"
              } ${serviceType === value ? "font-semibold" : ""}`}
            >
              {serviceType}
            </li>
          ))}
        </ul>
      )}
      {isOpen && query.length >= 1 && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white p-3 text-sm text-gray-500 shadow-lg">
          Ingen tjänst matchar &quot;{query}&quot;
        </div>
      )}
    </div>
  )
}
