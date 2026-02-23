"use client"

import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"

interface FollowButtonProps {
  isFollowing: boolean
  followerCount: number
  isLoading: boolean
  onToggle: () => void
}

export function FollowButton({
  isFollowing,
  followerCount,
  isLoading,
  onToggle,
}: FollowButtonProps) {
  return (
    <Button
      variant={isFollowing ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      disabled={isLoading}
      aria-pressed={isFollowing}
      className="gap-1.5"
    >
      <Heart
        className={`h-4 w-4 ${isFollowing ? "fill-current" : ""}`}
      />
      {isFollowing ? "Följer" : "Följ"}
      {followerCount > 0 && (
        <span className="ml-1 text-xs opacity-75">({followerCount})</span>
      )}
    </Button>
  )
}
