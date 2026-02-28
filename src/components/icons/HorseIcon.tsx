import { forwardRef } from "react"
import type { SVGProps } from "react"

/**
 * Horseshoe icon following Lucide conventions:
 * 24x24 viewBox, stroke-based, currentColor, forwardRef.
 *
 * The shape is a classic U-shaped horseshoe -- recognizable even at 20px
 * in the bottom tab bar. Seven nail holes (small circles) add authenticity.
 */
export const HorseIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Horseshoe U-shape */}
      <path d="M5 3v6a7 7 0 0 0 14 0V3" />
      {/* Left flange */}
      <path d="M3 3h4" />
      {/* Right flange */}
      <path d="M17 3h4" />
      {/* Nail holes -- left side */}
      <circle cx="7" cy="6" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="7" cy="10" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="13.5" r="0.75" fill="currentColor" stroke="none" />
      {/* Nail holes -- right side */}
      <circle cx="17" cy="6" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="17" cy="10" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="13.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
)

HorseIcon.displayName = "HorseIcon"
