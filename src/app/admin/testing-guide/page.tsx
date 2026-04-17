"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { TEST_DATA } from "./test-data"
import type { TestCategory, TestSection } from "./test-data"

const STORAGE_KEY = "equinet-testing-guide-checks"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryStats(category: TestCategory, checked: Record<string, boolean>) {
  const items = category.sections.flatMap((s) => s.items)
  const total = items.length
  const done = items.filter((i) => checked[i.id]).length
  return { total, done }
}

function getSectionStats(section: TestSection, checked: Record<string, boolean>) {
  const total = section.items.length
  const done = section.items.filter((i) => checked[i.id]).length
  return { total, done }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="bg-green-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** Overview: list of categories as tappable cards */
function OverviewView({
  checked,
  onSelect,
  onReset,
}: {
  checked: Record<string, boolean>
  onSelect: (id: string) => void
  onReset: () => void
}) {
  const allItems = TEST_DATA.flatMap((c) => c.sections.flatMap((s) => s.items))
  const totalCount = allItems.length
  const checkedCount = allItems.filter((i) => checked[i.id]).length
  const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Testningsguide</h1>
          <p className="text-sm text-gray-500">Tryck på en kategori för att börja</p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Nollställ
        </Button>
      </div>

      {/* Total progress */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-7 w-7 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">
                  {checkedCount} / {totalCount}
                </span>
                <span className="text-sm font-bold text-green-700">{pct}%</span>
              </div>
              <ProgressBar done={checkedCount} total={totalCount} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category cards */}
      <div className="space-y-3">
        {TEST_DATA.map((category) => {
          const { total, done } = getCategoryStats(category, checked)
          const complete = done === total && total > 0
          const Icon = category.icon
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              className="w-full text-left p-4 rounded-xl border bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center gap-4"
            >
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  complete ? "bg-green-100" : "bg-gray-100"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    complete ? "text-green-600" : "text-gray-500"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate">
                    {category.title}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {complete && (
                      <Badge className="bg-green-100 text-green-700 text-xs">
                        Klar
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500">
                      {done}/{total}
                    </span>
                  </div>
                </div>
                <ProgressBar done={done} total={total} />
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300 shrink-0" />
            </button>
          )
        })}
      </div>

      {/* Tips */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium mb-2">Tips</p>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
            <li>Testa &quot;happy path&quot; först</li>
            <li>Testa på mobil &mdash; de flesta använder mobilen i stallet</li>
            <li>Testa flöden: sök → boka → bekräfta → genomför → recensera</li>
            <li>Växla roller: kund, leverantör, admin</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

/** Detail: a single category with its sections and checkboxes */
function CategoryView({
  category,
  checked,
  onToggle,
  onBack,
  onNavigate,
}: {
  category: TestCategory
  checked: Record<string, boolean>
  onToggle: (id: string, value: boolean) => void
  onBack: () => void
  onNavigate: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const { total, done } = getCategoryStats(category, checked)

  function toggleCollapse(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-2 -ml-1 py-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{category.title}</h1>
          <Badge
            variant={done === total ? "default" : "secondary"}
            className={done === total && total > 0 ? "bg-green-600" : ""}
          >
            {done}/{total}
          </Badge>
        </div>
        <div className="mt-2">
          <ProgressBar done={done} total={total} />
        </div>
      </div>

      {/* Sections */}
      {category.sections.map((section) => {
        const secStats = getSectionStats(section, checked)
        const isCollapsed = collapsed[section.id]
        const sectionComplete = secStats.done === secStats.total && secStats.total > 0

        return (
          <Card key={section.id}>
            <CardHeader className="pb-2 px-4">
              <button
                type="button"
                onClick={() => toggleCollapse(section.id)}
                className="w-full flex items-center justify-between text-left py-1"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <CardTitle className="text-sm">{section.title}</CardTitle>
                    {section.description && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {section.description}
                      </p>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 ml-2 ${
                    sectionComplete ? "border-green-600 text-green-700" : ""
                  }`}
                >
                  {secStats.done}/{secStats.total}
                </Badge>
              </button>
            </CardHeader>
            {!isCollapsed && (
              <CardContent className="px-4 pb-4">
                <div className="space-y-3">
                  {section.items.map((item) => (
                    <label
                      key={item.id}
                      htmlFor={item.id}
                      className="flex items-start gap-3 cursor-pointer min-h-[44px] items-center"
                    >
                      <Checkbox
                        id={item.id}
                        checked={checked[item.id] ?? false}
                        onCheckedChange={(value) =>
                          onToggle(item.id, value === true)
                        }
                      />
                      <span
                        className={`text-sm leading-snug ${
                          checked[item.id]
                            ? "text-gray-400 line-through"
                            : "text-gray-700"
                        }`}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Next category navigation */}
      <CategoryNavigation currentId={category.id} onNavigate={onNavigate} />
    </div>
  )
}

function CategoryNavigation({
  currentId,
  onNavigate,
}: {
  currentId: string
  onNavigate: (id: string) => void
}) {
  const currentIdx = TEST_DATA.findIndex((c) => c.id === currentId)
  const next = currentIdx < TEST_DATA.length - 1 ? TEST_DATA[currentIdx + 1] : null

  if (!next) return null

  return (
    <div className="pt-2 pb-4">
      <button
        type="button"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" })
          setTimeout(() => onNavigate(next.id), 100)
        }}
        className="w-full p-3 rounded-lg border bg-white hover:bg-gray-50 active:bg-gray-100 text-left flex items-center justify-between"
      >
        <span className="text-sm text-gray-500">
          Nästa: <span className="font-medium text-gray-900">{next.title}</span>
        </span>
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TestingGuidePage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setChecked(JSON.parse(stored))
    } catch {
      // Ignore
    }
  }, [])

  const persist = useCallback((next: Record<string, boolean>) => {
    setChecked(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore
    }
  }, [])

  function handleToggle(id: string, value: boolean) {
    persist({ ...checked, [id]: value })
  }

  function handleReset() {
    persist({})
    toast.success("Alla markeringar nollställda")
  }

  function handleSelectCategory(id: string) {
    setActiveCategory(id)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleBack() {
    setActiveCategory(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const category = activeCategory
    ? TEST_DATA.find((c) => c.id === activeCategory)
    : null

  return (
    <AdminLayout>
      <div className="max-w-lg mx-auto">
        {category ? (
          <CategoryView
            category={category}
            checked={checked}
            onToggle={handleToggle}
            onBack={handleBack}
            onNavigate={handleSelectCategory}
          />
        ) : (
          <OverviewView
            checked={checked}
            onSelect={handleSelectCategory}
            onReset={handleReset}
          />
        )}
      </div>
    </AdminLayout>
  )
}
