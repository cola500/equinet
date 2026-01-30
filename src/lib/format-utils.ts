export function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMinutes < 1) return "Just nu"
  if (diffMinutes < 60) return `${diffMinutes} min sedan`
  if (diffHours < 24) return `${diffHours} tim sedan`
  if (diffDays < 7) return `${diffDays} dagar sedan`
  return date.toLocaleDateString("sv-SE")
}
