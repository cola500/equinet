"use client"

import { StableLayout } from "@/components/layout/StableLayout"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"

export default function StableRootLayout({ children }: { children: React.ReactNode }) {
  const enabled = useFeatureFlag("stable_profiles")

  if (!enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Funktionen är inte tillgänglig just nu.</p>
      </div>
    )
  }

  return <StableLayout>{children}</StableLayout>
}
