interface SmartReplyVars {
  datum: string
  tid: string
  telefon: string
  adress: string
}

const TEMPLATES = [
  "Bekräftat, vi ses {datum} kl {tid}!",
  "Tack för ditt meddelande. Jag återkommer inom en timme.",
  "Ring mig på {telefon} om något är akut.",
  "Min adress: {adress}",
  "Kan vi flytta till en annan tid? Vilken passar dig?",
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
            className="text-xs px-3 py-1.5 rounded-full border border-green-600 text-green-700 bg-white hover:bg-green-50 active:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[36px] leading-tight text-left"
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}
