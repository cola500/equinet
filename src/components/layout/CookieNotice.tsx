"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

const STORAGE_KEY = "equinet-cookie-notice-dismissed"

export function CookieNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) {
      setVisible(true)
    }
  }, [])

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white p-4 shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-gray-600">
          Vi använder nödvändiga cookies för att tjänsten ska fungera.{" "}
          <Link
            href="/integritetspolicy"
            className="text-green-700 underline hover:text-green-900"
          >
            Läs mer
          </Link>
        </p>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Stäng
        </button>
      </div>
    </div>
  )
}
