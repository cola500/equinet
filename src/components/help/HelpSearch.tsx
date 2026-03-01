"use client"

import { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

interface HelpSearchProps {
  onSearch: (query: string) => void
  resultCount: number
  totalCount: number
}

export function HelpSearch({
  onSearch,
  resultCount,
  totalCount,
}: HelpSearchProps) {
  const [query, setQuery] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, onSearch])

  const isFiltering = query.trim().length > 0

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="search"
          placeholder="Sök bland artiklar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      {isFiltering && (
        <p className="text-xs text-gray-500">
          {resultCount} av {totalCount} artiklar matchar
        </p>
      )}
    </div>
  )
}
