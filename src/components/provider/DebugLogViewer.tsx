"use client"

import { useEffect, useState, useCallback } from "react"
import { getDebugLogs, clearDebugLogs } from "@/lib/offline/debug-logger"
import type { DebugLogEntry } from "@/lib/offline/db"

type CategoryFilter = DebugLogEntry["category"] | "all"

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  })
}

function formatLogForCopy(logs: DebugLogEntry[]): string {
  return logs
    .map(
      (l) =>
        `[${formatTimestamp(l.timestamp)}] [${l.category}] [${l.level}] ${l.message}${l.data ? ` | ${l.data}` : ""}`
    )
    .join("\n")
}

const levelStyles: Record<string, string> = {
  error: "bg-red-100 text-red-800",
  warn: "bg-amber-100 text-amber-800",
  info: "bg-gray-100 text-gray-800",
}

const categoryStyles: Record<string, string> = {
  network: "bg-blue-100 text-blue-800",
  auth: "bg-purple-100 text-purple-800",
  navigation: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  sw: "bg-orange-100 text-orange-800",
  general: "bg-gray-100 text-gray-700",
}

export function DebugLogViewer() {
  const [logs, setLogs] = useState<DebugLogEntry[]>([])
  const [filter, setFilter] = useState<CategoryFilter>("all")
  const [copied, setCopied] = useState(false)

  const fetchLogs = useCallback(async () => {
    const options = filter === "all" ? {} : { category: filter }
    const result = await getDebugLogs(options)
    setLogs(result)
  }, [filter])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 3000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  const handleClear = async () => {
    await clearDebugLogs()
    await fetchLogs()
  }

  const handleCopy = async () => {
    const text = formatLogForCopy(logs)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Filtrera kategori"
          value={filter}
          onChange={(e) => setFilter(e.target.value as CategoryFilter)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="all">Alla</option>
          <option value="network">network</option>
          <option value="auth">auth</option>
          <option value="navigation">navigation</option>
          <option value="error">error</option>
          <option value="sw">sw</option>
          <option value="general">general</option>
        </select>

        <button
          onClick={handleCopy}
          disabled={logs.length === 0}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200 disabled:opacity-50"
        >
          {copied ? "Kopierat!" : "Kopiera alla"}
        </button>

        <button
          onClick={handleClear}
          className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
        >
          Rensa loggar
        </button>

        <span className="text-sm text-gray-500">
          {logs.length} loggar
        </span>
      </div>

      {logs.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Inga loggar</p>
      ) : (
        <div className="space-y-1 font-mono text-xs">
          {logs.map((log) => (
            <div
              key={log.id}
              data-level={log.level}
              className={`flex flex-wrap items-start gap-2 rounded px-2 py-1 ${
                log.level === "error"
                  ? "bg-red-50"
                  : log.level === "warn"
                    ? "bg-amber-50"
                    : "bg-white"
              }`}
            >
              <span className="text-gray-400 shrink-0">
                {formatTimestamp(log.timestamp)}
              </span>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${
                  categoryStyles[log.category] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                {log.category}
              </span>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${
                  levelStyles[log.level] ?? "bg-gray-100 text-gray-800"
                }`}
              >
                {log.level}
              </span>
              <span className="break-all">{log.message}</span>
              {log.data && (
                <span className="text-gray-400 break-all">{log.data}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
