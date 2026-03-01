import type { HelpContent } from "@/lib/help/types"
import { Lightbulb } from "lucide-react"

interface HelpContentRendererProps {
  content: HelpContent[]
}

export function HelpContentRenderer({ content }: HelpContentRendererProps) {
  return (
    <div className="space-y-6">
      {content.map((block, i) => (
        <div key={i} className="space-y-3">
          {block.heading && (
            <h3 className="text-base font-semibold text-gray-900">
              {block.heading}
            </h3>
          )}

          {block.paragraphs?.map((p, j) => (
            <p key={j} className="text-sm text-gray-700 leading-relaxed">
              {p}
            </p>
          ))}

          {block.steps && (
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              {block.steps.map((step, j) => (
                <li key={j} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          )}

          {block.bullets && (
            <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-700">
              {block.bullets.map((bullet, j) => (
                <li key={j} className="leading-relaxed">
                  {bullet}
                </li>
              ))}
            </ul>
          )}

          {block.tip && (
            <div className="flex gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{block.tip}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
