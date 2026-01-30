import { Badge } from "@/components/ui/badge"

interface VerificationBadgeProps {
  isVerified: boolean
  size?: "sm" | "md"
}

export function VerificationBadge({
  isVerified,
  size = "sm",
}: VerificationBadgeProps) {
  if (!isVerified) return null

  return (
    <Badge
      variant="outline"
      className={`bg-green-50 text-green-700 border-green-200 ${
        size === "md" ? "text-sm px-3 py-1" : "text-xs px-2 py-0.5"
      }`}
    >
      <svg
        className={`${size === "md" ? "w-4 h-4" : "w-3 h-3"} mr-1 inline-block`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      Verifierad
    </Badge>
  )
}
