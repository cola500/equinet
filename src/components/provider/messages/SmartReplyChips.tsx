interface SmartReplyVars {
  datum: string
  tid: string
  telefon: string
}

const TEMPLATES = [
  "Bokningen är bekräftad. Vi ses {datum} kl {tid}.",
  "Tack! Jag återkommer så snart jag kan.",
  "Ring mig på {telefon} om det brådskar.",
  "Vilken tid passar dig istället?",
]

export function expandTemplate(template: string, vars: Partial<SmartReplyVars>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key as keyof SmartReplyVars] ?? `{${key}}`)
}

interface SmartReplyChipsProps {
  vars: Partial<SmartReplyVars>
  onSelect: (text: string) => void
  disabled?: boolean
}

export function SmartReplyChips({ vars, onSelect, disabled }: SmartReplyChipsProps) {
  return (
    <div
      className="flex flex-wrap gap-2 animate-in fade-in duration-300"
      role="group"
      aria-label="Snabbsvar"
    >
      {TEMPLATES.map((template, i) => {
        const text = expandTemplate(template, vars)
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(text)}
            disabled={disabled}
            aria-label={`Snabbsvar: ${text}`}
            className="text-xs px-3 py-2 rounded-full border border-green-600 text-green-700 bg-white hover:bg-green-50 active:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] sm:min-h-0 leading-tight text-left"
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}
